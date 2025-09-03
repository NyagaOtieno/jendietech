const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// Weekly tasks per person with filters
router.get("/weekly", async (req, res) => {
  const { region, userId, startDate, endDate } = req.query;

  const jobs = await prisma.job.findMany({
    where: {
      assignedTechnician: {
        id: userId ? Number(userId) : undefined,
        region: region || undefined,
      },
      scheduledDate: startDate && endDate ? {
        gte: new Date(startDate),
        lte: new Date(endDate),
      } : undefined,
    },
    include: { assignedTechnician: true },
  });

  const report = {};
  jobs.forEach(job => {
    const tech = job.assignedTechnician?.name || "Unassigned";
    if (!report[tech]) report[tech] = { total: 0, done: 0, pending: 0, escalated: 0 };
    report[tech].total++;
    if (job.status === "DONE") report[tech].done++;
    else if (job.status === "ESCALATED") report[tech].escalated++;
    else report[tech].pending++;
  });

  res.json(report);
});

module.exports = router;
