const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/proveedores.controller");

const router = Router();

// Las lecturas quedan abiertas a cualquier usuario autenticado (referencia usada en Productos).
router.get("/", asyncHandler(controller.listar));
router.get("/:id", asyncHandler(controller.obtener));
router.post("/", requireSeccion("proveedores"), asyncHandler(controller.crear));
router.put("/:id", requireSeccion("proveedores"), asyncHandler(controller.actualizar));
router.delete("/:id", requireSeccion("proveedores"), asyncHandler(controller.eliminar));

module.exports = router;
