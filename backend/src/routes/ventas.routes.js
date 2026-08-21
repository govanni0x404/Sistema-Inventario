const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/ventas.controller");

const router = Router();

router.get("/", requireSeccion("historial"), asyncHandler(controller.listar));
router.get("/:id", requireSeccion("historial"), asyncHandler(controller.obtener));
router.post("/", requireSeccion("caja"), asyncHandler(controller.crear));
router.post("/:id/devolucion", requireSeccion("historial"), asyncHandler(controller.crearDevolucion));

module.exports = router;
