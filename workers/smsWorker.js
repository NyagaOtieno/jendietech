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
    console.error("❌ SmsWorker: failed to fetch due messages:", e?.message || e);
    return;
  }

  console.log(`📩 SmsWorker tick @ ${now.toISOString()} | due=${due.length}`);

  for (const row of due) {
    const rowId = String(row.id);

    // ✅ Log per row (safe)
    console.log("➡️ Processing outbox row:", {
      id: rowId,
      toPhone: row.toPhone,
      status: row.status,
      retries: row.retries,
      scheduledFor: row.scheduledFor?.toISOString?.() || row.scheduledFor,
    });

    try {
      // ✅ Claim message (prevents double-sending if multiple instances)
      const claim = await prisma.smsOutbox.updateMany({
        where: { id: row.id, status: "PENDING" },
        data: { status: "SENDING" },
      });
      if (claim.count === 0) {
        // someone else already took it
        continue;
      }

      const to = normalizeKenyaPhone(row.toPhone);
      if (!to) throw new Error(`Invalid phone: ${row.toPhone}`);

      // ✅ Send via MSpace
      const resp = await sendSmsMSpace({ to, message: row.message });

      // ✅ Mark sent
      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });

      console.log("✅ SENT:", { id: rowId, to, resp: resp || "ok" });
    } catch (err) {
      const errorText = String(err?.response?.data || err?.message || err).slice(0, 2000);
      const retries = (row.retries || 0) + 1;

      const nextTime =
        retries >= 3 ? row.scheduledFor : new Date(Date.now() + retries * 60 * 1000);

      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: {
          retries,
          lastError: errorText,
          status: retries >= 3 ? "FAILED" : "PENDING",
          scheduledFor: nextTime,
        },
      });

      console.error("❌ FAILED:", { id: rowId, retries, errorText });
    }
  }
}

module.exports = { runSmsWorkerOnce };