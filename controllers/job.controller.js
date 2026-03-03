const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { enqueueSms } = require("../services/smsOutbox");

// helper: fetch technician phone (adjust based on your schema)
async function getTechnicianPhone(tx, technicianId) {
  if (!technicianId) return null;

  // Option A: Technician model
  const tech = await tx.technician?.findUnique?.({
    where: { id: parseInt(technicianId) },
    select: { phone: true, name: true },
  }).catch(() => null);

  if (tech?.phone) return { phone: tech.phone, name: tech.name || "Technician" };

  // Option B: User model (if technician is a user)
  const user = await tx.user?.findUnique?.({
    where: { id: parseInt(technicianId) },
    select: { phone: true, name: true },
  }).catch(() => null);

  if (user?.phone) return { phone: user.phone, name: user.name || "Technician" };

  return null;
}

/**
 * @desc Create job (prevent duplicates by vehicleReg)
 * @route POST /api/jobs
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

    const result = await prisma.$transaction(async (tx) => {
      // 🔍 Check if a job exists for this vehicle
      const existingJob = await tx.job.findFirst({
        where: { vehicleReg },
        orderBy: { createdAt: "desc" },
      });

      // If pending exists and request also pending -> block
      if (existingJob && existingJob.status === "PENDING" && status === "PENDING") {
        return { blocked: true, existingJob };
      }

      // If pending exists but request says something else -> update instead
      if (existingJob && existingJob.status === "PENDING" && status !== "PENDING") {
        const updatedJob = await tx.job.update({
          where: { id: existingJob.id },
          data: {
            status,
            jobType,
            scheduledDate: scheduledDate ? new Date(scheduledDate) : existingJob.scheduledDate,
            location,
            technicianId: technicianId ? parseInt(technicianId) : existingJob.technicianId,
            clientName: clientName || existingJob.clientName,
            clientPhone: clientPhone || existingJob.clientPhone,
            notes: notes || existingJob.notes,
          },
        });

        // ✅ If you want SMS only on NEW job creation, do nothing here.
        // If you ALSO want to notify tech when a pending job is updated/assigned, uncomment:
        /*
        const techInfo = await getTechnicianPhone(tx, updatedJob.technicianId);
        if (techInfo?.phone) {
          await enqueueSms(tx, {
            to: techInfo.phone,
            message: `Job updated for ${updatedJob.vehicleReg}. Type: ${updatedJob.jobType}.`,
            purpose: "JOB_CREATED_TECH",
            refType: "Job",
            refId: updatedJob.id,
          });
        }
        */

        return { updatedInstead: true, job: updatedJob };
      }

      // 🚀 Otherwise, create a new job
      const newJob = await tx.job.create({
        data: {
          vehicleReg,
          jobType,
          status,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          location,
          technicianId: parseInt(technicianId),
          clientName,
          clientPhone,
          notes,
        },
      });

      // ✅ Queue SMS to technician (JOB CREATED)
      const techInfo = await getTechnicianPhone(tx, newJob.technicianId);
      if (techInfo?.phone) {
        await enqueueSms(tx, {
          to: techInfo.phone,
          message: `New job assigned: ${newJob.vehicleReg} (${newJob.jobType}). Location: ${newJob.location || "N/A"}.`,
          purpose: "JOB_CREATED_TECH",
          refType: "Job",
          refId: newJob.id,
        });
      }

      return { job: newJob };
    });

    if (result.blocked) {
      return res.status(400).json({
        message: `A pending job already exists for vehicle ${vehicleReg}.`,
        job: result.existingJob,
      });
    }

    if (result.updatedInstead) {
      return res.json({
        message: `Job for ${vehicleReg} updated instead of duplicating.`,
        job: result.job,
      });
    }

    return res.status(201).json({ message: "Job created successfully", job: result.job });
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Start job (auto-create session with GPS)
 * @route POST /api/jobs/start/:jobId
 */
exports.startJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId, latitude, longitude } = req.body;

    const job = await prisma.job.update({
      where: { id: parseInt(jobId) },
      data: { status: "IN_PROGRESS" },
    });

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

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.job.findUnique({
        where: { id: parseInt(jobId) },
      });
      if (!before) return { notFound: true };

      const updatedJob = await tx.job.update({
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

      await tx.session.updateMany({
        where: { userId, active: true },
        data: {
          latitude: latitude || null,
          longitude: longitude || null,
        },
      });

      // ✅ Send SMS ONLY when status transitions to DONE
      const becameDone = before.status !== "DONE" && updatedJob.status === "DONE";
      if (becameDone && updatedJob.clientPhone) {
        await enqueueSms(tx, {
          to: updatedJob.clientPhone,
          message: `Hi ${updatedJob.clientName || ""}, your job for ${updatedJob.vehicleReg} is DONE. Thank you.`,
          purpose: "JOB_DONE_CLIENT",
          refType: "Job",
          refId: updatedJob.id,
        });
      }

      return { job: updatedJob };
    });

    if (result.notFound) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json({ message: "Job updated and GPS logged", job: result.job });
  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).json({ message: "Server error" });
  }
};