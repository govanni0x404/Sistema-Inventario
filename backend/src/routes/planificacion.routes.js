const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const planificacion = require("../controllers/planificacion.controller");

const router = Router();
router.use(requireSeccion("planificacion"));
router.get("/", asyncHandler(planificacion.listar));
router.put("/:bodegaId/productos/:productoId/minimo", asyncHandler(planificacion.cambiarMinimo));

module.exports = router;
