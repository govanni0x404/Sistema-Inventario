const { createHash } = require("node:crypto");
const { Prisma } = require("@prisma/client");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { bodegaPrincipal, ajustarStockBodega } = require("../lib/stockBodega");
const { bloquearTurnoCompartido } = require("../lib/turnoLock");
const { buscarTurnoAbierto } = require("../lib/turnoAbierto");
const { fechaDeQuery } = require("../lib/rangoFechas");
const { filtroFolio } = require("../lib/folioVenta");
const { aCentavos, MAX_CENTAVOS, montoEnCentavos, proporcionRedondeada } = require("../lib/dinero");

const METODOS_PAGO = ["efectivo", "tarjeta", "transferencia"];
const cantidadSchema = z.coerce.number().int().positive("La cantidad debe ser mayor a 0").max(2_147_483_647);
const VENTA_INCLUDE = {
  cliente: { select: { id: true, nombre: true } },
  items: { include: { producto: { select: { id: true, nombre: true, sku: true } } } },
  turnoCaja: { select: { id: true, caja: { select: { nombre: true } }, tipoTurno: { select: { nombre: true } } } },
  pagos: true,
};

const ventaSchema = z
  .object({
    claveIdempotencia: z.string().uuid().transform((clave) => clave.toLowerCase()).optional(),
    turnoCajaId: z.string().uuid().optional(),
    clienteId: z.string().uuid().optional().nullable(),
    listaPrecioId: z.string().uuid().optional().nullable(),
    esCortesia: z.boolean().optional().default(false),
    motivoCortesia: z.string().trim().optional().nullable(),
    pagos: z
      .array(
        z.object({
          metodoPago: z.enum(METODOS_PAGO, { errorMap: () => ({ message: "Método de pago inválido" }) }),
          monto: montoEnCentavos.refine((monto) => monto > 0, "El monto del pago debe ser mayor a 0"),
        })
      )
      .max(2, "Máximo 2 formas de pago por venta")
      .refine((pagos) => new Set(pagos.map((p) => p.metodoPago)).size === pagos.length, {
        message: "No puedes repetir la misma forma de pago",
      })
      .optional()
      .default([]),
    descuento: montoEnCentavos.optional().default(0),
    items: z
      .array(
        z.object({
          productoId: z.string().uuid(),
          cantidad: cantidadSchema,
          descuento: montoEnCentavos.optional().default(0),
        })
      )
      .min(1, "La venta debe tener al menos un producto"),
  })
  .refine((data) => data.esCortesia || data.pagos.length >= 1, {
    message: "Indica al menos una forma de pago",
    path: ["pagos"],
  })
  .refine((data) => !data.esCortesia || (data.motivoCortesia && data.motivoCortesia.trim().length > 0), {
    message: "Indica el motivo de la cortesía",
    path: ["motivoCortesia"],
  });

function serializeVenta({ claveIdempotencia, huellaSolicitud, ...venta }, importesPorItem) {
  return {
    ...venta,
    subtotal: Number(venta.subtotal),
    descuento: Number(venta.descuento),
    total: Number(venta.total),
    pagos: venta.pagos?.map((p) => ({ ...p, monto: Number(p.monto) })),
    items: venta.items.map(({ costoUnitario, ...it }) => ({
      ...it,
      precioUnitario: Number(it.precioUnitario),
      descuento: Number(it.descuento),
      subtotal: Number(it.subtotal),
      ...(importesPorItem && { importeCobrado: importesPorItem.get(it.id) / 100 }),
    })),
    devoluciones: venta.devoluciones?.map((d) => (d.items ? serializeDevolucion(d) : { ...d, total: Number(d.total) })),
  };
}

function serializeDevolucion(d) {
  return {
    ...d,
    total: Number(d.total),
    items: d.items.map((it) => ({ ...it, subtotal: Number(it.subtotal) })),
  };
}

const DEVOLUCION_INCLUDE = {
  usuario: { select: { id: true, nombre: true } },
  items: true,
};

