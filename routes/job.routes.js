const express = require("express");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const fs = require("fs");

const prisma = new PrismaClient();
const router = express.Router();

// ✅ SMS imports (kept + improved usage)
const { queueSms, createFeedbackToken } = require("../services/sms/smsQueue");
const {
  normalizeKenyaPhone,
  buildJobDoneClientSms,
  buildFeedbackSms,
  buildJobAssignedTechnicianSms,
  buildJobDoneWithFeedbackSms,
} = require("../utils/sms");

// ✅ Tracking import (FIXED POSITION)
const { createJobTracking } = require("../services/jobTracking");

// ----------------------
// Multer storage
// ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// ----------------------
// CREATE JOB
// ----------------------
router.post("/", async (req, res) => {
  try {
    const {
      vehicleReg,
      jobType,
      scheduledDate,
      location,
      governorSerial,
      governorStatus,
      clientName,
      clientPhone,
      remarks,
      technicianId,
    } = req.body;

    if (!vehicleReg || !jobType || !scheduledDate || !technicianId) {
      return res.status(400).json({
        message: "vehicleReg, jobType, scheduledDate, and technicianId are required",
      });
    }

    const jobDate = new Date(scheduledDate);
    const startOfDay = new Date(jobDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(jobDate.setHours(23, 59, 59, 999));

    const existingJob = await prisma.job.findFirst({
      where: {
        vehicleReg,
        jobType,
        scheduledDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (existingJob) {
      return res.status(400).json({
        message: `Job already exists for ${vehicleReg} (${jobType}) on ${
          startOfDay.toISOString().split("T")[0]
        }`,
      });
    }

    const job = await prisma.job.create({
      data: {
        vehicleReg,
        jobType,
        status: "PENDING",
        scheduledDate: new Date(scheduledDate),
        location,
        governorSerial,
        governorStatus,
        clientName,
        clientPhone,
        remarks,
        assignedTechnician: {
          connect: { id: Number(technicianId) },
        },
      },
      include: { assignedTechnician: true },
    });

    // ✅ CREATE TRACKING LINK (FIXED - NO TOP LEVEL AWAIT)
    const trackingLink = await createJobTracking(job.id);

    // ✅ History
    await prisma.jobHistory.create({
      data: {
        jobId: job.id,
        status: "PENDING",
        remarks: "Job created",
        updatedBy: Number(technicianId),
      },
    });

    // ✅ Technician SMS
    const techPhone = normalizeKenyaPhone(job.assignedTechnician?.phone);
    if (techPhone) {
      await queueSms({
        jobId: job.id,
        toPhone: techPhone,
        message: buildJobAssignedTechnicianSms({
          technicianName: job.assignedTechnician?.name,
          vehicleReg: job.vehicleReg,
          jobType: job.jobType,
          scheduledDate: job.scheduledDate,
          location: job.location,
        }),
        scheduledFor: new Date(),
      });
    }

    res.status(201).json({
      message: "Job created successfully",
      data: job,
      trackingLink, // ✅ returned to frontend
    });

  } catch (err) {
    console.error("❌ Error creating job:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------------
// GET JOBS
// ----------------------
router.get("/", async (req, res) => {
  try {
    const {
      technicianId,
      region,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const filters = {
      technicianId: technicianId ? Number(technicianId) : undefined,
      status: status || undefined,
      scheduledDate:
        startDate && endDate
          ? { gte: new Date(startDate), lte: new Date(endDate) }
          : undefined,
      assignedTechnician: region ? { region } : undefined,
    };

    Object.keys(filters).forEach(
      (k) => filters[k] === undefined && delete filters[k]
    );

    const jobs = await prisma.job.findMany({
      where: filters,
      include: { assignedTechnician: true, photos: true, history: true },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { scheduledDate: "desc" },
    });

    const total = await prisma.job.count({ where: filters });

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
      jobs,
    });
  } catch (err) {
    console.error("❌ Error fetching jobs:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// UPDATE JOB
// ----------------------
router.put("/update/:id", upload.array("photos", 5), async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const {
      userId,
      status,
      governorSerial,
      governorStatus,
      clientName,
      clientPhone,
      remarks,
      latitude,
      longitude,
      technicianId,
      vehicleReg,
      jobType,
      scheduledDate,
    } = req.body;

    const jobExists = await prisma.job.findUnique({
      where: { id: jobId },
      include: { assignedTechnician: true },
    });

    if (!jobExists) return res.status(404).json({ message: "Job not found" });

    const newVehicleReg = vehicleReg || jobExists.vehicleReg;
    const newStatus = status || jobExists.status;

    // ✅ Duplicate check
    if (
      (vehicleReg && vehicleReg !== jobExists.vehicleReg) ||
      (status && status !== jobExists.status)
    ) {
      const duplicate = await prisma.job.findFirst({
        where: {
          vehicleReg: newVehicleReg,
          status: newStatus,
          NOT: { id: jobId },
        },
      });

      if (duplicate) {
        return res.status(400).json({
          message: `Duplicate job exists for ${newVehicleReg} with status ${newStatus}`,
        });
      }
    }

    const technicianChanged =
      technicianId &&
      Number(technicianId) !== jobExists.assignedTechnician?.id;

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        vehicleReg: newVehicleReg,
        jobType: jobType || jobExists.jobType,
        scheduledDate: scheduledDate
          ? new Date(scheduledDate)
          : jobExists.scheduledDate,
        assignedTechnician: technicianId
          ? { connect: { id: Number(technicianId) } }
          : undefined,
        status: newStatus,
        governorSerial: governorSerial || jobExists.governorSerial,
        governorStatus: governorStatus || jobExists.governorStatus,
        clientName: clientName || jobExists.clientName,
        clientPhone: clientPhone || jobExists.clientPhone,
        remarks: remarks || jobExists.remarks,
      },
      include: { assignedTechnician: true },
    });

    // ✅ Technician change SMS
    if (technicianChanged) {
      const techPhone = normalizeKenyaPhone(updatedJob.assignedTechnician?.phone);
      if (techPhone) {
        await queueSms({
          jobId,
          toPhone: techPhone,
          message: buildJobAssignedTechnicianSms({
            technicianName: updatedJob.assignedTechnician?.name,
            vehicleReg: updatedJob.vehicleReg,
            jobType: updatedJob.jobType,
            scheduledDate: updatedJob.scheduledDate,
            location: updatedJob.location,
          }),
          scheduledFor: new Date(),
        });
      }
    }

    // ✅ CLIENT SMS (COMBINED)
    const oldStatus = String(jobExists.status).toUpperCase();
    const newStatusUpper = String(newStatus).toUpperCase();

    if (oldStatus !== "DONE" && newStatusUpper === "DONE") {
      const to = normalizeKenyaPhone(updatedJob.clientPhone);

      if (to) {
        const token = await createFeedbackToken(jobId);
        const base = String(process.env.APP_PUBLIC_URL || "").replace(/\/+$/, "");
        const link = `${base}/r/${token}`;

        await queueSms({
          jobId,
          toPhone: to,
          message: buildJobDoneWithFeedbackSms({
            clientName: updatedJob.clientName,
            vehicleReg: updatedJob.vehicleReg,
            jobType: updatedJob.jobType,
            feedbackLink: link,
          }),
          scheduledFor: new Date(),
        });
      }
    }

    res.json({ message: "Job updated successfully", job: updatedJob });

  } catch (err) {
    console.error("❌ Error updating job:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------------
// DELETE JOB
// ----------------------
router.delete("/:id", async (req, res) => {
  try {
    const jobId = Number(req.params.id);

    const photos = await prisma.photo.findMany({ where: { jobId } });

    photos.forEach((photo) => {
      try {
        if (fs.existsSync(photo.url)) fs.unlinkSync(photo.url);
      } catch (e) {
        console.warn("⚠️ Failed to delete file:", photo.url);
      }
    });

    await prisma.jobHistory.deleteMany({ where: { jobId } });
    await prisma.photo.deleteMany({ where: { jobId } });
    await prisma.job.delete({ where: { id: jobId } });

    res.json({ message: "Job and associated data deleted successfully" });

  } catch (err) {
    console.error("❌ Error deleting job:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;