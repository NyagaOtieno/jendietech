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
    console.error("Weekly Report Error:", err);
    res.status(500).json({ error: "Failed to fetch weekly report", details: err.message });
  }
};

// 2. Technician Job Report
exports.getTechnicianJobReport = async (req, res) => {
  try {
    const technicianId = parseInt(req.params.id);
    if (isNaN(technicianId)) return res.status(400).json({ error: "Invalid technician ID" });

    const technician = await prisma.user.findUnique({
      where: { id: technicianId },
      include: {
        jobs: {
          include: {
            assignedTechnician: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    if (!technician) return res.status(404).json({ error: "Technician not found" });

    res.json(technician);
  } catch (err) {
    console.error("Technician Job Report Error:", err);
    res.status(500).json({ error: "Failed to fetch technician job report", details: err.message });
  }
};

// 3. Job History Report
exports.getJobHistory = async (req, res) => {
  try {
    const jobId = parseInt(req.query.jobId);
    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    const history = await prisma.jobHistory.findMany({
      where: { jobId },
      orderBy: { createdAt: "asc" },
    });

    res.json(history);
  } catch (err) {
    console.error("Job History Error:", err);
    res.status(500).json({ error: "Failed to fetch job history", details: err.message });
  }
};

// 4. Active Technicians (with session location)
exports.getActiveTechnicians = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { online: true, role: "TECHNICIAN" },
      select: {
        id: true,
        name: true,
        phone: true,
        region: true,
        lastLogin: true,
        lastLogout: true,
        sessions: {
          take: 1,
          orderBy: { loginTime: "desc" },
          select: { latitude: true, longitude: true, loginTime: true },
        },
      },
    });

    const result = users.map(u => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      region: u.region,
      lastLogin: u.lastLogin,
      lastLogout: u.lastLogout,
      latitude: u.sessions[0]?.latitude || null,
      longitude: u.sessions[0]?.longitude || null,
    }));

    res.json(result);
  } catch (err) {
    console.error("Active Technicians Error:", err);
    res.status(500).json({ error: "Failed to fetch active technicians", details: err.message });
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
    console.error("Roll Call Summary Error:", err);
    res.status(500).json({ error: "Failed to fetch roll call summary", details: err.message });
  }
};
