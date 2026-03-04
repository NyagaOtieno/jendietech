const { normalizeKenyaPhone } = require("../utils/sms");

async function enqueueSms(tx, { jobId = null, toPhone, message, scheduledFor = null }) {
  const to = normalizeKenyaPhone(toPhone);
  if (!to) {
    console.log("❌ enqueueSms: invalid phone:", toPhone);
    return null;
  }

  const row = await tx.smsOutbox.create({
    data: {
      jobId,
      toPhone: to,
      message,
      status: "PENDING",
      scheduledFor: scheduledFor || new Date(),
    },
  });

  console.log("✅ enqueueSms created outbox row:", {
    id: String(row.id),
    toPhone: row.toPhone,
    status: row.status,
    scheduledFor: row.scheduledFor,
  });

  return row;
}

module.exports = { enqueueSms };