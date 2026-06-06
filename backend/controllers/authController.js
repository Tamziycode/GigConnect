const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

/**
 * Registers a new user account.
 * Rejects duplicate emails before inserting. Returns a signed JWT on success.
 *
 * @route POST /api/auth/signup
 * @access Public
 */
const signUp = async (req, res) => {
  try {
    const { name, password, role, email, title, location, lat, lng } = req.body;

    const [existing] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (name, password_hash, role, email, title, location, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, hashedPassword, role, email, title, location, lat, lng],
    );

    const token = jwt.sign(
      { id: result.insertId, role },
      process.env.JWT_SECRET,
      { expiresIn: "3d" },
    );

    res.status(201).json({
      message: "Signup successful",
      user: { id: result.insertId, email, name, role },
      token,
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
