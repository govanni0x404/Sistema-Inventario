const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/turnos.controller");

const router = Router();

router.get("/actual", asyncHandler(controller.actual));
router.get("/", asyncHandler(controller.listar));
router.get("/:id", asyncHandler(controller.obtener));
router.post("/", asyncHandler(controller.abrir));
router.post("/:id/cerrar", asyncHandler(controller.cerrar));

module.exports = router;
