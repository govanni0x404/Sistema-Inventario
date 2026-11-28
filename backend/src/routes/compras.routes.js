const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const compras = require("../controllers/compras.controller");

const router = Router();
router.use(requireSeccion("compras"));
router.get("/", asyncHandler(compras.listar));
router.get("/:id", asyncHandler(compras.obtener));
router.post("/", asyncHandler(compras.crear));
router.put("/:id", asyncHandler(compras.actualizar));
router.post("/:id/estado", asyncHandler(compras.cambiarEstado));
router.post("/:id/operaciones", asyncHandler(compras.registrarOperacion));

module.exports = router;
