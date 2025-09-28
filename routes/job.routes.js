const express = require("express");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const path = require("path");

const prisma = new PrismaClient();
const router = express.Router();

// Setup file storage for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

/**
 * Create a new job safely
 */
router.post("/", async (req, res) => {
  try {
    const {
      vehicleReg,
      jobType,
      status,
      scheduledDate,
      location,
      governorSerial,
      governorStatus,
      clientName,
      clientPhone,
      remarks,
      photoUrl,
      clientSignature,
      technicianId,
    } = req.body;

    // Build jobData object only with defined fields
    const jobData = {
      vehicleReg,
      jobType,
      status: status || "PENDING",
      scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      location,
      governorSerial,
      governorStatus,
      clientName,
      clientPhone,
      remarks,
      photoUrl,
      clientSignature,
      technicianId: technicianId ? Number(technicianId) : undefined,
    };

    const job = await prisma.job.create({ data: jobData });
    res.status(201).json({ message: "Job created successfully", data: job });
  } catch (err) {
    console.error("❌ Error creating job:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/**
 * Get jobs with filters + include photos and history
 */
router.get("/", async (req, res) => {
  try {
    const { technicianId, region, status, startDate, endDate } = req.query;

    const jobs = await prisma.job.findMany({
      where: {
        technicianId: technicianId ? Number(technicianId) : undefined,
        status: status || undefined,
        scheduledDate:
          startDate && endDate
            ? { gte: new Date(startDate), lte: new Date(endDate) }
            : undefined,
        assignedTechnician: region ? { region } : undefined,
      },
      include: { assignedTechnician: true, photos: true, history: true },
    });

    res.json(jobs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Start a job (mark IN_PROGRESS + create session with GPS)
 */
router.post("/start/:id", async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const { userId, latitude, longitude } = req.body;

    const job = await prisma.job.update({
      where: { id: jobId },
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

    // Log job history
    await prisma.jobHistory.create({
      data: {
        jobId,
        status: "IN_PROGRESS",
        remarks: "Job started",
        latitude: latitude || null,
        longitude: longitude || null,
        updatedBy: userId,
      },
    });

    res.json({ message: "Job started successfully", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Update job details (complete, escalate, cannot complete)
 * + track GPS + upload photos + log job history
 */
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
    } = req.body;

    // Update job
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        governorSerial,
        governorStatus,
        clientName,
        clientPhone,
        remarks,
      },
    });

    // Update session GPS
    await prisma.session.updateMany({
      where: { userId, active: true },
      data: { latitude: latitude || null, longitude: longitude || null },
    });

    // Save uploaded photos
    if (req.files && req.files.length > 0) {
      const photosData = req.files.map(file => ({
        jobId,
        url: path.join("uploads", file.filename),
        uploadedAt: new Date(),
      }));
      await prisma.photo.createMany({ data: photosData });
    }

    // Log job history
    await prisma.jobHistory.create({
      data: {
        jobId,
        status,
        remarks,
        latitude: latitude || null,
        longitude: longitude || null,
        updatedBy: userId,
      },
    });

    res.json({ message: "Job updated successfully", job: updatedJob });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Update job status only
 */
router.put("/:id/status", async (req, res) => {
  try {
    const job = await prisma.job.update({
      where: { id: Number(req.params.id) },
      data: { status: req.body.status },
    });
    res.json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
