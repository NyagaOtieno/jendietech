// controllers/job.controller.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { enqueueSms } = require("../services/smsOutbox");

// -----------------------------
// Helpers
// -----------------------------
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getTechnicianPhone(tx, technicianId) {
  const id = toInt(technicianId);
  if (!id) return null;

  const user = await tx.user.findUnique({
    where: { id },
    select: { phone: true, name: true },
  });

  if (!user?.phone) return null;
  return { phone: user.phone, name: user.name || "Technician" };
}

// -----------------------------
// Create Job
// POST /api/jobs
// -----------------------------
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

    if (!vehicleReg || !jobType) {
      return res.status(400).json({ message: "vehicleReg and jobType are required" });
    }

    const techId = toInt(technicianId);
    const sched = parseDateOrNull(scheduledDate);

    const result = await prisma.$transaction(async (tx) => {
      const existingJob = await tx.job.findFirst({
        where: { vehicleReg },
        orderBy: { createdAt: "desc" },
      });

      // Block duplicate pending job
      if (existingJob && existingJob.status === "PENDING" && status === "PENDING") {
        return { blocked: true, existingJob };
      }

      // Update instead of duplicate (if latest is pending and caller wants other status)
      if (existingJob && existingJob.status === "PENDING" && status !== "PENDING") {
        const updatedJob = await tx.job.update({
          where: { id: existingJob.id },
          data: {
            status,
            jobType,
            scheduledDate: sched || existingJob.scheduledDate,
            location: location ?? existingJob.location,
            technicianId: techId ?? existingJob.technicianId,
            clientName: clientName ?? existingJob.clientName,
            clientPhone: clientPhone ?? existingJob.clientPhone,
            notes: notes ?? existingJob.notes,
          },
        });

        return { updatedInstead: true, job: updatedJob };
      }

      // Create new job
      const newJob = await tx.job.create({
        data: {
          vehicleReg,
          jobType,
          status,
          scheduledDate: sched, // schema requires DateTime; if your schema requires non-null, validate earlier
          location: location ?? null,
          technicianId: techId,
          clientName: clientName ?? null,
          clientPhone: clientPhone ?? null,
          notes: notes ?? null,
        },
      });

      // Queue SMS to technician (JOB CREATED)
      const techInfo = await getTechnicianPhone(tx, newJob.technicianId);
      if (techInfo?.phone) {
        await enqueueSms(tx, {
          jobId: newJob.id,
          toPhone: techInfo.phone,
          // eventKey makes it "one SMS only" even if create is retried
          eventKey: `JOB_CREATED_TECH_${newJob.id}`,
          message: `New job assigned: ${newJob.vehicleReg} (${newJob.jobType}). Location: ${newJob.location || "N/A"}.`,
        });
      } else {
        console.log("⚠️ Technician phone missing. technicianId:", newJob.technicianId);
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
    return res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------
// Start Job
// POST /api/jobs/start/:jobId
// -----------------------------
exports.startJob = async (req, res) => {
  try {
    const jobId = toInt(req.params.jobId);
    const { userId, latitude, longitude } = req.body;

    if (!jobId) return res.status(400).json({ message: "Invalid jobId" });

    const job = await prisma.job.update({
      where: { id: jobId },
      data: { status: "IN_PROGRESS" },
    });

    await prisma.session.create({
      data: {
        userId,
        loginTime: new Date(),
        active: true,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
    });

    return res.json({ message: "Job started and session logged", job });
  } catch (err) {
    console.error("Error starting job:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------
// Update Job
// PUT /api/jobs/update/:jobId
// -----------------------------
exports.updateJob = async (req, res) => {
  try {
    const jobId = toInt(req.params.jobId);
    if (!jobId) return res.status(400).json({ message: "Invalid jobId" });

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
      const before = await tx.job.findUnique({ where: { id: jobId } });
      if (!before) return { notFound: true };

      const updatedJob = await tx.job.update({
        where: { id: jobId },
        data: {
          ...(status ? { status } : {}),
          governorSerial: governorSerial ?? before.governorSerial,
          governorStatus: governorStatus ?? before.governorStatus,
          clientName: clientName ?? before.clientName,
          clientPhone: clientPhone ?? before.clientPhone,
          remarks: remarks ?? before.remarks,
        },
      });

      await tx.session.updateMany({
        where: { userId, active: true },
        data: {
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        },
      });

      // ✅ Send customer SMS ONLY when status transitions to DONE (and only once)
      const becameDone = before.status !== "DONE" && updatedJob.status === "DONE";
      if (becameDone && updatedJob.clientPhone) {
        await enqueueSms(tx, {
          jobId: updatedJob.id,
          toPhone: updatedJob.clientPhone,
          eventKey: `JOB_DONE_CLIENT_${updatedJob.id}`, // one SMS only
          message: `Hello ${updatedJob.clientName || ""}, the job to service ${updatedJob.vehicleReg} is DONE. Thank you.`,
        });
      }

      return { job: updatedJob };
    });

    if (result.notFound) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.json({ message: "Job updated and GPS logged", job: result.job });
  } catch (err) {
    console.error("Error updating job:", err);
    return res.status(500).json({ message: "Server error" });
  }
};