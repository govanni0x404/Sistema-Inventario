const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../middleware/asyncHandler");
const controller = require("../controllers/setup.controller");

const router = Router();

// Ruta pública: se limita para que no se pueda martillar (aunque solo funciona sin usuarios).
const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos." },
});

router.get("/", asyncHandler(controller.estado));
router.post("/", setupLimiter, asyncHandler(controller.configurar));

module.exports = router;
