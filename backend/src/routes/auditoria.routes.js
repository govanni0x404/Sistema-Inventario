const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/auditoria.controller");

const router = Router();

router.get("/", asyncHandler(controller.listar));

module.exports = router;
