const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { bodegaPrincipal, ajustarStockBodega } = require("../lib/stockBodega");
const { bloquearTurnoCompartido } = require("../lib/turnoLock");
const { fechaDeQuery } = require("../lib/rangoFechas");

const round2 = (n) => Math.round(n * 100) / 100;

const METODOS_PAGO = ["efectivo", "tarjeta", "transferencia"];

const ventaSchema = z
  .object({
    clienteId: z.string().uuid().optional().nullable(),
    listaPrecioId: z.string().uuid().optional().nullable(),
    esCortesia: z.boolean().optional().default(false),
    motivoCortesia: z.string().trim().optional().nullable(),
    pagos: z
      .array(
        z.object({
          metodoPago: z.enum(METODOS_PAGO, { errorMap: () => ({ message: "Método de pago inválido" }) }),
          monto: z.coerce.number().positive("El monto del pago debe ser mayor a 0"),
        })
      )
      .max(2, "Máximo 2 formas de pago por venta")
      .refine((pagos) => new Set(pagos.map((p) => p.metodoPago)).size === pagos.length, {
        message: "No puedes repetir la misma forma de pago",
      })
      .optional()
      .default([]),
    descuento: z.coerce.number().min(0, "El descuento no puede ser negativo").optional().default(0),
    items: z
      .array(
        z.object({
          productoId: z.string().uuid(),
          cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
          descuento: z.coerce.number().min(0, "El descuento no puede ser negativo").optional().default(0),
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

function serializeVenta(venta) {
  return {
    ...venta,
    subtotal: Number(venta.subtotal),
    descuento: Number(venta.descuento),
    total: Number(venta.total),
    pagos: venta.pagos?.map((p) => ({ ...p, monto: Number(p.monto) })),
    items: venta.items.map((it) => ({
      ...it,
      precioUnitario: Number(it.precioUnitario),
      descuento: Number(it.descuento),
      subtotal: Number(it.subtotal),
    })),
    devoluciones: venta.devoluciones?.map((d) => (d.items ? serializeDevolucion(d) : d)),
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
        cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
      })
    )
    .min(1, "Debes indicar al menos un producto a devolver"),
});

// GET /api/ventas?fecha=YYYY-MM-DD&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&clienteId=&metodoPago=&turnoCajaId=
// `fecha` (un solo día) tiene prioridad sobre `desde`/`hasta` (rango) si ambos llegan.
// `limite`: máximo de ventas a devolver (las más recientes). Por defecto 1000, tope 5000,
// para que un rango de fechas enorme no traiga decenas de miles de ventas de una vez.
const LIMITE_VENTAS_DEFECTO = 1000;
const LIMITE_VENTAS_MAXIMO = 5000;

async function listar(req, res) {
  const { fecha, desde, hasta, clienteId, metodoPago, turnoCajaId } = req.query;
  const where = {};
  const limitePedido = parseInt(req.query.limite, 10);
  const limite = Number.isFinite(limitePedido) && limitePedido > 0
    ? Math.min(limitePedido, LIMITE_VENTAS_MAXIMO)
    : LIMITE_VENTAS_DEFECTO;

  if (clienteId) where.clienteId = String(clienteId);
  if (metodoPago) where.pagos = { some: { metodoPago: String(metodoPago) } };
  if (turnoCajaId) where.turnoCajaId = String(turnoCajaId);
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
      cliente: { select: { id: true, nombre: true } },
      items: { include: { producto: { select: { id: true, nombre: true, sku: true } } } },
      turnoCaja: { select: { id: true, tipoTurno: { select: { nombre: true } } } },
      devoluciones: { select: { id: true } },
      pagos: true,
    },
    orderBy: { fecha: "desc" },
    take: limite,
  });

  res.json(ventas.map(serializeVenta));
}

// GET /api/ventas/:id
async function obtener(req, res) {
  const venta = await prisma.venta.findUnique({
    where: { id: req.params.id },
    include: {
      cliente: { select: { id: true, nombre: true } },
      items: { include: { producto: { select: { id: true, nombre: true, sku: true } } } },
      turnoCaja: { select: { id: true, tipoTurno: { select: { nombre: true } } } },
      devoluciones: { include: DEVOLUCION_INCLUDE, orderBy: { fecha: "desc" } },
      pagos: true,
    },
  });
  if (!venta) throw new HttpError(404, "Venta no encontrada");
  res.json(serializeVenta(venta));
}

