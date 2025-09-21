const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// 1. Weekly Report (by region)
exports.getWeeklyReport = async (req, res) => {
  try {
    const { region } = req.query;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const jobs = await prisma.job.findMany({
      where: {
        scheduledDate: { gte: sevenDaysAgo },
        assignedTechnician: region ? { region } : undefined,
      },
      include: {
        assignedTechnician: {
          select: { id: true, name: true, phone: true, region: true },
        },
      },
      orderBy: { scheduledDate: "desc" },
    });

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Technician Job Report
exports.getTechnicianJobReport = async (req, res) => {
  try {
    const technicianId = parseInt(req.params.id);
    const technician = await prisma.user.findUnique({
      where: { id: technicianId },
      include: {
        jobs: true,
      },
    });
    res.json(technician);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Job History Report
exports.getJobHistory = async (req, res) => {
  try {
    const { jobId } = req.query;
    const history = await prisma.jobHistory.findMany({
      where: { jobId: parseInt(jobId) },
      orderBy: { createdAt: "asc" },
    });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Active Technicians (with session location)
exports.getActiveTechnicians = async (req, res) => {
  try {
    const activeSessions = await prisma.session.findMany({
      where: { active: true },
      include: {
        user: {
          select: { id: true, name: true, phone: true, region: true, role: true },
        },
      },
    });

    const technicians = activeSessions.filter(
      (s) => s.user.role === "TECHNICIAN"
    );

    res.json(technicians);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. Roll Call Summary (with GPS)
exports.getRollCallSummary = async (req, res) => {
  try {
    const { region, date } = req.query;

    const rollcalls = await prisma.rollCall.findMany({
      where: {
        region: region || undefined,
        date: date ? new Date(date) : undefined,
      },
      include: {
        presentUsers: {
          include: {
            user: { select: { id: true, name: true, phone: true, region: true } },
          },
        },
      },
    });

    res.json(rollcalls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
