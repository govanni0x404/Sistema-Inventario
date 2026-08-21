const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/listasPrecio.controller");

const router = Router();

// Lectura abierta a cualquier usuario autenticado: se necesita para elegir lista de precios en Caja.
router.get("/", asyncHandler(controller.listar));
router.get("/:id/precios", asyncHandler(controller.listarPrecios));
router.post("/", requireSeccion("precios"), asyncHandler(controller.crear));
router.put("/:id", requireSeccion("precios"), asyncHandler(controller.actualizar));
router.delete("/:id", requireSeccion("precios"), asyncHandler(controller.eliminar));
router.put("/:id/precios/:productoId", requireSeccion("precios"), asyncHandler(controller.guardarPrecio));
router.delete("/:id/precios/:productoId", requireSeccion("precios"), asyncHandler(controller.quitarPrecio));
router.get("/:id/precios/:productoId/historial", requireSeccion("precios"), asyncHandler(controller.historialPrecio));

module.exports = router;
