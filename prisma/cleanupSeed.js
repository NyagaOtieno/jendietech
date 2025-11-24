/**
 * cleanupSeed.js
 * 
 * Safe cleanup of seeded demo data.
 * Keeps admin@jendie.com intact.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting safe cleanup (keeping admin@jendie.com)...");

  // Find all test users except admin
  const seededUsers = await prisma.user.findMany({
    where: {
      email: {
        in: ['tech1@jendie.com', 'tech2@jendie.com'],
      },
    },
  });

  if (seededUsers.length === 0) {
    console.log("No seeded users found to delete. Exiting.");
    return;
  }

  const seededUserIds = seededUsers.map(u => u.id);
  console.log("Found seeded users to delete:", seededUsers.map(u => u.email));

  // 1️⃣ Delete RollCallUser entries first
  const rcUserDel = await prisma.rollCallUser.deleteMany({
    where: { userId: { in: seededUserIds } },
  });
  console.log(`🗑️ Deleted ${rcUserDel.count} rollCallUser rows linked to seeded users.`);

  // 2️⃣ Delete session entries
  const sessDel = await prisma.session.deleteMany({
    where: { userId: { in: seededUserIds } },
  });
  console.log(`🗑️ Deleted ${sessDel.count} session rows linked to seeded users.`);

  // 3️⃣ Delete photos linked to jobs assigned to those users
  const photoDel = await prisma.photo.deleteMany({
    where: {
      job: {
        assignedTechnician: { id: { in: seededUserIds } },
      },
    },
  });
  console.log(`🗑️ Deleted ${photoDel.count} photos linked to seeded jobs.`);

  // 4️⃣ Delete jobHistory entries linked to those users
  const jhDel = await prisma.jobHistory.deleteMany({
    where: {
      OR: [
        { updatedBy: { in: seededUserIds } },
        { job: { assignedTechnician: { id: { in: seededUserIds } } } },
      ],
    },
  });
  console.log(`🗑️ Deleted ${jhDel.count} jobHistory rows linked to seeded jobs.`);

  // 5️⃣ Delete jobs assigned to those users
  const jobAssignedDel = await prisma.job.deleteMany({
    where: { assignedTechnician: { id: { in: seededUserIds } } },
  });
  console.log(`🗑️ Deleted ${jobAssignedDel.count} jobs assigned to seeded users.`);

  // 6️⃣ Delete rollCalls for 'All' region (optional — if these are seeded too)
  const rollDel = await prisma.rollCall.deleteMany({
    where: { region: 'All' },
  });
  console.log(`🗑️ Deleted ${rollDel.count} rollCall rows with region 'All'.`);

  // 7️⃣ Finally, delete the seeded users
  const userDel = await prisma.user.deleteMany({
    where: { id: { in: seededUserIds } },
  });
  console.log(`🗑️ Deleted ${userDel.count} seeded users.`);

  console.log("✅ Cleanup complete — admin@jendie.com is safe.");
}

main()
  .catch(e => {
    console.error("❌ Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
