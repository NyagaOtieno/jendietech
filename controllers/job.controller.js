const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @desc Start job (auto-create session with GPS)
 * @route POST /api/jobs/start/:jobId
 * @body { userId, latitude, longitude }
 */
exports.startJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, latitude, longitude } = req.body;

    // 1. Update job status to IN_PROGRESS
    const job = await prisma.job.update({
      where: { id: parseInt(jobId) },
      data: { status: "IN_PROGRESS" },
    });

    // 2. Auto-create a session log for tracking
    await prisma.session.create({
      data: {
        userId,
        loginTime: new Date(),
        active: true,
        latitude: latitude || null,
        longitude: longitude || null,
      },
    });

    res.json({ message: "Job started and session logged", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Update job (complete/escalate/etc.)
 * @route PUT /api/jobs/update/:jobId
 * @body { userId, status, governorSerial, governorStatus, latitude, longitude, clientName, clientPhone, remarks }
 */
exports.updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, status, governorSerial, governorStatus, latitude, longitude, clientName, clientPhone, remarks } = req.body;

    // Update job details
    const updatedJob = await prisma.job.update({
      where: { id: parseInt(jobId) },
      data: {
        status,
        governorSerial,
        governorStatus,
        clientName,
        clientPhone,
        remarks,
      },
    });

    // Update session GPS for real-time tracking
    await prisma.session.updateMany({
      where: { userId, active: true },
      data: { latitude: latitude || null, longitude: longitude || null },
    });

    res.json({ message: "Job updated and GPS logged", job: updatedJob });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
