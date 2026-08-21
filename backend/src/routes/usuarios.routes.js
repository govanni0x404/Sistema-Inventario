const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/usuarios.controller");

const router = Router();

router.get("/", asyncHandler(controller.listar));
router.post("/", asyncHandler(controller.crear));
router.put("/:id", asyncHandler(controller.actualizar));
router.put("/:id/password", asyncHandler(controller.resetPassword));

module.exports = router;
