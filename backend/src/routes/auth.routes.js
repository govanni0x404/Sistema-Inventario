const { Router } = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const auth = require("../middleware/auth");
const controller = require("../controllers/auth.controller");

const router = Router();

router.post("/login", asyncHandler(controller.login));
router.get("/me", auth, asyncHandler(controller.me));

module.exports = router;
