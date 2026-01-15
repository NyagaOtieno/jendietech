const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const router = express.Router();
const { isValidKenyanPhone, normalizeKenyanPhone } = require("../utils/phone.util");

/**
 * Login User
 */
router.post("/login", async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email or phone and password are required",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          email ? { email: email.trim() } : undefined,
          phone ? { phone: phone.toString().trim() } : undefined,
        ].filter(Boolean),
      },
    });

    if (!user)
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials" });

    await prisma.user.update({
      where: { id: user.id },
      data: { online: true, lastLogin: new Date() },
    });

    return res.json({
      status: "success",
      message: "Login successful",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        region: user.region,
      },
    });
  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to login",
      error: error.message,
    });
  }
});

/**
 * Logout User
 */
router.post("/logout", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId)
      return res
        .status(400)
        .json({ status: "error", message: "User ID required" });

    await prisma.user.update({
      where: { id: userId },
      data: { online: false, lastLogout: new Date() },
    });

    return res.json({ status: "success", message: "Logout successful" });
  } catch (error) {
    console.error("❌ Error logging out:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to logout",
      error: error.message,
    });
  }
});

/**
 * Get All Users
 */
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        region: true,
        online: true,
        lastLogin: true,
        lastLogout: true,
      },
    });
    return res.json({ status: "success", data: users });
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch users" });
  }
});

/**
 * Create User safely
 */

exports.createUser = async (req, res) => {
  try {
    let { name, email, phone, password, role, region } = req.body;

    email = email?.toString().trim() || null;
    phone = phone?.toString().trim() || null;

    if (!name || !password || (!email && !phone)) {
      return res.status(400).json({
        status: "error",
        message: "Name, password, and at least email or phone are required",
      });
    }

    // Validate and normalize phone
    if (phone) {
      if (!isValidKenyanPhone(phone)) {
        return res.status(400).json({
          status: "error",
          message:
            "Invalid phone format. Use +2547XXXXXXXX, +2541XXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX",
        });
      }
      phone = normalizeKenyanPhone(phone);
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          phone ? { phone } : undefined,
        ].filter(Boolean),
      },
    });

    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "User already exists with email or phone",
      });
    }

    // Hash password
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: role || "TECHNICIAN",
        region: region || null,
      },
    });

    return res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        region: user.region,
      },
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    if (error.code === "P2002") {
      return res.status(400).json({
        status: "error",
        message: "Email or phone already exists",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to create user",
      error: error.message,
    });
  }
};


module.exports = router;
