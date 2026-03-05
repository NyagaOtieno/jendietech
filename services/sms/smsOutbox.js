const { normalizeKenyaPhone } = require("../utils/sms");

/**
 * Enqueue SMS with idempotency:
 * - same (jobId + eventKey) will only be queued once
 *
 * We implement idempotency by embedding an eventKey in the messageRef
 * WITHOUT changing DB schema: we store it in lastError? No.
 * Better: add a new column `eventKey` + unique index.
 *
 * If you can't migrate now, use "soft idempotency" by checking first.
 */

async function enqueueSms(tx, { jobId = null, toPhone, message, eventKey, scheduledFor = null }) {
  const to = normalizeKenyaPhone(toPhone);
  if (!to) return null;

  // ✅ Soft idempotency: do not queue same event twice for same job + phone
  // (works immediately with your current schema)
  if (eventKey && jobId) {
    const exists = await tx.smsOutbox.findFirst({
      where: {
        jobId,
        toPhone: to,
        status: { in: ["PENDING", "SENDING", "SENT"] },
        message: { contains: `[#${eventKey}]` },
      },
    });
    if (exists) return null;
  }

  return tx.smsOutbox.create({
    data: {
      jobId,
      toPhone: to,
      message: eventKey ? `[#${eventKey}] ${message}` : message,
      status: "PENDING",
      scheduledFor: scheduledFor || new Date(),
    },
  });
}

module.exports = { enqueueSms };