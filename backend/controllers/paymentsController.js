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

module.exports = { initializeEscrow };
