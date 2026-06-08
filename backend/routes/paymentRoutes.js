const express = require("express");
const router = express.Router();

const {
  initializeEscrow,
  releasePayment,
  refundPayment,
} = require("../controllers/paymentsController");

const { verifyToken } = require("../middleware/authMiddleware");

// All payment routes require an authenticated user
router.use(verifyToken);

router.post("/escrow", initializeEscrow);
router.post("/:id/release", releasePayment);
router.post("/:id/refund", refundPayment);

module.exports = router;
