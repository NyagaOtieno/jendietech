/**
 * cleanupSeed.js
 * Safe cleanup of demo/test users.
 * Keeps admin@jendie.com intact.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting safe cleanup...");

  const testUsers = await prisma.user.findMany({
    where: { email: { in: ['tech1@jendie.com','tech2@jendie.com'] } }
  });

  if (!testUsers.length) {
    console.log("No seeded users found to delete.");
    return;
  }

  const ids = testUsers.map(u => u.id);

  await prisma.rollCallUser.deleteMany({ where: { userId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.photo.deleteMany({ where: { job: { assignedTechnician: { id: { in: ids } } } } });
  await prisma.jobHistory.deleteMany({ where: { OR: [{ updatedBy: { in: ids } }, { job: { assignedTechnician: { id: { in: ids } } } }] } });
  await prisma.job.deleteMany({ where: { assignedTechnician: { id: { in: ids } } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log("✅ Cleanup complete — admin@jendie.com is safe.");
}

main()
  .catch(e => { console.error("❌ Cleanup error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });