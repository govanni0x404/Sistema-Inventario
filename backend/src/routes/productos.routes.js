const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/productos.controller");
const movimientos = require("../controllers/movimientosStock.controller");

const router = Router();

// El catálogo de productos queda abierto a cualquier usuario autenticado: Caja, Stock y
// Bodega necesitan poder leerlo aunque el rol no tenga habilitada la sección "Productos".
router.get("/", asyncHandler(controller.listar));
router.get("/:id", asyncHandler(controller.obtener));
router.post("/", requireSeccion("productos"), asyncHandler(controller.crear));
router.post("/importar", requireSeccion("productos"), asyncHandler(controller.importar));
router.put("/:id", requireSeccion("productos"), asyncHandler(controller.actualizar));
router.delete("/:id", requireSeccion("productos"), asyncHandler(controller.eliminar));

router.get("/:id/historial-precios", requireSeccion("precios"), asyncHandler(controller.historialPrecios));
router.get("/:id/movimientos", requireSeccion("bodega"), asyncHandler(movimientos.listar));
router.post("/:id/movimientos", requireSeccion("bodega"), asyncHandler(movimientos.crear));

module.exports = router;
