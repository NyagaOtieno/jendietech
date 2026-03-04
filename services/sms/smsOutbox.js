const { normalizeKenyaPhone } = require("../utils/sms");

/**
 * Enqueue SMS into SmsOutbox (matches your Prisma schema)
 * Schema: { jobId?, toPhone, message, status?, scheduledFor? }
 */
async function enqueueSms(tx, { jobId = null, toPhone, message, scheduledFor = null }) {
  const to = normalizeKenyaPhone(toPhone);
  if (!to) return null;

  return tx.smsOutbox.create({
    data: {
      jobId,
      toPhone: to,
      message,
      status: "PENDING",
      scheduledFor: scheduledFor || new Date(),
      // retries default 0
    },
  });
}

module.exports = { enqueueSms };