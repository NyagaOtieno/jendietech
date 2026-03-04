const { normalizeKenyaPhone } = require("../utils/sms");

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
    },
  });
}

module.exports = { enqueueSms };