const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  const { userId } = req.body;
  const user = await prisma.user.update({
    where: { id: Number(userId) },
    data: { online: true, lastLogin: new Date() },
  });

  const session = await prisma.session.create({
    data: { userId: Number(userId) },
  });

  res.json({ message: "Login success", user, session });
});

// Logout
router.post("/logout", async (req, res) => {
  const { userId } = req.body;
  await prisma.user.update({
    where: { id: Number(userId) },
    data: { online: false, lastLogout: new Date() },
  });

  await prisma.session.updateMany({
    where: { userId: Number(userId), active: true },
    data: { active: false, logoutTime: new Date() },
  });

  res.json({ message: "Logout success" });
});

// Get online users
router.get("/online", async (req, res) => {
  const users = await prisma.user.findMany({ where: { online: true } });
  res.json(users);
});

module.exports = router;
