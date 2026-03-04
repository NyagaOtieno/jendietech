const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { sendSmsMSpace } = require("../services/sms/mspaceSms");
const { normalizeKenyaPhone } = require("../utils/sms");

async function runSmsWorkerOnce(limit = 20) {
  const due = await prisma.smsOutbox.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  for (const row of due) {
    try {
      const to = normalizeKenyaPhone(row.toPhone);
      if (!to) throw new Error("Invalid phone");

      await sendSmsMSpace({ to, message: row.message });

      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
    } catch (err) {
      const errorText = String(err?.response?.data || err?.message || err).slice(0, 2000);
      const retries = row.retries + 1;

      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: {
          retries,
          lastError: errorText,
          status: retries >= 3 ? "FAILED" : "PENDING",
          scheduledFor: retries >= 3 ? row.scheduledFor : new Date(Date.now() + retries * 60 * 1000),
        },
      });
    }
  }
}
console.log("Processing outbox row:", { id: row.id, idType: typeof row.id, toPhone: row.toPhone, status: row.status });
module.exports = { runSmsWorkerOnce };