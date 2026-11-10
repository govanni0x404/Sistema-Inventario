const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const requireAdmin = require("../middleware/requireAdmin");
const controller = require("../controllers/negocio.controller");

const router = Router();

router.get("/", asyncHandler(controller.obtener));
router.put("/", requireAdmin, asyncHandler(controller.actualizar));

module.exports = router;
