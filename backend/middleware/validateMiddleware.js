const { body, validationResult } = require("express-validator");

/**
 * Reads the result of any preceding express-validator checks.
 * If validation errors exist, responds immediately with a 400 and the error list.
 * Otherwise passes control to the next handler.
 */
const checkErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * Validation chain for the signup route.
 * Enforces a valid email, a minimum password length, a recognised role,
 * and the presence of GPS coordinates.
 */
const validateSignup = [
  body("email").isEmail().withMessage("Please provide a valid email."),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters."),
  body("role")
    .isIn(["CLIENT", "WORKER"])
    .withMessage("Role must be either CLIENT or WORKER."),
  body("lat")
    .isFloat()
    .withMessage("Latitude is required and must be a number."),
  body("lng")
    .isFloat()
    .withMessage("Longitude is required and must be a number."),
  checkErrors,
];

/**
 * Validation chain for the signin route.
 * Enforces a valid email format and a non-empty password.
 */
const validateSignin = [
  body("email").isEmail().withMessage("Please provide a valid email."),
  body("password").notEmpty().withMessage("Password cannot be empty."),
  checkErrors,
];

module.exports = { validateSignup, validateSignin };
