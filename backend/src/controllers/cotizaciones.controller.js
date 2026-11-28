const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { aCentavos, MAX_CENTAVOS, montoEnCentavos } = require("../lib/dinero");
const { obtenerNegocio } = require("./negocio.controller");
const { hoy, include, bloquearCotizacion, estadoCotizacion, lineasCotizacion } = require("../lib/cotizaciones");
const { registrarAuditoria } = require("../lib/auditoria");

const id = z.string().uuid();
const schema = z.object({
  id,
  clienteId: id,
  listaPrecioId: id.nullish(),
  vigenteHasta: z.string().date(),
  observaciones: z.string().trim().max(500).optional(),
  descuento: montoEnCentavos.default(0),
  items: z.array(z.object({
    productoId: id, cantidad: z.number().int().positive().max(2_147_483_647),
    descuento: montoEnCentavos.default(0),
  })).min(1).max(100),
});

function serializar(cotizacion) {
  const items = lineasCotizacion(cotizacion);
  const subtotal = items.reduce((suma, it) => suma + it.cantidad * it.precio - it.descuento, 0);
  return {
    ...cotizacion, items, total: (subtotal - aCentavos(cotizacion.descuento)) / 100, descuento: Number(cotizacion.descuento),
    vigenteHasta: cotizacion.vigenteHasta.toISOString().slice(0, 10), estado: estadoCotizacion(cotizacion),
  };
}

async function listar(req, res) {
  const filtro = z.object({
    folio: z.coerce.number().int().min(1).max(2_147_483_647).optional(),
    estado: z.enum(["vigente", "vencida", "anulada", "vendida"]).optional(),
    q: z.string().trim().max(100).optional(),
    pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  }).safeParse(req.query);
  if (!filtro.success) throw new HttpError(400, "Revisa los filtros de cotizaciones");
  const { folio, estado, q, pagina } = filtro.data;
  const fecha = new Date(hoy());
  const estados = {
    vigente: { venta: null, anuladaEn: null, vigenteHasta: { gte: fecha } },
    vencida: { venta: null, anuladaEn: null, vigenteHasta: { lt: fecha } },
    anulada: { anuladaEn: { not: null } },
    vendida: { venta: { isNot: null } },
  };
  const where = { folio, ...(estado ? estados[estado] : {}),
    ...(q ? { clienteNombre: { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } } : {}) };
  const porPagina = 25;
  const [total, filas] = await prisma.$transaction([
    prisma.cotizacion.count({ where }),
    prisma.cotizacion.findMany({ where, include, orderBy: { folio: "desc" }, skip: (pagina - 1) * porPagina, take: porPagina }),
  ], { isolationLevel: "RepeatableRead" });
  res.json({ total, porPagina, filas: filas.map(serializar) });
}

async function obtener(req, res) {
  const actual = await prisma.cotizacion.findUnique({ where: { id: req.params.id }, include });
  if (!actual) throw new HttpError(404, "Cotización no encontrada");
  res.json(serializar(actual));
}

async function crear(req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Revisa el cliente, la fecha y los productos de la cotización");
  const { id, clienteId, listaPrecioId, vigenteHasta, observaciones, descuento, items } = parsed.data;
  if (descuento % 100 || items.some((item) => item.descuento % 100)) {
    throw new HttpError(400, "Ingresa descuentos en pesos enteros");
  }
  const actual = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72100005, hashtext(${id}))::text`;
    const previa = await tx.cotizacion.findUnique({ where: { id }, include });
    if (previa) {
      const mismasLineas = previa.items.length === items.length && items.every((item, i) => {
        const linea = previa.items[i];
        return linea.productoReferencia === item.productoId && linea.cantidad === item.cantidad && aCentavos(linea.descuento) === item.descuento;
      });
      if (!mismasLineas || previa.clienteId !== clienteId || previa.vigenteHasta.toISOString().slice(0, 10) !== vigenteHasta ||
          (previa.observaciones || "") !== (observaciones || "") || aCentavos(previa.descuento) !== descuento) {
        throw new HttpError(409, "El identificador ya corresponde a otra cotización");
      }
      return previa;
    }
    if (vigenteHasta < hoy()) throw new HttpError(400, "La vigencia debe terminar hoy o en una fecha futura");
    const productoIds = [...new Set(items.map((item) => item.productoId))];
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { nombre: true } });
    if (!cliente) throw new HttpError(404, "Cliente no encontrado");
    const productos = await tx.producto.findMany({ where: { id: { in: productoIds }, activo: true, ventaPublico: true } });
    const porId = new Map(productos.map((p) => [p.id, p]));
    const { descuentoMaximoCaja: maximo } = await obtenerNegocio(tx);
    const lista = listaPrecioId ? await tx.listaPrecio.findFirst({ where: { id: listaPrecioId, activo: true },
      include: { precios: { where: { productoId: { in: productoIds } } } },
    }) : null;
    if (listaPrecioId && !lista) throw new HttpError(409, "La lista de precios no está disponible");
    const precios = new Map(lista?.precios.map((p) => [p.productoId, p.precio]));
    let bruto = 0;
    let descuentos = descuento;
    const cantidades = new Map();
    const detalle = items.map((item, indice) => {
      const p = porId.get(item.productoId);
      if (!p) throw new HttpError(409, "La cotización incluye un producto que ya no se puede vender");
      const cantidad = (cantidades.get(p.id) ?? 0) + item.cantidad;
      if (cantidad > 2_147_483_647) throw new HttpError(400, "Cantidad de producto fuera de rango");
      cantidades.set(p.id, cantidad);
      const precio = Math.round(aCentavos(precios.get(p.id) ?? p.precioVenta) / 100) * 100;
      const importe = precio * item.cantidad;
      bruto += importe;
      descuentos += item.descuento;
      if (bruto > MAX_CENTAVOS || item.descuento > Math.floor(importe * maximo / 100)) {
        throw new HttpError(400, "El importe o descuento de la cotización supera el máximo");
      }
      return {
        posicion: indice + 1, productoReferencia: p.id, nombre: p.nombre, codigo: p.codigoBarras,
        cantidad: item.cantidad, precioUnitario: precio / 100, descuento: item.descuento / 100, gravado: p.tipoImpuesto !== "exento",
      };
    });
    if (descuentos > Math.floor(bruto * maximo / 100) || bruto - descuentos <= 0) {
      throw new HttpError(400, "Revisa el total y los descuentos de la cotización");
    }
    const creada = await tx.cotizacion.create({
      data: { id, clienteId, clienteNombre: cliente.nombre, vigenteHasta: new Date(vigenteHasta), usuarioNombre: req.user.nombre,
        observaciones, items: { create: detalle }, descuento: descuento / 100 },
      include,
    });
    await registrarAuditoria(tx, { accion: "cotizacion_creada", usuarioId: req.user.id, detalle: `Cotización #${creada.folio}` });
    return creada;
  }, { isolationLevel: "ReadCommitted" });
  res.status(201).json(serializar(actual));
}

async function anular(req, res) {
  const actual = await prisma.$transaction(async (tx) => {
    const previa = await bloquearCotizacion(tx, req.params.id);
    if (previa.venta) throw new HttpError(409, "La cotización ya tiene una venta");
    if (previa.anuladaEn) return previa;
    const siguiente = await tx.cotizacion.update({ where: { id: previa.id }, data: { anuladaEn: new Date() }, include });
    await registrarAuditoria(tx, { accion: "cotizacion_anulada", usuarioId: req.user.id, detalle: `Cotización #${previa.folio}` });
    return siguiente;
  });
  res.json(serializar(actual));
}

module.exports = { listar, obtener, crear, anular };
