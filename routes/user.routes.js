const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const router = express.Router();

// ✅ Create a new user
router.post("/", async (req, res) => {
  try {
    const { name, email, password, role, region } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        region,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// ✅ Get all users
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, region: true, online: true },
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// ✅ Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });

    // Update online status + lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { online: true, lastLogin: new Date() },
    });

    res.json({ message: "Login successful", user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Failed to login" });
  }
});

// ✅ Logout user
router.post("/logout", async (req, res) => {
  try {
    const { userId } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: { online: false, lastLogout: new Date() },
    });

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ message: "Failed to logout" });
  }
});

module.exports = router;