const devolucionSchema = z.object({
  turnoCajaId: z.string().uuid().optional(),
  motivo: z.string().optional().nullable(),
  // Obligatorio solo si la venta se pagó con 2 formas de pago; si no, se usa la única que tuvo.
  metodoReembolso: z
    .enum(METODOS_PAGO, { errorMap: () => ({ message: "Método de reembolso inválido" }) })
    .optional()
    .nullable(),
  items: z
    .array(
      z.object({
        ventaItemId: z.string().uuid(),
        cantidad: cantidadSchema,
      })
    )
    .min(1, "Debes indicar al menos un producto a devolver")
    .refine((items) => new Set(items.map((item) => item.ventaItemId)).size === items.length, {
      message: "Indica una sola cantidad por producto de la venta",
    }),
});

function ordenarItems(venta) {
  return [...venta.items].sort((a, b) => a.productoId.localeCompare(b.productoId) || a.id.localeCompare(b.id));
}

// Distribuye el total cobrado entre líneas. El redondeo del importe acumulado
// garantiza que la suma de las líneas coincide con el total del ticket.
function importesDeVenta(venta, items) {
  const total = venta.esCortesia ? 0 : aCentavos(venta.total);
  const subtotales = items.map((it) => aCentavos(it.subtotal));
  const sumaSubtotales = subtotales.reduce((suma, importe) => suma + importe, 0);
  const pesos = sumaSubtotales > 0 ? subtotales : items.map((it) => it.cantidad);
  const pesoTotal = pesos.reduce((suma, peso) => suma + peso, 0);
  const importes = new Map();
  let pesoAcumulado = 0;
  let importeAcumulado = 0;
  for (const [indice, item] of items.entries()) {
    pesoAcumulado += pesos[indice];
    const importe = proporcionRedondeada(total, pesoAcumulado, pesoTotal);
    importes.set(item.id, importe - importeAcumulado);
    importeAcumulado = importe;
  }
  return importes;
}

function calcularDevolucion(venta, cantidades) {
  const items = ordenarItems(venta);
  const importes = importesDeVenta(venta, items);
  let debido = -venta.devoluciones.reduce((suma, dev) => suma + aCentavos(dev.total), 0);
  const lineas = [];

  for (const item of items) {
    const devuelto = item.devolucionItems.reduce((suma, dev) => suma + dev.cantidad, 0);
    const importe = importes.get(item.id);
    const anterior = proporcionRedondeada(importe, Math.min(devuelto, item.cantidad), item.cantidad);
    debido += anterior;

    const cantidad = cantidades.get(item.id);
    if (cantidad === undefined) continue;
    cantidades.delete(item.id);
    const disponible = item.cantidad - devuelto;
    if (cantidad > disponible) {
      throw new HttpError(409, `Cantidad a devolver excede lo disponible (disponible: ${disponible})`);
    }
    lineas.push({
      ventaItemId: item.id,
      productoId: item.productoId,
      cantidad,
      incremento: proporcionRedondeada(importe, devuelto + cantidad, item.cantidad) - anterior,
    });
  }
  if (cantidades.size > 0) throw new HttpError(404, "Producto de venta no encontrado");

  // Compensa los redondeos de devoluciones previas sin generar importes negativos.
  let total = 0;
  const itemsData = lineas.map(({ incremento, ...linea }) => {
    debido += incremento;
    const importe = Math.max(0, debido);
    debido -= importe;
    total += importe;
    return { ...linea, subtotal: importe / 100 };
  });
  return { total: total / 100, itemsData };
}

// GET /api/ventas?fecha=YYYY-MM-DD&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&clienteId=&metodoPago=&turnoCajaId=
// `fecha` (un solo día) tiene prioridad sobre `desde`/`hasta` (rango) si ambos llegan.
// `limite`: máximo de ventas a devolver (las más recientes). Por defecto 1000, tope 5000,
// para que un rango de fechas enorme no traiga decenas de miles de ventas de una vez.
const LIMITE_VENTAS_DEFECTO = 1000;
const LIMITE_VENTAS_MAXIMO = 5000;

