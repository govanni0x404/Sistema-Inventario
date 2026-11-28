const { z } = require("zod");
const { EstadoCompra } = require("@prisma/client");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { montoEnPesos } = require("../lib/dinero");
const { ajustarStockBodega, bloquearProductos, stockTotal, validarStockTotal } = require("../lib/stockBodega");
const { registrarAuditoria } = require("../lib/auditoria");

const id = z.string().uuid();
const nota = z.string().trim().max(500).optional().transform((valor) => valor || null);
const cantidad = z.number().int().positive().max(2_147_483_647);
const lineas = (campo, schema) => z.array(schema).min(1).max(100)
  .refine((items) => new Set(items.map((item) => item[campo])).size === items.length, "Hay líneas repetidas");
const ordenSchema = z.object({
  proveedorId: id,
  bodegaId: id,
  entregaEstimada: z.string().date().nullable().optional(),
  nota,
  items: lineas("productoId", z.object({ productoId: id, cantidad, costoUnitario: montoEnPesos })),
});
const operacionSchema = z.object({
  id,
  recepcionId: id.optional(),
  documento: z.string().trim().min(1).max(120),
  nota,
  items: lineas("itemId", z.object({ itemId: id, cantidad })),
});
const transicionSchema = z.object({
  accion: z.enum(["emitir", "anular", "cerrar"]),
  motivo: nota,
  revision: z.string().datetime(),
}).refine(({ accion, motivo }) => accion === "emitir" || motivo, "Indica el motivo del cierre o anulación");
const filtrosSchema = z.object({
  estado: z.nativeEnum(EstadoCompra).optional(),
  proveedorId: id.optional(),
  bodegaId: id.optional(),
  folio: z.coerce.number().int().positive().max(2_147_483_647).optional(),
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
});

const itemsOrden = {
  orderBy: [{ productoNombre: "asc" }, { id: "asc" }],
  include: { operaciones: { where: { operacion: { recepcionId: null } }, select: { cantidad: true } } },
};
function conRecepciones(orden) {
  return {
    ...orden,
    items: orden.items.map(({ operaciones, ...item }) => ({
      ...item, recibida: operaciones.reduce((total, operacion) => total + operacion.cantidad, 0),
    })),
    ...(orden.operaciones && { operaciones: orden.operaciones.map((op) => ({
      ...op, tipo: op.recepcionId ? "devolucion" : "recepcion",
    })) }),
  };
}
const detalle = {
  items: itemsOrden,
  operaciones: { include: { items: true }, orderBy: [{ fecha: "desc" }, { id: "desc" }] },
};

function validar(schema, input) {
  const resultado = schema.safeParse(input);
  if (!resultado.success) {
    const { path, message } = resultado.error.issues[0];
    throw new HttpError(400, path.length ? `Revisa ${path.join(".")}. ${message}` : message);
  }
  return resultado.data;
}

async function bloquearOrden(tx, ordenId) {
  const [fila] = await tx.$queryRaw`SELECT id FROM ordenes_compra WHERE id = ${ordenId} FOR NO KEY UPDATE`;
  if (!fila) throw new HttpError(404, "Orden de compra no encontrada");
  return conRecepciones(await tx.ordenCompra.findUniqueOrThrow({ where: { id: ordenId }, include: detalle }));
}

async function datosOrden(tx, { proveedorId, bodegaId, entregaEstimada, nota, items }) {
  const proveedor = await tx.proveedor.findUnique({ where: { id: proveedorId }, select: { nombre: true } });
  const bodega = await tx.bodega.findUnique({ where: { id: bodegaId }, select: { nombre: true, activo: true } });
  if (!proveedor) throw new HttpError(404, "Proveedor no encontrado");
  if (!bodega?.activo) throw new HttpError(409, "Selecciona una bodega activa");
  const productos = await tx.producto.findMany({
    where: { id: { in: items.map((item) => item.productoId) }, activo: true, inventariable: true },
    select: { id: true, nombre: true, sku: true, codigoBarras: true },
  });
  const porId = new Map(productos.map((producto) => [producto.id, producto]));
  return {
    proveedorId,
    proveedorNombre: proveedor.nombre,
    bodegaId,
    bodegaNombre: bodega.nombre,
    entregaEstimada: entregaEstimada ? new Date(`${entregaEstimada}T00:00:00Z`) : null,
    nota,
    items: items.map((item) => {
      const producto = porId.get(item.productoId);
      if (!producto) throw new HttpError(409, "La orden contiene un producto desactivado, inexistente o sin control de inventario");
      return { ...item, productoNombre: producto.nombre, sku: producto.codigoBarras ?? producto.sku };
    }),
  };
}