// POST /api/ventas — crea la venta, descuenta stock; todo en una transacción atómica.
async function crear(req, res) {
  const parsed = ventaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { clienteId, listaPrecioId, pagos, items, descuento: descuentoTicket, esCortesia, motivoCortesia } = parsed.data;

  // Sumar cantidades y descuentos si el mismo producto aparece más de una vez en el ticket.
  const cantidadPorProducto = new Map();
  const descuentoPorProducto = new Map();
  for (const item of items) {
    cantidadPorProducto.set(item.productoId, (cantidadPorProducto.get(item.productoId) || 0) + item.cantidad);
    descuentoPorProducto.set(item.productoId, (descuentoPorProducto.get(item.productoId) || 0) + item.descuento);
  }

  if (clienteId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new HttpError(404, "Cliente no encontrado");
  }

  // Lista de precios elegida en Caja: sus precios reemplazan a Producto.precioVenta.
  // Los productos sin fila en la lista se cobran a su precio base.
  const precioListaPorProducto = new Map();
  if (listaPrecioId) {
    const lista = await prisma.listaPrecio.findUnique({ where: { id: listaPrecioId } });
    if (!lista || !lista.activo) throw new HttpError(404, "Lista de precios no encontrada o inactiva");
    const precios = await prisma.precioLista.findMany({
      where: { listaPrecioId, productoId: { in: [...cantidadPorProducto.keys()] } },
    });
    for (const p of precios) precioListaPorProducto.set(p.productoId, Number(p.precio));
  }

  const venta = await prisma.$transaction(async (tx) => {
    await bloquearTurnoCompartido(tx);
    const turnoAbierto = await tx.turnoCaja.findFirst({ where: { estado: "abierto" } });
    if (!turnoAbierto) {
      throw new HttpError(409, "Debes abrir un turno de caja antes de vender");
    }

    const bodega = await bodegaPrincipal(tx);
    const productoIds = [...cantidadPorProducto.keys()];
    const productos = await tx.producto.findMany({ where: { id: { in: productoIds } } });

    let subtotalVenta = 0;
    const itemsData = [];
    const stockResultantePorProducto = new Map();

    for (const [productoId, cantidad] of cantidadPorProducto) {
      const producto = productos.find((p) => p.id === productoId);
      if (!producto || !producto.activo) {
        throw new HttpError(404, `Producto no encontrado o inactivo (${productoId})`);
      }
      if (producto.stock < cantidad) {
        throw new HttpError(409, `Stock insuficiente para "${producto.nombre}" (disponible: ${producto.stock})`);
      }

      const precioUnitario = precioListaPorProducto.has(productoId)
        ? precioListaPorProducto.get(productoId)
        : Number(producto.precioVenta);
      const bruto = precioUnitario * cantidad;
      const descuentoItem = descuentoPorProducto.get(productoId) || 0;
      if (descuentoItem > bruto) {
        throw new HttpError(400, `El descuento de "${producto.nombre}" no puede superar su subtotal (${bruto})`);
      }
      const subtotal = bruto - descuentoItem;
      subtotalVenta += subtotal;
      itemsData.push({ productoId, cantidad, precioUnitario, descuento: descuentoItem, subtotal });

      // Guard atómico: si el stock cambió entre la lectura y este punto, la actualización no aplica.
      const resultado = await tx.producto.updateMany({
        where: { id: productoId, stock: { gte: cantidad } },
        data: { stock: { decrement: cantidad } },
      });
      if (resultado.count === 0) {
        throw new HttpError(409, `Stock insuficiente para "${producto.nombre}"`);
      }
      await ajustarStockBodega(tx, bodega.id, productoId, -cantidad);
      stockResultantePorProducto.set(productoId, producto.stock - cantidad);
    }

    if (descuentoTicket > subtotalVenta) {
      throw new HttpError(400, `El descuento no puede superar el subtotal del ticket (${subtotalVenta})`);
    }
    const total = subtotalVenta - descuentoTicket;

    if (!esCortesia) {
      const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0);
      if (Math.abs(sumaPagos - total) > 0.01) {
        throw new HttpError(400, `La suma de los pagos (${sumaPagos.toFixed(2)}) no coincide con el total (${total.toFixed(2)})`);
      }
    }

    const ventaCreada = await tx.venta.create({
      data: {
        clienteId: clienteId || null,
        subtotal: subtotalVenta,
        descuento: descuentoTicket,
        total,
        esCortesia,
        motivoCortesia: esCortesia ? motivoCortesia.trim() : null,
        usuarioId: req.user?.id,
        turnoCajaId: turnoAbierto.id,
        items: { create: itemsData },
        ...(esCortesia ? {} : { pagos: { create: pagos.map((p) => ({ metodoPago: p.metodoPago, monto: p.monto })) } }),
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        items: { include: { producto: { select: { id: true, nombre: true, sku: true } } } },
        turnoCaja: { select: { id: true, tipoTurno: { select: { nombre: true } } } },
        pagos: true,
      },
    });

    // Registro de auditoría: cada venta deja su propio rastro en el historial de movimientos de stock.
    for (const item of itemsData) {
      await tx.movimientoStock.create({
        data: {
          productoId: item.productoId,
          tipo: "salida",
          origen: "venta",
          cantidad: item.cantidad,
          stockResultante: stockResultantePorProducto.get(item.productoId),
          ventaId: ventaCreada.id,
          usuarioId: req.user?.id,
          bodegaId: bodega.id,
        },
      });
    }

    return ventaCreada;
  });

  res.status(201).json(serializeVenta(venta));
}