async function listar(req, res) {
  const { fecha, desde, hasta, clienteId, metodoPago, turnoCajaId, folio, tipo } = req.query;
  const where = filtroFolio(folio);
  const limitePedido = parseInt(req.query.limite, 10);
  const limite = Number.isFinite(limitePedido) && limitePedido > 0
    ? Math.min(limitePedido, LIMITE_VENTAS_MAXIMO)
    : LIMITE_VENTAS_DEFECTO;

  if (clienteId) where.clienteId = String(clienteId);
  if (metodoPago) where.pagos = { some: { metodoPago: String(metodoPago) } };
  if (turnoCajaId) where.turnoCajaId = String(turnoCajaId);
  if (tipo === "cortesia") where.esCortesia = true;
  if (tipo === "cobrada") where.esCortesia = false;
  if (tipo === "con-devolucion") where.devoluciones = { some: {} };
  if (fecha) {
    const inicio = fechaDeQuery(fecha, { nombre: "fecha" });
    const fin = fechaDeQuery(fecha, { nombre: "fecha", finDelDia: true });
    where.fecha = { gte: inicio, lte: fin };
  } else if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = fechaDeQuery(desde, { nombre: "desde" });
    if (hasta) where.fecha.lte = fechaDeQuery(hasta, { nombre: "hasta", finDelDia: true });
  }

  const ventas = await prisma.venta.findMany({
    where,
    include: {
      ...VENTA_INCLUDE,
      devoluciones: { select: { id: true, total: true } },
    },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    take: limite,
  });

  res.json(ventas.map((venta) => serializeVenta(venta)));
}

// GET /api/ventas/:id
async function obtener(req, res) {
  const venta = await prisma.venta.findUnique({
    where: { id: req.params.id },
    include: {
      ...VENTA_INCLUDE,
      devoluciones: { include: DEVOLUCION_INCLUDE, orderBy: { fecha: "desc" } },
    },
  });
  if (!venta) throw new HttpError(404, "Venta no encontrada");
  res.json(serializeVenta(venta, importesDeVenta(venta, ordenarItems(venta))));
}

