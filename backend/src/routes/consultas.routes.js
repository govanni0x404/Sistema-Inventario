const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/consultas.controller");

const router = Router();

router.get("/productos-top", requireSeccion("consultas"), asyncHandler(controller.productosTop));
router.get("/ventas-por-metodo", requireSeccion("consultas"), asyncHandler(controller.ventasPorMetodo));
router.get("/ventas-por-usuario", requireSeccion("consultas"), asyncHandler(controller.ventasPorUsuario));
router.get("/productos-margen", requireSeccion("consultas"), asyncHandler(controller.productosMargen));

module.exports = router;
