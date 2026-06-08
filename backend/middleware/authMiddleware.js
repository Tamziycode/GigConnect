const jwt = require("jsonwebtoken");

/**
 * Middleware that verifies the JWT from the Authorization header.
 * Attaches the decoded payload ({ id, role }) to req.user on success.
 * Returns 401 if no token is present, 400 if the token is invalid or expired.
 */
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid Token" });
  }
};

module.exports = { verifyToken };