// POST /api/ventas — crea la venta, descuenta stock; todo en una transacción atómica.
async function crear(req, res) {
  const parsed = ventaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const {
    claveIdempotencia, turnoCajaId, clienteId, listaPrecioId, pagos, items, descuento: descuentoTicket, esCortesia, motivoCortesia,
  } = parsed.data;
  const usuarioId = req.user.id;

  // Sumar cantidades y descuentos si el mismo producto aparece más de una vez en el ticket.
  const cantidadPorProducto = new Map();
  const descuentoPorProducto = new Map();
  for (const item of items) {
    cantidadPorProducto.set(item.productoId, (cantidadPorProducto.get(item.productoId) || 0) + item.cantidad);
    descuentoPorProducto.set(item.productoId, (descuentoPorProducto.get(item.productoId) || 0) + item.descuento);
  }

  const productoIds = [...cantidadPorProducto.keys()].sort();
  const huellaSolicitud = claveIdempotencia ? createHash("sha256").update(JSON.stringify({
    turnoCajaId,
    clienteId: clienteId ?? null,
    listaPrecioId: listaPrecioId ?? null,
    esCortesia,
    motivoCortesia: esCortesia ? motivoCortesia : null,
    descuentoTicket,
    pagos: esCortesia ? [] : [...pagos].sort((a, b) => a.metodoPago.localeCompare(b.metodoPago)),
    items: productoIds.map((id) => [id, cantidadPorProducto.get(id), descuentoPorProducto.get(id)]),
  })).digest("hex") : null;

  const venta = await prisma.$transaction(async (tx) => {
    if (claveIdempotencia) {
      const claveUsuario = `${usuarioId}:${claveIdempotencia}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(72100002, hashtext(${claveUsuario}))::text`;
      const existente = await tx.venta.findUnique({
        where: { usuarioId_claveIdempotencia: { usuarioId, claveIdempotencia } },
        include: VENTA_INCLUDE,
      });
      if (existente) {
        if (existente.huellaSolicitud !== huellaSolicitud) {
          throw new HttpError(409, "Esta clave ya corresponde a una venta con otros datos");
        }
        return existente;
      }
    }

    await bloquearTurnoCompartido(tx);
    const turnoAbierto = await buscarTurnoAbierto(tx, { turnoCajaId });
    if (!turnoAbierto) {
      throw new HttpError(409, "Debes abrir un turno de caja antes de vender");
    }

    if (clienteId) {
      const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
      if (!cliente) throw new HttpError(404, "Cliente no encontrado");
    }

    const precioListaPorProducto = new Map();
    if (listaPrecioId) {
      const lista = await tx.listaPrecio.findUnique({ where: { id: listaPrecioId } });
      if (!lista || !lista.activo) throw new HttpError(404, "Lista de precios no encontrada o inactiva");
      const precios = await tx.precioLista.findMany({ where: { listaPrecioId, productoId: { in: productoIds } } });
      for (const p of precios) precioListaPorProducto.set(p.productoId, aCentavos(p.precio));
    }

    await tx.$queryRaw`
      SELECT "id" FROM "productos" WHERE "id" IN (${Prisma.join(productoIds)})
      ORDER BY "id" COLLATE "C" FOR NO KEY UPDATE
    `;
    const productos = await tx.producto.findMany({ where: { id: { in: productoIds } } });
    const productoPorId = new Map(productos.map((producto) => [producto.id, producto]));

    let subtotalVenta = 0;
    const itemsData = [];
    const stockResultantePorProducto = new Map();

    for (const productoId of productoIds) {
      const cantidad = cantidadPorProducto.get(productoId);
      const producto = productoPorId.get(productoId);
      if (!producto || !producto.activo) {
        throw new HttpError(404, `Producto no encontrado o inactivo (${productoId})`);
      }
      if (!producto.ventaPublico) {
        throw new HttpError(409, `"${producto.nombre}" no está habilitado para venta al público`);
      }
      if (producto.inventariable && producto.stock < cantidad) {
        throw new HttpError(409, `Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock})`);
      }

      const precioUnitario = precioListaPorProducto.get(productoId) ?? aCentavos(producto.precioVenta);
      const bruto = precioUnitario * cantidad;
      const descuentoItem = descuentoPorProducto.get(productoId) || 0;
      if (descuentoItem > bruto) {
        throw new HttpError(400, `El descuento de "${producto.nombre}" no puede superar su subtotal (${bruto / 100})`);
      }
      const subtotal = bruto - descuentoItem;
      subtotalVenta += subtotal;
      if (subtotalVenta > MAX_CENTAVOS || descuentoItem > MAX_CENTAVOS) {
        throw new HttpError(400, "El importe del ticket supera el máximo permitido");
      }
      itemsData.push({
        productoId,
        inventariable: producto.inventariable,
        cantidad,
        precioUnitario: precioUnitario / 100,
        costoUnitario: producto.precioCompra,
        descuento: descuentoItem / 100,
        subtotal: subtotal / 100,
      });
    }

    if (descuentoTicket > subtotalVenta) {
      throw new HttpError(400, `El descuento no puede superar el subtotal del ticket (${subtotalVenta / 100})`);
    }
    const total = subtotalVenta - descuentoTicket;

    if (!esCortesia) {
      const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0);
      if (sumaPagos !== total) {
        throw new HttpError(400, `La suma de los pagos (${(sumaPagos / 100).toFixed(2)}) no coincide con el total (${(total / 100).toFixed(2)})`);
      }
    }

    const itemsConStock = itemsData.filter((item) => item.inventariable);
    const bodega = itemsConStock.length ? await bodegaPrincipal(tx) : null;
    for (const { productoId, cantidad } of itemsConStock) {
      const resultado = await tx.producto.updateMany({
        where: { id: productoId, activo: true, stock: { gte: cantidad } },
        data: { stock: { decrement: cantidad } },
      });
      if (resultado.count === 0) {
        throw new HttpError(409, `Stock insuficiente para "${productoPorId.get(productoId).nombre}"`);
      }
      await ajustarStockBodega(tx, bodega.id, productoId, -cantidad);
      const { stock } = await tx.producto.findUniqueOrThrow({ where: { id: productoId }, select: { stock: true } });
      stockResultantePorProducto.set(productoId, stock);
    }

    const ventaCreada = await tx.venta.create({
      data: {
        clienteId: clienteId || null,
        subtotal: subtotalVenta / 100,
        descuento: descuentoTicket / 100,
        total: total / 100,
        esCortesia,
        motivoCortesia: esCortesia ? motivoCortesia.trim() : null,
        usuarioId,
        claveIdempotencia,
        huellaSolicitud,
        turnoCajaId: turnoAbierto.id,
        items: { create: itemsData },
        ...(esCortesia ? {} : { pagos: { create: pagos.map((p) => ({ metodoPago: p.metodoPago, monto: p.monto / 100 })) } }),
      },
      include: VENTA_INCLUDE,
    });

    // Registro de auditoría: cada venta deja su propio rastro en el historial de movimientos de stock.
    for (const item of itemsConStock) {
      await tx.movimientoStock.create({
        data: {
          productoId: item.productoId,
          tipo: "salida",
          origen: "venta",
          cantidad: item.cantidad,
          stockResultante: stockResultantePorProducto.get(item.productoId),
          ventaId: ventaCreada.id,
          usuarioId,
          bodegaId: bodega.id,
        },
      });
    }

    return ventaCreada;
  }, { isolationLevel: "ReadCommitted" });

  res.status(201).json(serializeVenta(venta));
}

