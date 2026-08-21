const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/bodegas.controller");

const router = Router();

// Lectura abierta a cualquier usuario autenticado: Stock/Bodega/Productos necesitan
// poder listar bodegas aunque el rol no tenga habilitada la sección "Bodega".
router.get("/", asyncHandler(controller.listar));
router.get("/:id/stock", asyncHandler(controller.stockDeBodega));
router.post("/", requireSeccion("bodega"), asyncHandler(controller.crear));
router.post("/transferencias", requireSeccion("bodega"), asyncHandler(controller.transferir));
router.put("/:id", requireSeccion("bodega"), asyncHandler(controller.actualizar));
router.delete("/:id", requireSeccion("bodega"), asyncHandler(controller.eliminar));

module.exports = router;
