const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// ------------------------
// Weekly report by region
// ------------------------
router.get("/weekly", async (req, res) => {
  const { region, userId, startDate, endDate } = req.query;

  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------
// Active technicians
// ------------------------
router.get("/technicians/active", async (req, res) => {
  try {
    const activeTechs = await prisma.user.findMany({
      where: { role: "TECHNICIAN", online: true },
      select: { id: true, name: true, phone: true, region: true, lastLogin: true, lastLogout: true },
    });
    res.json(activeTechs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------
// Technician job report
// ------------------------
router.get("/technician/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const jobs = await prisma.job.findMany({
      where: { technicianId: Number(id) },
      include: { assignedTechnician: true },
    });
    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------
// Job history report
// ------------------------
router.get("/jobs/history", async (req, res) => {
  const { jobId } = req.query;
  try {
    const history = await prisma.jobHistory.findMany({
      where: { jobId: Number(jobId) },
    });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------
// Roll call summary with GPS
// ------------------------
router.get("/rollcall", async (req, res) => {
  const { region, date } = req.query;
  try {
    const rollcalls = await prisma.rollCall.findMany({
      where: {
        region: region || undefined,
        date: date ? new Date(date) : undefined,
      },
      include: {
        presentUsers: {
          include: { user: true }
        }
      }
    });
    res.json(rollcalls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
