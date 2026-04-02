const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function createJobTracking(jobId) {
  const token = crypto.randomBytes(16).toString("hex");

  await prisma.jobTracking.create({
    data: {
      jobId,
      token,
    },
  });

  const base = process.env.APP_PUBLIC_URL || "http://localhost:8080";

  return `${base}/track/${token}`;
}

module.exports = { createJobTracking };