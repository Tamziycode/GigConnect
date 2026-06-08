const express = require("express");
const router = express.Router();

const {
  signUp,
  signIn,
  getUserById,
} = require("../controllers/authController");
const {
  validateSignup,
  validateSignin,
} = require("../middleware/validateMiddleware");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/signup", validateSignup, signUp);
router.post("/signin", validateSignin, signIn);
router.get("/users/:id", verifyToken, getUserById);

module.exports = router;
