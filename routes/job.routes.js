const express = require("express");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const router = express.Router();

// Create a new job
router.post("/", async (req, res) => {
  const job = await prisma.job.create({ data: req.body });
  res.json(job);
});

// Get jobs with filters
router.get("/", async (req, res) => {
  const { technicianId, region, status, startDate, endDate } = req.query;
  const jobs = await prisma.job.findMany({
    where: {
      technicianId: technicianId ? Number(technicianId) : undefined,
      status: status || undefined,
      scheduledDate: startDate && endDate ? {
        gte: new Date(startDate),
        lte: new Date(endDate),
      } : undefined,
      assignedTechnician: region ? { region } : undefined,
    },
    include: { assignedTechnician: true },
  });
  res.json(jobs);
});

// Update job status
router.put("/:id/status", async (req, res) => {
  const job = await prisma.job.update({
    where: { id: Number(req.params.id) },
    data: { status: req.body.status },
  });
  res.json(job);
});

module.exports = router;
