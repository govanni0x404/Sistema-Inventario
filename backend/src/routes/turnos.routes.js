const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/turnos.controller");

const router = Router();

// Caja necesita consultar, abrir y cerrar el turno aunque el rol no tenga la sección "turnos".
// El listado lo usa también Historial para su filtro por turno.
const operarTurno = requireSeccion("caja", "turnos");
const listarTurnos = requireSeccion("turnos", "historial");

router.get("/actual", operarTurno, asyncHandler(controller.actual));
router.get("/", listarTurnos, asyncHandler(controller.listar));
router.get("/:id", operarTurno, asyncHandler(controller.obtener));
router.post("/", operarTurno, asyncHandler(controller.abrir));
router.post("/:id/cerrar", operarTurno, asyncHandler(controller.cerrar));

module.exports = router;
