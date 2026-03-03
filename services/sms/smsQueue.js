const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function queueSms({ jobId = null, toPhone, message, scheduledFor = new Date() }) {
  return prisma.smsOutbox.create({
    data: {
      jobId: jobId ? Number(jobId) : null,
      toPhone,
      message,
      scheduledFor,
    },
  });
}

async function createFeedbackToken(jobId) {
  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.feedbackToken.create({ data: { jobId: Number(jobId), token, expiresAt } });
  return token;
}

module.exports = { queueSms, createFeedbackToken };