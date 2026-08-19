const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const movimientoSchema = z.object({
  tipo: z.enum(["entrada", "salida"], { errorMap: () => ({ message: "Tipo inválido" }) }),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
  motivo: z.string().trim().optional().nullable(),
});

// GET /api/productos/:id/movimientos
async function listar(req, res) {
  const producto = await prisma.producto.findUnique({ where: { id: req.params.id } });
  if (!producto) throw new HttpError(404, "Producto no encontrado");

  const movimientos = await prisma.movimientoStock.findMany({
    where: { productoId: req.params.id },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  res.json(movimientos);
}

// POST /api/productos/:id/movimientos — entrada o salida de bodega, con registro atómico.
async function crear(req, res) {
  const parsed = movimientoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", detalles: parsed.error.flatten() });
  }
  const { tipo, cantidad, motivo } = parsed.data;
  const productoId = req.params.id;

  const movimiento = await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUnique({ where: { id: productoId } });
    if (!producto) throw new HttpError(404, "Producto no encontrado");

    if (tipo === "salida") {
      if (producto.stock < cantidad) {
        throw new HttpError(409, `Stock insuficiente (disponible: ${producto.stock})`);
      }
      const resultado = await tx.producto.updateMany({
        where: { id: productoId, stock: { gte: cantidad } },
        data: { stock: { decrement: cantidad } },
      });
      if (resultado.count === 0) {
        throw new HttpError(409, `Stock insuficiente (disponible: ${producto.stock})`);
      }
    } else {
      await tx.producto.update({ where: { id: productoId }, data: { stock: { increment: cantidad } } });
    }

    const actualizado = await tx.producto.findUnique({ where: { id: productoId } });

    return tx.movimientoStock.create({
      data: {
        productoId,
        tipo,
        origen: "manual",
        cantidad,
        stockResultante: actualizado.stock,
        motivo: motivo || null,
        usuarioId: req.user?.id,
      },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
  });

  res.status(201).json(movimiento);
}

module.exports = { listar, crear };
