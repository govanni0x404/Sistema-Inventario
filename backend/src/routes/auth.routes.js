const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("../middleware/asyncHandler");
const auth = require("../middleware/auth");
const controller = require("../controllers/auth.controller");

const router = Router();

// Frena fuerza bruta sobre credenciales: 10 intentos por IP cada 15 minutos. Los intentos
// exitosos no cuentan contra el límite (solo importa frenar reintentos fallidos).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Demasiados intentos. Espera unos minutos antes de volver a intentar." },
});

router.post("/login", loginLimiter, asyncHandler(controller.login));
router.get("/me", auth, asyncHandler(controller.me));
router.put("/password", auth, asyncHandler(controller.cambiarPassword));

module.exports = router;
