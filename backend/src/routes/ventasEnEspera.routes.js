const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireSeccion = require("../middleware/requireSeccion");
const controller = require("../controllers/ventasEnEspera.controller");

const router = Router();

router.get("/", requireSeccion("caja"), asyncHandler(controller.listar));
router.post("/", requireSeccion("caja"), asyncHandler(controller.crear));
router.delete("/:id", requireSeccion("caja"), asyncHandler(controller.eliminar));

module.exports = router;
