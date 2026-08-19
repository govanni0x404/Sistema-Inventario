const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/clientes.controller");

const router = Router();

// Las lecturas quedan abiertas a cualquier usuario autenticado: Caja necesita poder
// buscar clientes aunque el rol no tenga habilitada la sección de gestión de Clientes.
router.get("/", asyncHandler(controller.listar));
router.get("/:id", asyncHandler(controller.obtener));
router.post("/", requireSeccion("clientes"), asyncHandler(controller.crear));
router.put("/:id", requireSeccion("clientes"), asyncHandler(controller.actualizar));
router.delete("/:id", requireSeccion("clientes"), asyncHandler(controller.eliminar));

module.exports = router;
