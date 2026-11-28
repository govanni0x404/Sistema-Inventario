const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/bodegas.controller");
const tomas = require("../controllers/tomasInventario.controller");
const movimientos = require("../controllers/movimientosStock.controller");

const router = Router();

// Lectura abierta a cualquier usuario autenticado: Stock/Bodega/Productos necesitan
// poder listar bodegas aunque el rol no tenga habilitada la sección "Bodega".
router.get("/", asyncHandler(controller.listar));
router.get("/kardex", requireSeccion("bodega"), asyncHandler(movimientos.kardex));
router.get("/:id/stock", asyncHandler(controller.stockDeBodega));
router.get("/:id/tomas-inventario", requireSeccion("bodega"), asyncHandler(tomas.listar));
router.get("/:id/tomas-inventario/:tomaId", requireSeccion("bodega"), asyncHandler(tomas.obtener));
router.post("/:id/tomas-inventario", requireSeccion("bodega"), asyncHandler(tomas.registrar));
router.post("/", requireSeccion("bodega"), asyncHandler(controller.crear));
router.post("/transferencias", requireSeccion("bodega"), asyncHandler(controller.transferir));
router.put("/:id", requireSeccion("bodega"), asyncHandler(controller.actualizar));
router.delete("/:id", requireSeccion("bodega"), asyncHandler(controller.eliminar));

module.exports = router;
