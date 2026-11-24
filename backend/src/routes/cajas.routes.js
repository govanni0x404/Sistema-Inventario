const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireAdmin = require("../middleware/requireAdmin");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/cajas.controller");

const router = Router();
router.get("/", requireSeccion("caja", "turnos", "historial"), asyncHandler(controller.listar));
router.post("/", requireAdmin, asyncHandler(controller.guardar));
router.put("/:id", requireAdmin, asyncHandler(controller.guardar));

module.exports = router;
