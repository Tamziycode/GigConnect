const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// --- Global Middleware ---
app.use(cors());
app.use(express.json());

// --- Routers ---
const authRoutes = require("./routes/authRoutes");
const jobRoutes = require("./routes/jobRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// --- Route Mounting ---
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/payments", paymentRoutes);

// --- Global Error Handler ---
// Catches any unhandled errors that propagate out of route handlers.
// In production, the raw error message is hidden from the response.
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({
    message: "Something went critically wrong.",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
});

// --- Server Start ---
// Conditional so the app can be imported by the test suite without binding a port
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`GigConnect server running on port ${PORT}`);
  });
}

module.exports = app;
