const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// 1. Weekly Report (by region)
router.get("/weekly", async (req, res) => {
  try {
    const { region, userId, startDate, endDate } = req.query;

    let dateFilter;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({ error: "Invalid startDate or endDate" });
      }
      dateFilter = { gte: start, lte: end };
    }

    const jobs = await prisma.job.findMany({
      where: {
        scheduledDate: dateFilter,
        assignedTechnician: {
          id: userId ? Number(userId) : undefined,
          region: region || undefined,
        },
      },
      include: { assignedTechnician: { select: { id: true, name: true, phone: true, region: true } } },
      orderBy: { scheduledDate: "desc" },
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
    res.status(500).json({ error: "Failed to generate weekly report", details: err.message });
  }
});

// 2. Technician Job Report
router.get("/technician/:id", async (req, res) => {
  try {
    const technicianId = parseInt(req.params.id);
    const technician = await prisma.user.findUnique({
      where: { id: technicianId },
      include: { jobs: true },
    });
    if (!technician) return res.status(404).json({ error: "Technician not found" });
    res.json(technician);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch technician job report", details: err.message });
  }
});

// 3. Job History Report
router.get("/jobs/history", async (req, res) => {
  try {
    const { jobId } = req.query;
    if (!jobId) return res.status(400).json({ error: "jobId query parameter is required" });

    const history = await prisma.jobHistory.findMany({
      where: { jobId: parseInt(jobId) },
      orderBy: { createdAt: "asc" },
    });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch job history", details: err.message });
  }
});

// 4. Active Technicians (with session location)
router.get("/technicians/active", async (req, res) => {
  try {
    const activeSessions = await prisma.session.findMany({
      where: { active: true },
      include: {
        user: { select: { id: true, name: true, phone: true, region: true, role: true } },
      },
    });

    const technicians = activeSessions
      .filter(s => s.user.role === "TECHNICIAN")
      .map(s => ({
        id: s.user.id,
        name: s.user.name,
        phone: s.user.phone,
        region: s.user.region,
        latitude: s.latitude,
        longitude: s.longitude,
        lastLogin: s.loginTime,
        lastLogout: s.logoutTime || null,
      }));

    res.json(technicians);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch active technicians", details: err.message });
  }
});

// 5. Roll Call Summary (with GPS)
router.get("/rollcall", async (req, res) => {
  try {
    const { region, date } = req.query;

    const rollcalls = await prisma.rollCall.findMany({
      where: {
        region: region || undefined,
        date: date ? new Date(date) : undefined,
      },
      include: {
        presentUsers: { include: { user: { select: { id: true, name: true, phone: true, region: true } } } },
      },
    });

    res.json(rollcalls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch roll call summary", details: err.message });
  }
});

module.exports = router;
