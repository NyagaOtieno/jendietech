import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// Weekly report by region
router.get("/weekly", async (req, res) => {
  const { region } = req.query;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const jobs = await prisma.job.findMany({
    where: {
      location: { contains: region },
      createdAt: { gte: oneWeekAgo }
    },
    include: {
      assignedTechnician: true,
      history: true
    }
  });

  res.json(jobs);
});

// Technician job report
router.get("/technician/:id", async (req, res) => {
  const { id } = req.params;
  const jobs = await prisma.job.findMany({
    where: { technicianId: Number(id) },
    include: {
      history: true,
      photos: true
    }
  });
  res.json(jobs);
});

// Job history report
router.get("/jobs/history", async (req, res) => {
  const { jobId } = req.query;
  const history = await prisma.jobHistory.findMany({
    where: { jobId: Number(jobId) },
    orderBy: { createdAt: "asc" }
  });
  res.json(history);
});

// Active technicians with location
router.get("/technicians/active", async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { active: true },
    include: { user: true }
  });
  res.json(sessions);
});

// Roll Call summary
router.get("/rollcall", async (req, res) => {
  const { region, date } = req.query;
  const rollCalls = await prisma.rollCall.findMany({
    where: {
      region,
      date: {
        gte: new Date(date),
        lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
      }
    },
    include: {
      presentUsers: { include: { user: true } }
    }
  });
  res.json(rollCalls);
});

export default router;
