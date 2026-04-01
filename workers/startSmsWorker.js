const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendSmsMSpace } = require("../services/sms/mspaceSms");
const { normalizeKenyaPhone } = require("../utils/sms");

async function runSmsWorkerOnce(limit = 20, verbose = true) {
  const now = new Date();

  // Fetch pending messages due for sending
  const dueMessages = await prisma.smsOutbox.findMany({
    where: { status: "PENDING", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  if (dueMessages.length && verbose) {
    console.log(`✅ SmsWorker picked ${dueMessages.length} message(s) at ${now.toISOString()}`);
  }

  for (const row of dueMessages) {
    try {
      // --- Claim the row atomically in a transaction ---
      const claimed = await prisma.$transaction(async (tx) => {
        const r = await tx.smsOutbox.findUnique({ where: { id: row.id } });
        if (!r || r.status !== "PENDING") return null;
        await tx.smsOutbox.update({
          where: { id: row.id },
          data: { status: "SENDING" },
        });
        return r;
      });

      if (!claimed) continue; // Already handled

      const to = normalizeKenyaPhone(row.toPhone);
      if (!to) throw new Error(`Invalid phone number: ${row.toPhone}`);

      // Send SMS
      const resp = await sendSmsMSpace({ to, message: row.message });

      // ✅ Recognize MSpace's 111 status as success
      const status = resp?.message?.[0]?.status;
      const sentSuccessfully = status === 111 || resp?.success === true;

      if (!sentSuccessfully) throw new Error(`Provider rejected message: ${JSON.stringify(resp)}`);

      // Mark as SENT
      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });

      if (verbose) console.log("✅ SENT", { id: String(row.id), to, resp });
    } catch (err) {
      const retries = (row.retries || 0) + 1;
      const errorText = String(err?.response?.data || err?.message || err).slice(0, 2000);

      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: {
          retries,
          lastError: errorText,
          status: retries >= 5 ? "FAILED" : "PENDING",
          scheduledFor:
            retries >= 5
              ? row.scheduledFor
              : new Date(Date.now() + Math.pow(2, retries) * 60 * 1000), // exponential backoff
        },
      });

      console.error("❌ FAILED", { id: String(row.id), retries, errorText });
    }
  }
}

module.exports = { runSmsWorkerOnce };