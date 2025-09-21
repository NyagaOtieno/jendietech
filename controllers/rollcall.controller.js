const express = require("express");
const { checkIn, checkOut } = require("../controllers/rollcall.controller");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// Take roll call snapshot
router.post("/", async (req, res) => {
  try {
    const { region } = req.body;
    const presentUsers = await prisma.user.findMany({ where: { online: true, region } });

    const rollCall = await prisma.rollCall.create({
      data: {
        region,
        presentUsers: {
          create: presentUsers.map(u => ({ userId: u.id })),
        },
      },
      include: { presentUsers: { include: { user: true } } },
    });

    res.json(rollCall);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create roll call" });
  }
});

// Check-in technician
router.post("/checkin", checkIn);

// Check-out technician
router.post("/checkout", checkOut);

// Get roll call history
router.get("/", async (req, res) => {
  try {
    const { region, startDate, endDate } = req.query;

    const rollCalls = await prisma.rollCall.findMany({
      where: {
        region: region || undefined,
        date: startDate && endDate
          ? { gte: new Date(startDate), lte: new Date(endDate) }
          : undefined,
      },
      include: { presentUsers: { include: { user: true } } },
    });

    res.json(rollCalls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch roll call history" });
  }
});

module.exports = router;
