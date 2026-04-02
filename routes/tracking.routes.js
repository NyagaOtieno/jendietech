const express = require("express");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const router = express.Router();

router.get("/track/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const record = await prisma.jobTracking.findUnique({
      where: { token },
      include: {
        job: {
          include: {
            assignedTechnician: true,
          },
        },
      },
    });

    if (!record) return res.status(404).send("Invalid tracking link");

    // ✅ Update analytics
    await prisma.jobTracking.update({
      where: { token },
      data: {
        visits: { increment: 1 },
        lastVisitedAt: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    // ✅ Return full job data
    res.json({
      job: record.job,
      analytics: {
        visits: record.visits + 1,
      },
    });

  } catch (err) {
    console.error("❌ Tracking error:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;