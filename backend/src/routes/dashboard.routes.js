const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/dashboard.controller");

const router = Router();

router.get("/", asyncHandler(controller.resumen));

module.exports = router;
