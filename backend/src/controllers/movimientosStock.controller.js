const { z } = require("zod");
const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");
const { resolverRango } = require("../lib/rangoFechas");
const { bodegaPrincipal, ajustarStockBodega, bloquearProductos, stockTotal, validarStockTotal } = require("../lib/stockBodega");
const { registrarAuditoria } = require("../lib/auditoria");

const causasMerma = ["vencimiento", "dano", "perdida", "contaminacion", "otra"];
const movimientoSchema = z.object({
  tipo: z.enum(["entrada", "salida"], { errorMap: () => ({ message: "Tipo inválido" }) }),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0").max(2_147_483_647),
  motivo: z.string().trim().max(500, "El motivo no puede superar los 500 caracteres").optional().nullable(),
  bodegaId: z.string().uuid().optional(),
  causaMerma: z.enum(causasMerma).optional(),
  operacionId: z.string().uuid().optional(),
}).refine((data) => !data.causaMerma || (data.tipo === "salida" && data.operacionId &&
  (data.causaMerma !== "otra" || data.motivo?.trim())), { path: ["motivo"], message: "Registra la merma como salida y describe la causa si es Otra" });

// GET /api/productos/:id/movimientos — los más recientes, con tope para productos con
// años de historia.
const LIMITE_MOVIMIENTOS = 500;
const origenes = ["manual", "venta", "devolucion", "transferencia", "inventario", "ajuste", "compra", "devolucion_compra", "saldo_inicial", "merma"];
const filtroKardex = z.object({
  bodegaId: z.string().uuid().optional(),
  productoId: z.string().uuid().optional(),
  tipo: z.enum(["entrada", "salida"]).optional(),
  origen: z.enum(origenes).optional(),
  causaMerma: z.enum(causasMerma).optional(),
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).max(100_000).default(1),
  exportar: z.enum(["true"]).optional(),
});
const KardexInclude = {
  producto: { select: { id: true, nombre: true, codigoBarras: true, unidad: { select: { nombre: true } } } },
  bodega: { select: { id: true, nombre: true } },
  usuario: { select: { id: true, nombre: true } },
  operacionCompra: { select: { ordenId: true, documento: true } },
};

async function kardex(req, res) {
  const parsed = filtroKardex.safeParse(req.query);
  if (!parsed.success) throw new HttpError(400, "Revisa los filtros del kárdex");
  const { rangoInicio, rangoFin } = resolverRango(req.query, new Date());
  const { q, pagina, exportar, ...filtros } = parsed.data;
  const porPagina = 50;
  const texto = q?.replace(/[\\%_]/g, "\\$&");
  const where = {
    ...filtros,
    fecha: { gte: rangoInicio, lte: rangoFin },
    ...(texto ? { producto: { OR: [
      { nombre: { contains: texto, mode: "insensitive" } },
      { codigoBarras: { contains: texto, mode: "insensitive" } },
    ] } } : {}),
  };
  const args = { where, include: KardexInclude, orderBy: [{ fecha: "desc" }, { id: "desc" }] };
  if (exportar) return res.json(await prisma.movimientoStock.findMany(args));
  const [resumen, filas, gruposMerma] = await prisma.$transaction([
    prisma.movimientoStock.groupBy({ by: ["tipo"], where, _count: { _all: true }, _sum: { cantidad: true } }),
    prisma.movimientoStock.findMany({ ...args, skip: (pagina - 1) * porPagina, take: porPagina }),
    ...(filtros.origen === "merma" ? [prisma.movimientoStock.groupBy({ by: ["costoMerma"], where, _sum: { cantidad: true } })] : []),
  ], { isolationLevel: "RepeatableRead" });
  res.json({
    total: resumen.reduce((total, grupo) => total + grupo._count._all, 0),
    entradas: resumen.find((grupo) => grupo.tipo === "entrada")?._sum.cantidad ?? 0,
    salidas: resumen.find((grupo) => grupo.tipo === "salida")?._sum.cantidad ?? 0,
    porPagina,
    filas,
    ...(gruposMerma && { valorMermas: gruposMerma.reduce((total, grupo) =>
      total.plus(grupo.costoMerma.mul(grupo._sum.cantidad)), new Prisma.Decimal(0)).toFixed(2) }),
  });
}

async function listar(req, res) {
  const producto = await prisma.producto.findUnique({ where: { id: req.params.id } });
  if (!producto) throw new HttpError(404, "Producto no encontrado");

  const movimientos = await prisma.movimientoStock.findMany({
    where: { productoId: req.params.id },
    include: {
      usuario: { select: { id: true, nombre: true } },
      operacionCompra: { select: { ordenId: true } },
    },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    take: LIMITE_MOVIMIENTOS,
  });

  res.json(movimientos.map(({ operacionCompra, ...movimiento }) => ({
    ...movimiento,
    ordenCompraId: operacionCompra?.ordenId ?? null,
  })));
}

// POST /api/productos/:id/movimientos — entrada o salida de bodega, con registro atómico.
async function crear(req, res) {
  const parsed = movimientoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { tipo, cantidad, motivo, bodegaId: bodegaIdSolicitada, causaMerma, operacionId } = parsed.data;
  const productoId = req.params.id;

  const movimiento = await prisma.$transaction(async (tx) => {
    const bodegaId = bodegaIdSolicitada || (await bodegaPrincipal(tx)).id;
    const incluirUsuario = { usuario: { select: { id: true, nombre: true } } };
    if (causaMerma) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(72100006, hashtext(${operacionId}))::text`;
      const previa = await tx.movimientoStock.findUnique({ where: { id: operacionId }, include: incluirUsuario });
      if (previa) {
        if (previa.usuarioId !== req.user.id || previa.productoId !== productoId || previa.bodegaId !== bodegaId ||
            previa.cantidad !== cantidad || previa.causaMerma !== causaMerma || previa.motivo !== (motivo || null)) {
          throw new HttpError(409, "El identificador ya se usó para otra operación");
        }
        return previa;
      }
    }
    await bloquearProductos(tx, [productoId]);
    const producto = await tx.producto.findUnique({ where: { id: productoId } });
    if (!producto) throw new HttpError(404, "Producto no encontrado");
    if (causaMerma && !producto.inventariable) throw new HttpError(409, "Este producto no tiene control de inventario");
    const delta = tipo === "salida" ? -cantidad : cantidad;

    if (tipo === "salida") {
      const disponible = await stockTotal(tx, productoId);
      if (disponible < cantidad) {
        throw new HttpError(409, `Stock insuficiente (disponible: ${disponible})`);
      }
    }

    await ajustarStockBodega(tx, bodegaId, productoId, delta);

    const stockResultante = validarStockTotal(await stockTotal(tx, productoId));

    const creado = await tx.movimientoStock.create({
      data: {
        ...(causaMerma && { id: operacionId, causaMerma, costoMerma: producto.precioCompra }),
        productoId,
        tipo,
        origen: causaMerma ? "merma" : "manual",
        cantidad,
        stockResultante,
        motivo: motivo || null,
        usuarioId: req.user?.id,
        bodegaId,
      },
      include: incluirUsuario,
    });
    if (causaMerma) await registrarAuditoria(tx, {
      accion: "merma_registrada", usuarioId: req.user.id, detalle: `${producto.nombre} · ${cantidad} unidades`,
    });
    return creado;
  });

  res.status(201).json(movimiento);
}

module.exports = { listar, crear, kardex };
