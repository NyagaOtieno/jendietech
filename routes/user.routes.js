const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const router = express.Router();

/**
 * ✅ Register user (email or phone allowed)
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, emailAddress, phone, phoneNumber, password, role, region } = req.body;

    // Normalize input
    const finalEmail = email || emailAddress || null;
    const finalPhone = phone || phoneNumber || null;

    if (!name || !password || (!finalEmail && !finalPhone)) {
      return res.status(400).json({ message: "Name, password, and either email or phone are required" });
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: finalEmail || undefined },
          { phone: finalPhone || undefined },
        ],
      },
    });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with that email/phone" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email: finalEmail,
        phone: finalPhone,
        password: hashedPassword,
        role: role || "TECHNICIAN",
        region,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({ message: "Failed to create user", error: error.message });
  }
});

/**
 * ✅ Get all users
 */
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, phone: true, role: true, region: true, online: true },
    });
    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/**
 * ✅ Login user (by email or phone)
 */
router.post("/login", async (req, res) => {
  try {
    const { email, emailAddress, phone, phoneNumber, password } = req.body;

    const identifier = email || emailAddress || phone || phoneNumber;
    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/phone and password are required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    await prisma.user.update({
      where: { id: user.id },
      data: { online: true, lastLogin: new Date() },
    });

    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({ message: "Failed to login", error: error.message });
  }
});

/**
 * ✅ Logout user
 */
router.post("/logout", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    await prisma.user.update({
      where: { id: userId },
      data: { online: false, lastLogout: new Date() },
    });

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("❌ Error logging out:", error);
    res.status(500).json({ message: "Failed to logout", error: error.message });
  }
});

module.exports = router;
