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

/**
 * Authenticates an existing user by email and password.
 * Returns a signed JWT containing the user's id and role on success.
 *
 * @route POST /api/auth/signin
 * @access Public
 */
const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = users[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // user.role is extracted explicitly — encoding the full user object was a prior bug
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "3d" },
    );

    res.status(200).json({
      message: "Signin successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Signin error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Fetches a public user profile by ID.
 * Excludes sensitive fields such as password_hash from the response.
 *
 * @route GET /api/auth/users/:id
 * @access Private
 */
const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    const [users] = await pool.query(
      "SELECT id, role, name, email, title, location, lat, lng, created_at FROM users WHERE id = ?",
      [userId],
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user: users[0] });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res
      .status(500)
      .json({ message: "Internal server error while fetching profile" });
  }
};

module.exports = { signUp, signIn, getUserById };
