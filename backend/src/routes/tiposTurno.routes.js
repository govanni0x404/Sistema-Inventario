const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireAdmin = require("../middleware/requireAdmin");
const controller = require("../controllers/tiposTurno.controller");

const router = Router();

// Lectura abierta a cualquier usuario autenticado: se necesita para elegir tipo al abrir turno.
router.get("/", asyncHandler(controller.listar));
router.post("/", requireAdmin, asyncHandler(controller.crear));
router.put("/:id", requireAdmin, asyncHandler(controller.actualizar));
router.delete("/:id", requireAdmin, asyncHandler(controller.eliminar));

module.exports = router;
