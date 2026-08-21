const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireAdmin = require("../middleware/requireAdmin");
const controller = require("../controllers/categorias.controller");

const router = Router();

// Lectura abierta a cualquier usuario autenticado: se necesita para elegir categoría al crear/editar un producto.
router.get("/", asyncHandler(controller.listar));
router.post("/", requireAdmin, asyncHandler(controller.crear));
router.put("/:id", requireAdmin, asyncHandler(controller.actualizar));
router.delete("/:id", requireAdmin, asyncHandler(controller.eliminar));

module.exports = router;
