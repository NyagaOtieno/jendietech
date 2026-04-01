const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { sendSmsMSpace } = require("../services/sms/mspaceSms");
const { normalizeKenyaPhone } = require("../utils/sms");

async function runSmsWorkerOnce(limit = 20) {
  const now = new Date();

  const due = await prisma.smsOutbox.findMany({
    where: { status: "PENDING", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  if (due.length) {
    console.log(`✅ SmsWorker picked ${due.length} messages at ${now.toISOString()}`);
  }

  for (const row of due) {
    try {
      // ✅ claim row to avoid double sending if multiple workers
      const claimed = await prisma.smsOutbox.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "SENDING" },
      });
      if (claimed.count === 0) continue; // already handled elsewhere

      const to = normalizeKenyaPhone(row.toPhone);
      if (!to) throw new Error(`Invalid phone: ${row.toPhone}`);

      const resp = await sendSmsMSpace({ to, message: row.message });

      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });

      console.log("✅ SENT", { id: String(row.id), to });
    } catch (err) {
      const errorText = String(err?.response?.data || err?.message || err).slice(0, 2000);
      const retries = (row.retries || 0) + 1;

      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: {
          retries,
          lastError: errorText,
          status: retries >= 3 ? "FAILED" : "PENDING",
          scheduledFor: retries >= 3
            ? row.scheduledFor
            : new Date(Date.now() + retries * 60 * 1000),
        },
      });

      console.error("❌ FAILED", { id: String(row.id), retries, errorText });
    }
  }
}

module.exports = { runSmsWorkerOnce };