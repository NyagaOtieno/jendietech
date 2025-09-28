const express = require("express");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const path = require("path");

const prisma = new PrismaClient();
const router = express.Router();

// ----------------------
// Multer storage for photos
// ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// ----------------------
// CREATE JOB SAFELY
// ----------------------
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
      technicianId
    } = req.body;

    if (!vehicleReg || !jobType || !scheduledDate) {
      return res.status(400).json({ message: "vehicleReg, jobType, and scheduledDate are required" });
    }

    // Check if job already exists
    const existingJob = await prisma.job.findFirst({
      where: {
        vehicleReg,
        jobType,
        scheduledDate: new Date(scheduledDate)
      }
    });

    if (existingJob) {
      return res.status(400).json({ message: "Job already exists for this vehicle on the given date" });
    }

    const job = await prisma.job.create({
      data: {
        vehicleReg,
        jobType,
        status: status || "PENDING",
        scheduledDate: new Date(scheduledDate),
        location,
        governorSerial,
        governorStatus,
        clientName,
        clientPhone,
        remarks,
        photoUrl,
        clientSignature,
        technicianId: technicianId ? Number(technicianId) : undefined
      }
    });

    res.status(201).json({ message: "Job created successfully", data: job });
  } catch (err) {
    console.error("❌ Error creating job:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------------
// GET JOBS WITH FILTERS + PAGINATION
// ----------------------
router.get("/", async (req, res) => {
  try {
    const { technicianId, region, status, startDate, endDate, page = 1, limit = 20 } = req.query;

    const filters = {
      technicianId: technicianId ? Number(technicianId) : undefined,
      status: status || undefined,
      scheduledDate:
        startDate && endDate
          ? { gte: new Date(startDate), lte: new Date(endDate) }
          : undefined,
      assignedTechnician: region ? { region } : undefined
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const jobs = await prisma.job.findMany({
      where: filters,
      include: { assignedTechnician: true, photos: true, history: true },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { scheduledDate: "desc" }
    });

    const total = await prisma.job.count({ where: filters });

    res.json({
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
      jobs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// UPDATE EXISTING JOB
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
      scheduledDate
    } = req.body;

    const jobExists = await prisma.job.findUnique({ where: { id: jobId } });
    if (!jobExists) return res.status(404).json({ message: "Job not found" });

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        vehicleReg: vehicleReg || jobExists.vehicleReg,
        jobType: jobType || jobExists.jobType,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : jobExists.scheduledDate,
        technicianId: technicianId ? Number(technicianId) : jobExists.technicianId,
        status: status || jobExists.status,
        governorSerial: governorSerial || jobExists.governorSerial,
        governorStatus: governorStatus || jobExists.governorStatus,
        clientName: clientName || jobExists.clientName,
        clientPhone: clientPhone || jobExists.clientPhone,
        remarks: remarks || jobExists.remarks
      }
    });

    // Update session GPS
    if (userId) {
      await prisma.session.updateMany({
        where: { userId: Number(userId), active: true },
        data: { latitude: latitude || null, longitude: longitude || null }
      });

      await prisma.jobHistory.create({
        data: {
          jobId,
          status: status || jobExists.status,
          remarks: remarks || "",
          latitude: latitude || null,
          longitude: longitude || null,
          updatedBy: Number(userId)
        }
      });
    }

    // Save uploaded photos
    if (req.files && req.files.length > 0) {
      const photosData = req.files.map(file => ({
        jobId,
        url: path.join("uploads", file.filename),
        uploadedAt: new Date()
      }));
      await prisma.photo.createMany({ data: photosData });
    }

    res.json({ message: "Job updated successfully", job: updatedJob });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// START JOB
// ----------------------
router.post("/start/:id", async (req, res) => {
  try {
    const jobId = Number(req.params.id);
    const { userId, latitude, longitude } = req.body;

    const job = await prisma.job.update({
      where: { id: jobId },
      data: { status: "IN_PROGRESS" }
    });

    await prisma.session.create({
      data: {
        userId,
        loginTime: new Date(),
        active: true,
        latitude: latitude || null,
        longitude: longitude || null
      }
    });

    await prisma.jobHistory.create({
      data: {
        jobId,
        status: "IN_PROGRESS",
        remarks: "Job started",
        latitude: latitude || null,
        longitude: longitude || null,
        updatedBy: userId
      }
    });

    res.json({ message: "Job started successfully", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