// POST /api/ventas/:id/devolucion — devuelve items (total o parcial) de una venta,
// restaura stock y deja registro de auditoría. Venta.total original nunca se modifica.
async function crearDevolucion(req, res) {
  const parsed = devolucionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { motivo, items, metodoReembolso: metodoPedido } = parsed.data;
  const ventaId = req.params.id;

  const devolucion = await prisma.$transaction(async (tx) => {
    await bloquearTurnoCompartido(tx);
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
      if (metodoPedido) metodoReembolso = metodoPedido;
      else if (venta.pagos.length === 1) metodoReembolso = venta.pagos[0].metodoPago;
      else throw new HttpError(400, "La venta se pagó con 2 formas de pago: indica el método de reembolso");
    }

    // El efectivo devuelto sale de la caja del turno abierto (y se resta en su arqueo).
    const turnoAbierto = await tx.turnoCaja.findFirst({ where: { estado: "abierto" } });
    if (metodoReembolso === "efectivo" && !turnoAbierto) {
      throw new HttpError(409, "Abre un turno de caja para devolver efectivo");
    }

    // Lo realmente cobrado por unidad: subtotal del ítem (ya con su descuento), prorrateado
    // por el descuento del ticket (total / subtotal de la venta).
    const factorTicket = Number(venta.subtotal) > 0 ? Number(venta.total) / Number(venta.subtotal) : 0;

    const bodega = await bodegaPrincipal(tx);
    let total = 0;
    const itemsData = [];
    const stockResultantePorProducto = new Map();

    for (const { ventaItemId, cantidad } of items) {
      const ventaItem = venta.items.find((it) => it.id === ventaItemId);
      if (!ventaItem) throw new HttpError(404, `Producto de venta no encontrado (${ventaItemId})`);

      const yaDevuelto = ventaItem.devolucionItems.reduce((sum, di) => sum + di.cantidad, 0);
      const disponible = ventaItem.cantidad - yaDevuelto;
      if (cantidad > disponible) {
        throw new HttpError(409, `Cantidad a devolver excede lo disponible (disponible: ${disponible})`);
      }

      const pagadoPorUnidad = (Number(ventaItem.subtotal) / ventaItem.cantidad) * factorTicket;
      const subtotal = venta.esCortesia ? 0 : round2(pagadoPorUnidad * cantidad);
      total += subtotal;
      itemsData.push({ ventaItemId, cantidad, subtotal, productoId: ventaItem.productoId });

      const producto = await tx.producto.update({
        where: { id: ventaItem.productoId },
        data: { stock: { increment: cantidad } },
      });
      await ajustarStockBodega(tx, bodega.id, ventaItem.productoId, cantidad);
      stockResultantePorProducto.set(ventaItem.productoId, producto.stock);
    }

    // Por redondeo, la suma de las devoluciones nunca debe superar lo cobrado en la venta.
    const yaReembolsado = venta.devoluciones.reduce((s, d) => s + Number(d.total), 0);
    const maximo = round2(Math.max(0, (venta.esCortesia ? 0 : Number(venta.total)) - yaReembolsado));
    total = round2(total);
    if (total > maximo) {
      const ultimo = itemsData[itemsData.length - 1];
      ultimo.subtotal = round2(ultimo.subtotal - (total - maximo));
      total = maximo;
    }

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
    for (const item of itemsData) {
      await tx.movimientoStock.create({
        data: {
          productoId: item.productoId,
          tipo: "entrada",
          origen: "devolucion",
          cantidad: item.cantidad,
          stockResultante: stockResultantePorProducto.get(item.productoId),
          ventaId,
          usuarioId: req.user?.id,
          bodegaId: bodega.id,
        },
      });
    }

    return devolucionCreada;
  });

  res.status(201).json(serializeDevolucion(devolucion));
}

module.exports = { listar, obtener, crear, crearDevolucion };
