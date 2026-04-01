const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendSmsMSpace } = require("../services/sms/mspaceSms");
const { normalizeKenyaPhone } = require("../utils/sms");

/**
 * Process SMS outbox once.
 * @param {number} limit Max messages to process at a time
 * @param {boolean} verbose Log detailed info
 */
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
      // Claim row safely
      const claimed = await prisma.smsOutbox.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "SENDING" },
      });

      if (claimed.count === 0) continue; // already claimed by another worker

      const to = normalizeKenyaPhone(row.toPhone);
      if (!to) throw new Error(`Invalid phone number: ${row.toPhone}`);

      // Send SMS
      const resp = await sendSmsMSpace({ to, message: row.message });

      // --- VERIFY DELIVERY ---
      // Check provider response
      const sentSuccessfully =
        resp?.message?.[0]?.status?.toUpperCase?.() === "OK" || resp?.success === true;

      if (!sentSuccessfully) {
        throw new Error(`Provider rejected message: ${JSON.stringify(resp)}`);
      }

      // Mark row as SENT only if provider confirms
      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });

      if (verbose) console.log("✅ SENT", { id: String(row.id), to, resp });

    } catch (err) {
      const retries = (row.retries || 0) + 1;
      const errorText = String(err?.response?.data || err?.message || err).slice(0, 2000);

      // Exponential backoff: retry in 2^retries minutes
      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: {
          retries,
          lastError: errorText,
          status: retries >= 5 ? "FAILED" : "PENDING",
          scheduledFor:
            retries >= 5
              ? row.scheduledFor
              : new Date(Date.now() + Math.pow(2, retries) * 60 * 1000),
        },
      });

      console.error("❌ FAILED", { id: String(row.id), retries, errorText });
    }
  }
}

module.exports = { runSmsWorkerOnce };