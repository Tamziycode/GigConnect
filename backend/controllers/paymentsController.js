const crypto = require("crypto");
const pool = require("../db");

// POST /api/payments/escrow
const initializeEscrow = async (req, res) => {
  try {
    const { jobId, amount } = req.body;

    const txnRef = `GIG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const amountInKobo = amount * 100;

    const MAC_KEY = process.env.INTERSWITCH_MAC_KEY;
    const redirectUrl = "http://localhost:5000/payment-callback"; // Where Interswitch sends the user after paying
    const productId = process.env.INTERSWITCH_PRODUCT_ID;

    const stringToHash = `${txnRef}${productId}1${amountInKobo}${redirectUrl}${MAC_KEY}`;

    const hash = crypto.createHash("sha512").update(stringToHash).digest("hex");

    await pool.query(
      `INSERT INTO payments (job_id, amount, status, interswitch_ref) 
       VALUES (?, ?, 'HELD_IN_ESCROW', ?)`,
      [jobId, amount, txnRef],
    );

    res.status(200).json({
      message: "Escrow initialized",
      paymentData: {
        txnRef,
        amount: amountInKobo,
        hash,
        productId,
        redirectUrl,
      },
    });
  } catch (error) {
    console.error("Escrow Error:", error);
    res.status(500).json({ message: "Failed to initialize payment" });
  }
};

const releasePayment = async (req, res) => {
  try {
    const jobId = req.params.id;
    // 1. Verify the job is completed AND both parties checked in
    const [jobs] = await pool.query(
      "SELECT job_status, client_checkin, worker_checkin FROM jobs WHERE id = ?",
      [jobId],
    );

    if (jobs.length === 0) {
      return res.status(404).json({ message: "Job not found." });
    }

    if (jobs[0].job_status !== "COMPLETED") {
      return res.status(400).json({
        message: "Cannot release funds. Job must be marked COMPLETED first.",
      });
    }

    if (!jobs[0].client_checkin || !jobs[0].worker_checkin) {
      return res.status(403).json({
        message:
          "Cannot release funds. Both client and worker must complete GPS check-in.",
      });
    }
    // Check if the funds are currently in escrow
    const [payments] = await pool.query(
      "SELECT id, amount, status FROM payments WHERE job_id = ?",
      [jobId],
    );

    if (payments.length === 0 || payments[0].status !== "HELD_IN_ESCROW") {
      return res
        .status(400)
        .json({ message: "No funds held in escrow for this job." });
    }

    // Update the payment status to RELEASED
    await pool.query(
      "UPDATE payments SET status = 'RELEASED' WHERE job_id = ?",
      [jobId],
    );

    res.status(200).json({
      message: "Funds successfully released to the worker.",
      amount_released: payments[0].amount,
    });
  } catch (error) {
    console.error("Release Payment Error:", error);
    res
      .status(500)
      .json({ message: "Internal server error during payment release" });
  }
};

module.exports = { initializeEscrow, releasePayment };
