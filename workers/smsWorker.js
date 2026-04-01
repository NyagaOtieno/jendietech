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

    try {
      // --- Atomic claim to prevent double-send ---
      const claimedRow = await prisma.$transaction(async (tx) => {
        const r = await tx.smsOutbox.findUnique({ where: { id: row.id } });
        if (!r || r.status !== "PENDING") return null;
        await tx.smsOutbox.update({
          where: { id: row.id },
          data: { status: "SENDING" },
        });
        return r;
      });

      if (!claimedRow) continue;

      const to = normalizeKenyaPhone(row.toPhone);
      if (!to) throw new Error(`Invalid phone number: ${row.toPhone}`);

      const resp = await sendSmsMSpace({ to, message: row.message });

      // Check response for actual delivery
      const sentSuccessfully =
        resp?.message?.[0]?.status?.toUpperCase?.() === "OK" || resp?.success === true;

      if (!sentSuccessfully) throw new Error(`Provider rejected: ${JSON.stringify(resp)}`);

      // Mark SENT
      await prisma.smsOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });

      console.log("✅ SENT", { id: rowId, to, resp });
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

      console.error("❌ FAILED", { id: rowId, retries, errorText });
    }
  }
}

module.exports = { runSmsWorkerOnce };