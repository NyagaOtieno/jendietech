const express = require("express");
const { login, logout, register } = require("../controllers/auth.controller");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * ✅ Authentication Routes
 */

// Login
// POST /api/auth/login
router.post("/login", login);

// Logout
// POST /api/auth/logout
router.post("/logout", logout);

// Register (Admin only)
// POST /api/auth/register
router.post("/register", protect, adminOnly, register);

module.exports = router;