async function auditar(tx, usuario, orden, accion, documento) {
  await registrarAuditoria(tx, {
    accion: `compra_${accion}`,
    usuarioId: usuario.id,
    valorNuevo: orden.estado,
    detalle: [`OC #${orden.folio}`, documento, orden.motivoCierre].filter(Boolean).join(" · "),
  });
}

async function listar(req, res) {
  const { pagina, ...where } = validar(filtrosSchema, req.query);
  const porPagina = 25;
  const [total, ordenes] = await prisma.$transaction([
    prisma.ordenCompra.count({ where }),
    prisma.ordenCompra.findMany({
      where, include: { items: itemsOrden },
      orderBy: { folio: "desc" }, skip: (pagina - 1) * porPagina, take: porPagina,
    }),
  ], { isolationLevel: "RepeatableRead" });
  res.json({ total, porPagina, ordenes: ordenes.map(conRecepciones) });
}

async function obtener(req, res) {
  const [orden] = await prisma.$transaction([
    prisma.ordenCompra.findUnique({ where: { id: req.params.id }, include: detalle }),
  ], { isolationLevel: "RepeatableRead" });
  if (!orden) throw new HttpError(404, "Orden de compra no encontrada");
  res.json(conRecepciones(orden));
}

async function crear(req, res) {
  const ordenId = validar(id, req.body?.id);
  const datos = validar(ordenSchema, req.body);
  const orden = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ordenId}, 0))::text`;
    const existente = await tx.ordenCompra.findUnique({ where: { id: ordenId }, include: detalle });
    if (existente) return existente;
    const { items, ...cabecera } = await datosOrden(tx, datos);
    const creada = await tx.ordenCompra.create({
      data: { ...cabecera, id: ordenId, creadoPor: req.user.nombre, items: { create: items } },
      include: detalle,
    });
    await auditar(tx, req.user, creada, "creada");
    return creada;
  });
  res.status(201).json(conRecepciones(orden));
}

async function actualizar(req, res) {
  const datos = validar(ordenSchema, req.body);
  const revision = validar(z.string().datetime(), req.body?.revision);
  const orden = await prisma.$transaction(async (tx) => {
    const actual = await bloquearOrden(tx, req.params.id);
    if (actual.estado !== "borrador") throw new HttpError(409, "Solo puedes editar órdenes en borrador");
    if (actual.actualizadoEn.toISOString() !== revision) throw new HttpError(409, "La orden cambió. Abre el borrador de nuevo para ver la versión actual");
    const { items, ...cabecera } = await datosOrden(tx, datos);
    await tx.ordenCompraItem.deleteMany({ where: { ordenId: actual.id } });
    const actualizada = await tx.ordenCompra.update({
      where: { id: actual.id }, data: { ...cabecera, items: { create: items } }, include: detalle,
    });
    await auditar(tx, req.user, actualizada, "editada");
    return actualizada;
  });
  res.json(conRecepciones(orden));
}

async function cambiarEstado(req, res) {
  const { accion, motivo, revision } = validar(transicionSchema, req.body);
  const cambios = {
    emitir: { desde: ["borrador"], estado: "emitida", evento: "emitida" },
    anular: { desde: ["borrador", "emitida"], estado: "anulada", evento: "anulada" },
    cerrar: { desde: ["parcial"], estado: "cerrada", evento: "cerrada" },
  };
  const { desde, estado, evento } = cambios[accion];
  const orden = await prisma.$transaction(async (tx) => {
    const actual = await bloquearOrden(tx, req.params.id);
    if (actual.estado === estado && actual.motivoCierre === motivo) return actual;
    if (!desde.includes(actual.estado)) throw new HttpError(409, "La orden cambió de estado. Actualiza el detalle");
    if (actual.actualizadoEn.toISOString() !== revision) throw new HttpError(409, "La orden cambió. Cierra este formulario y recarga el detalle");
    if (accion === "emitir") {
      const bodega = await tx.bodega.findUnique({ where: { id: actual.bodegaId } });
      if (!bodega.activo) throw new HttpError(409, "Selecciona una bodega activa antes de emitir la orden");
      const inactivos = await tx.producto.count({
        where: { id: { in: actual.items.map((item) => item.productoId) }, OR: [{ activo: false }, { inventariable: false }] },
      });
      if (inactivos) throw new HttpError(409, "Revisa los productos desactivados o sin control de inventario de la orden");
    }
    const actualizada = await tx.ordenCompra.update({
      where: { id: actual.id }, data: { estado, motivoCierre: motivo }, include: detalle,
    });
    await auditar(tx, req.user, actualizada, evento);
    return conRecepciones(actualizada);
  });
  res.json(orden);
}

function cantidadesDisponibles(orden, recepcionId) {
  if (!recepcionId) {
    if (!["emitida", "parcial"].includes(orden.estado)) throw new HttpError(409, "Esta orden no admite nuevas recepciones");
    return new Map(orden.items.map((item) => [item.id, item.cantidad - item.recibida]));
  }
  const recepcion = orden.operaciones.find((op) => op.id === recepcionId && op.tipo === "recepcion");
  if (!recepcion) throw new HttpError(404, "Recepción de compra no encontrada");
  const disponibles = new Map(recepcion.items.map((item) => [item.itemId, item.cantidad]));
  for (const operacion of orden.operaciones.filter((op) => op.recepcionId === recepcionId)) {
    for (const item of operacion.items) disponibles.set(item.itemId, disponibles.get(item.itemId) - item.cantidad);
  }
  return disponibles;
}

async function registrarOperacion(req, res) {
  const datos = validar(operacionSchema, req.body);
  const esDevolucion = Boolean(datos.recepcionId);
  const orden = await prisma.$transaction(async (tx) => {
    const actual = await bloquearOrden(tx, req.params.id);
    const previa = actual.operaciones.find((op) => op.id === datos.id);
    if (previa) {
      const iguales = previa.recepcionId === (datos.recepcionId ?? null) && previa.documento === datos.documento &&
        previa.nota === datos.nota && previa.items.length === datos.items.length &&
        datos.items.every((it) => previa.items.some((otro) => otro.itemId === it.itemId && otro.cantidad === it.cantidad));
      if (!iguales) throw new HttpError(409, "El identificador ya corresponde a otra operación");
      return actual;
    }
    const disponibles = cantidadesDisponibles(actual, datos.recepcionId);
    const porId = new Map(actual.items.map((item) => [item.id, item]));
    const lineas = datos.items.map(({ itemId, cantidad }) => {
      const item = porId.get(itemId);
      if (!item || !disponibles.has(itemId)) throw new HttpError(400, "La línea no pertenece a la orden o recepción");
      if (cantidad > disponibles.get(itemId)) throw new HttpError(409, `Cantidad máxima para ${item.productoNombre}: ${disponibles.get(itemId)}`);
      return { item, cantidad };
    });
    // Las ventas, los conteos y los ajustes toman los bloqueos de productos en este orden.
    const productos = await bloquearProductos(tx, lineas.map(({ item }) => item.productoId));
    if (!esDevolucion && productos.some((producto) => !producto.activo || !producto.inventariable)) {
      throw new HttpError(409, "Activa el producto y su control de inventario antes de recibirlo");
    }
    const tipo = esDevolucion ? "devolucion" : "recepcion";
    const { items, ...operacion } = datos;
    await tx.operacionCompra.create({
      data: { ...operacion, ordenId: actual.id, usuarioNombre: req.user.nombre, items: { create: items } },
    });
    const cantidades = new Map(datos.items.map((item) => [item.itemId, item.cantidad]));
    for (const { item, cantidad } of lineas) {
      const delta = esDevolucion ? -cantidad : cantidad;
      if (esDevolucion && (await stockTotal(tx, item.productoId)) < cantidad) {
        throw new HttpError(409, `Stock insuficiente para devolver ${item.productoNombre}`);
      }
      const stock = await ajustarStockBodega(tx, actual.bodegaId, item.productoId, delta);
      validarStockTotal(await stockTotal(tx, item.productoId));
      await tx.movimientoStock.create({
        data: {
          productoId: item.productoId, bodegaId: actual.bodegaId, usuarioId: req.user.id,
          tipo: esDevolucion ? "salida" : "entrada", origen: esDevolucion ? "devolucion_compra" : "compra",
          cantidad, stockResultante: stock, operacionCompraId: datos.id,
          motivo: `OC #${actual.folio} · ${datos.documento}`,
        },
      });
    }
    const completa = actual.items.every((item) => item.recibida + (cantidades.get(item.id) ?? 0) === item.cantidad);
    const actualizada = await tx.ordenCompra.update({
      where: { id: actual.id },
      data: { estado: esDevolucion ? actual.estado : completa ? "recibida" : "parcial" },
      include: detalle,
    });
    await auditar(tx, req.user, actualizada, tipo, datos.documento);
    return conRecepciones(actualizada);
  }, { timeout: 15_000 });
  res.status(201).json(orden);
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, registrarOperacion };
