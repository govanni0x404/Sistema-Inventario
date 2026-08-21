const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/movimientosCaja.controller");

const router = Router();

router.get("/", requireSeccion("caja"), asyncHandler(controller.listarActual));
router.post("/", requireSeccion("caja"), asyncHandler(controller.crear));

module.exports = router;
