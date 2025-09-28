const express = require("express");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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
// CREATE JOB SAFELY (No Duplication per Day)
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
      technicianId
    } = req.body;

    if (!vehicleReg || !jobType || !scheduledDate || !technicianId) {
      return res.status(400).json({
        message: "vehicleReg, jobType, scheduledDate, and technicianId are required"
      });
    }

    const jobDate = new Date(scheduledDate);
    const startOfDay = new Date(jobDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(jobDate.setHours(23, 59, 59, 999));

    const existingJob = await prisma.job.findFirst({
      where: {
        vehicleReg,
        jobType,
        scheduledDate: { gte: startOfDay, lte: endOfDay }
      }
    });

    if (existingJob) {
      return res.status(400).json({
        message: `Job already exists for vehicle ${vehicleReg} (${jobType}) on ${startOfDay.toISOString().split("T")[0]}`
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
          connect: { id: Number(technicianId) }
        }
      },
      include: { assignedTechnician: true }
    });

    await prisma.jobHistory.create({
      data: {
        jobId: job.id,
        status: "PENDING",
        remarks: "Job created",
        updatedBy: Number(technicianId)
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
    console.error("❌ Error fetching jobs:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// UPDATE EXISTING JOB + PHOTO UPLOAD
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
        assignedTechnician: technicianId
          ? { connect: { id: Number(technicianId) } }
          : undefined,
        status: status || jobExists.status,
        governorSerial: governorSerial || jobExists.governorSerial,
        governorStatus: governorStatus || jobExists.governorStatus,
        clientName: clientName || jobExists.clientName,
        clientPhone: clientPhone || jobExists.clientPhone,
        remarks: remarks || jobExists.remarks
      }
    });

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

    // Upload photos if any
    if (req.files && req.files.length > 0) {
      const photosData = req.files.map(file => ({
        jobId,
        url: `uploads/${file.filename}`,
        uploadedAt: new Date()
      }));
      await prisma.photo.createMany({ data: photosData });
    }

    res.json({ message: "Job updated successfully", job: updatedJob });
  } catch (err) {
    console.error("❌ Error updating job:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ----------------------
// DELETE JOB + PHOTOS
// ----------------------
router.delete("/:id", async (req, res) => {
  try {
    const jobId = Number(req.params.id);

    // Delete photos from filesystem
    const photos = await prisma.photo.findMany({ where: { jobId } });
    photos.forEach(photo => {
      if (fs.existsSync(photo.url)) fs.unlinkSync(photo.url);
    });

    // Delete job, history, photos
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
