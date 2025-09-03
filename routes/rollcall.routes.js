const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// Take roll call snapshot
router.post("/", async (req, res) => {
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
});

// Get roll call history
router.get("/", async (req, res) => {
  const { region, startDate, endDate } = req.query;

  const rollCalls = await prisma.rollCall.findMany({
    where: {
      region: region || undefined,
      date: startDate && endDate ? {
        gte: new Date(startDate),
        lte: new Date(endDate),
      } : undefined,
    },
    include: { presentUsers: { include: { user: true } } },
  });

  res.json(rollCalls);
});

module.exports = router;
