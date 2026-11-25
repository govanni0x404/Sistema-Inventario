const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/dashboard.controller");
const requireSeccion = require("../middleware/requireSeccion");

const router = Router();

router.get("/", requireSeccion("dashboard"), asyncHandler(controller.resumen));

module.exports = router;
