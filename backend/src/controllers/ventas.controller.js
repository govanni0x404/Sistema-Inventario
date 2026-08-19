const { z } = require("zod");
const prisma = require("../lib/prisma");
const HttpError = require("../lib/HttpError");

const METODOS_PAGO = ["efectivo", "tarjeta", "transferencia"];

const ventaSchema = z.object({
  clienteId: z.string().uuid().optional().nullable(),
  metodoPago: z.enum(METODOS_PAGO, { errorMap: () => ({ message: "Método de pago inválido" }) }),
  items: z
    .array(
      z.object({
        productoId: z.string().uuid(),
        cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
      })
    )
    .min(1, "La venta debe tener al menos un producto"),
});

function serializeVenta(venta) {
  return {
    ...venta,
    total: Number(venta.total),
    items: venta.items.map((it) => ({
      ...it,
      precioUnitario: Number(it.precioUnitario),
      subtotal: Number(it.subtotal),
    })),
    devoluciones: venta.devoluciones?.map(serializeDevolucion),
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

// GET /api/ventas?fecha=YYYY-MM-DD&clienteId=&metodoPago=&turnoCajaId=
async function listar(req, res) {
  const { fecha, clienteId, metodoPago, turnoCajaId } = req.query;
  const where = {};

  if (clienteId) where.clienteId = String(clienteId);
  if (metodoPago) where.metodoPago = String(metodoPago);
  if (turnoCajaId) where.turnoCajaId = String(turnoCajaId);
  if (fecha) {
    const inicio = new Date(`${fecha}T00:00:00`);
    const fin = new Date(`${fecha}T23:59:59.999`);
    where.fecha = { gte: inicio, lte: fin };
  }

  const ventas = await prisma.venta.findMany({
    where,
    include: {
      cliente: { select: { id: true, nombre: true } },
      items: { include: { producto: { select: { id: true, nombre: true, sku: true } } } },
      turnoCaja: { select: { id: true, tipoTurno: { select: { nombre: true } } } },
    },
    orderBy: { fecha: "desc" },
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
  const { clienteId, metodoPago, items } = parsed.data;

  // Sumar cantidades si el mismo producto aparece más de una vez en el ticket.
  const cantidadPorProducto = new Map();
  for (const item of items) {
    cantidadPorProducto.set(item.productoId, (cantidadPorProducto.get(item.productoId) || 0) + item.cantidad);
  }

  if (clienteId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new HttpError(404, "Cliente no encontrado");
  }

  const venta = await prisma.$transaction(async (tx) => {
    const turnoAbierto = await tx.turnoCaja.findFirst({ where: { estado: "abierto" } });
    if (!turnoAbierto) {
      throw new HttpError(409, "Debes abrir un turno de caja antes de vender");
    }

    const productoIds = [...cantidadPorProducto.keys()];
    const productos = await tx.producto.findMany({ where: { id: { in: productoIds } } });

    let total = 0;
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

      const precioUnitario = Number(producto.precioVenta);
      const subtotal = precioUnitario * cantidad;
      total += subtotal;
      itemsData.push({ productoId, cantidad, precioUnitario, subtotal });

      // Guard atómico: si el stock cambió entre la lectura y este punto, la actualización no aplica.
      const resultado = await tx.producto.updateMany({
        where: { id: productoId, stock: { gte: cantidad } },
        data: { stock: { decrement: cantidad } },
      });
      if (resultado.count === 0) {
        throw new HttpError(409, `Stock insuficiente para "${producto.nombre}"`);
      }
      stockResultantePorProducto.set(productoId, producto.stock - cantidad);
    }

    const ventaCreada = await tx.venta.create({
      data: {
        clienteId: clienteId || null,
        metodoPago,
        total,
        usuarioId: req.user?.id,
        turnoCajaId: turnoAbierto.id,
        items: { create: itemsData },
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        items: { include: { producto: { select: { id: true, nombre: true, sku: true } } } },
        turnoCaja: { select: { id: true, tipoTurno: { select: { nombre: true } } } },
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
        },
      });
    }

    return ventaCreada;
  });

  res.status(201).json(serializeVenta(venta));
}

module.exports = { listar, obtener, crear };
