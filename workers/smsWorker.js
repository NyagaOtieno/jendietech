const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { sendSmsMSpace } = require("../services/sms/mspaceSms");
const { normalizeKenyaPhone } = require("../utils/sms");

async function runSmsWorkerOnce(limit = 20) {
  const now = new Date();

  let due = [];
  try {
    due = await prisma.smsOutbox.findMany({
      where: { status: "PENDING", scheduledFor: { lte: now } },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });
  } catch (e) {
    console.error("❌ SmsWorker fetch error:", e?.message || e);
    return;
  }

  console.log(`📩 SmsWorker tick @ ${now.toISOString()} | due=${due.length}`);

  for (const row of due) {
    const rowId = String(row.id);

    try {
      // ✅ Prevent double-send
      const claim = await prisma.smsOutbox.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "SENDING" },
      });

      if (claim.count === 0) continue;

      const to = normalizeKenyaPhone(row.toPhone);
      if (!to) throw new Error(`Invalid phone: ${row.toPhone}`);

      const resp = await sendSmsMSpace({
        to,
        message: row.message,
      });

      // ✅ FIX: MSpace success = status 111
      const statusCode = resp?.message?.[0]?.status;
      const sentSuccessfully = statusCode === 111 || resp?.success === true;

      if (!sentSuccessfully) {
        throw new Error(`Provider rejected: ${JSON.stringify(resp)}`);
      }

      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });

      console.log("✅ SENT", { id: rowId, to, statusCode });
    } catch (err) {
      const retries = (row.retries || 0) + 1;
      const errorText = String(err?.response?.data || err?.message || err).slice(0, 2000);

      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: {
          retries,
          lastError: errorText,
          status: retries >= 3 ? "FAILED" : "PENDING",
          scheduledFor:
            retries >= 3
              ? row.scheduledFor
              : new Date(Date.now() + retries * 60 * 1000),
        },
      });

      console.error("❌ FAILED", { id: rowId, retries, errorText });
    }
  }
}

module.exports = { runSmsWorkerOnce };