// POST /api/ventas/:id/devolucion — devuelve items (total o parcial) de una venta,
// restaura stock y deja registro de auditoría. Venta.total original nunca se modifica.
async function crearDevolucion(req, res) {
  const parsed = devolucionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { motivo, items, turnoCajaId, metodoReembolso: metodoPedido } = parsed.data;
  const ventaId = req.params.id;

  const devolucion = await prisma.$transaction(async (tx) => {
    await bloquearTurnoCompartido(tx);
    // Las devoluciones de un mismo ticket consultan las cantidades una a la vez.
    await tx.$queryRaw`SELECT id FROM ventas WHERE id = ${ventaId} FOR NO KEY UPDATE`;
    const venta = await tx.venta.findUnique({
      where: { id: ventaId },
      include: {
        items: { include: { devolucionItems: true } },
        pagos: true,
        devoluciones: { select: { total: true } },
      },
    });
    if (!venta) throw new HttpError(404, "Venta no encontrada");

    // Cómo se reembolsa: una cortesía no se pagó, así que no hay reembolso de dinero.
    let metodoReembolso = null;
    if (!venta.esCortesia) {
      if (venta.pagos.length === 1) {
        metodoReembolso = venta.pagos[0].metodoPago;
        if (metodoPedido && metodoPedido !== metodoReembolso) {
          throw new HttpError(400, "Usa el método de pago original para esta devolución");
        }
      } else {
        if (!metodoPedido) throw new HttpError(400, "Indica el método de reembolso");
        if (venta.pagos.length > 0 && !venta.pagos.some((pago) => pago.metodoPago === metodoPedido)) {
          throw new HttpError(400, "Selecciona uno de los métodos de pago del ticket");
        }
        metodoReembolso = metodoPedido;
      }
    }

    // El efectivo devuelto sale de la caja del turno abierto (y se resta en su arqueo).
    const turnoAbierto = await buscarTurnoAbierto(tx, { turnoCajaId });
    if (turnoCajaId && !turnoAbierto) throw new HttpError(409, "El turno seleccionado ya no está abierto");
    if (metodoReembolso === "efectivo" && !turnoAbierto) {
      throw new HttpError(409, "Abre un turno de caja para devolver efectivo");
    }

    const cantidades = new Map(items.map((it) => [it.ventaItemId, it.cantidad]));
    const { total, itemsData } = calcularDevolucion(venta, cantidades);
    const inventariables = new Set(venta.items.filter((item) => item.inventariable).map((item) => item.id));
    const itemsConStock = itemsData.filter((item) => inventariables.has(item.ventaItemId));
    const bodega = itemsConStock.length ? await bodegaPrincipal(tx) : null;

    const devolucionCreada = await tx.devolucion.create({
      data: {
        ventaId,
        motivo: motivo || null,
        total,
        metodoReembolso,
        turnoCajaId: turnoAbierto?.id ?? null,
        usuarioId: req.user?.id,
        items: {
          create: itemsData.map(({ ventaItemId, cantidad, subtotal }) => ({ ventaItemId, cantidad, subtotal })),
        },
      },
      include: DEVOLUCION_INCLUDE,
    });

    // Registro de auditoría: la devolución también deja su rastro en movimientos de stock.
    for (const { productoId, cantidad } of itemsConStock) {
      const { stock } = await tx.producto.update({
        where: { id: productoId },
        data: { stock: { increment: cantidad } },
        select: { stock: true },
      });
      await ajustarStockBodega(tx, bodega.id, productoId, cantidad);
      await tx.movimientoStock.create({
        data: {
          productoId,
          tipo: "entrada",
          origen: "devolucion",
          cantidad,
          stockResultante: stock,
          ventaId,
          usuarioId: req.user?.id,
          bodegaId: bodega.id,
        },
      });
    }

    return devolucionCreada;
  }, { isolationLevel: "ReadCommitted" });

  res.status(201).json(serializeDevolucion(devolucion));
}

module.exports = { listar, obtener, crear, crearDevolucion };
