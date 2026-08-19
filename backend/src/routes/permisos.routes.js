const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/permisos.controller");

const router = Router();

router.get("/", asyncHandler(controller.listar));
router.put("/", asyncHandler(controller.actualizar));

module.exports = router;
