const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @desc Create job (prevent duplicates by vehicleReg)
 * @route POST /api/jobs
 * @body { vehicleReg, jobType, scheduledDate, location, technicianId, clientName, clientPhone, notes, status }
 */
exports.createJob = async (req, res) => {
  try {
    const {
      vehicleReg,
      jobType,
      scheduledDate,
      location,
      technicianId,
      clientName,
      clientPhone,
      notes,
      status = "PENDING",
    } = req.body;

    // 🔍 Check if a job exists for this vehicle
    const existingJob = await prisma.job.findFirst({
      where: { vehicleReg },
      orderBy: { createdAt: "desc" },
    });

    if (existingJob && existingJob.status === "PENDING") {
      if (status === "PENDING") {
        // ❌ Block duplicate
        return res.status(400).json({
          message: `A pending job already exists for vehicle ${vehicleReg}.`,
        });
      } else {
        // ✅ Update existing job instead of duplicating
        const updatedJob = await prisma.job.update({
          where: { id: existingJob.id },
          data: {
            status,
            jobType,
            scheduledDate: scheduledDate
              ? new Date(scheduledDate)
              : existingJob.scheduledDate,
            location,
            technicianId: technicianId
              ? parseInt(technicianId)
              : existingJob.technicianId,
            clientName: clientName || existingJob.clientName,
            clientPhone: clientPhone || existingJob.clientPhone,
            notes: notes || existingJob.notes,
          },
        });
        return res.json({
          message: `Job for ${vehicleReg} updated instead of duplicating.`,
          job: updatedJob,
        });
      }
    }

    // 🚀 Otherwise, create a new job
    const newJob = await prisma.job.create({
      data: {
        vehicleReg,
        jobType,
        status,
        scheduledDate: new Date(scheduledDate),
        location,
        technicianId: parseInt(technicianId),
        clientName,
        clientPhone,
        notes,
      },
    });

    res.status(201).json({ message: "Job created successfully", job: newJob });
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Start job (auto-create session with GPS)
 * @route POST /api/jobs/start/:jobId
 * @body { userId, latitude, longitude }
 */
exports.startJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, latitude, longitude } = req.body;

    // 1. Update job status
    const job = await prisma.job.update({
      where: { id: parseInt(jobId) },
      data: { status: "IN_PROGRESS" },
    });

    // 2. Auto-create a session log
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
    console.error("Error starting job:", err);
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
    const {
      userId,
      status,
      governorSerial,
      governorStatus,
      latitude,
      longitude,
      clientName,
      clientPhone,
      remarks,
    } = req.body;

    // ✅ Update job details
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

    // ✅ Update session GPS
    await prisma.session.updateMany({
      where: { userId, active: true },
      data: {
        latitude: latitude || null,
        longitude: longitude || null,
      },
    });

    res.json({ message: "Job updated and GPS logged", job: updatedJob });
  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).json({ message: "Server error" });
  }
};
