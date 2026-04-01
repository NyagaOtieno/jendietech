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
    console.log(`✅ SmsWorker picked ${dueMessages.length} messages at ${now.toISOString()}`);
  }

  for (const row of dueMessages) {
    try {
      // Claim row in a transaction to prevent double-sending
      const claimed = await prisma.smsOutbox.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "SENDING" },
      });

      if (claimed.count === 0) continue; // already claimed by another worker

      const to = normalizeKenyaPhone(row.toPhone);
      if (!to) throw new Error(`Invalid phone number: ${row.toPhone}`);

      // Send SMS via provider
      const resp = await sendSmsMSpace({ to, message: row.message });

      // Check provider response (assuming resp.success or similar)
      const sentSuccessfully = resp?.success ?? true; // adjust per your provider API
      if (!sentSuccessfully) throw new Error(`Provider rejected message: ${JSON.stringify(resp)}`);

      // Mark as SENT
      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });

      if (verbose) console.log("✅ SENT", { id: String(row.id), to, resp });
    } catch (err) {
      // Increment retries and schedule next attempt
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