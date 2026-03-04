const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Test insert into SmsOutbox
router.get("/test-outbox", async (req, res) => {
  try {
    const row = await prisma.smsOutbox.create({
      data: {
        toPhone: "2547XXXXXXXX", // put your phone number here
        message: "Test Outbox Insert",
        status: "PENDING",
        scheduledFor: new Date(),
      },
    });

    res.json({ ok: true, row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// View last 20 outbox messages
router.get("/outbox", async (req, res) => {
  const rows = await prisma.smsOutbox.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json(rows);
});

module.exports = router;