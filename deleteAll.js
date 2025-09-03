const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1️⃣ Delete dependent tables first
  await prisma.rollCallUser.deleteMany({});
  await prisma.rollCall.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.session.deleteMany({}); // ✅ sessions referencing users

  // 2️⃣ Delete all users last
  await prisma.user.deleteMany({});

  console.log("✅ All users, jobs, sessions, and rollcall entries deleted");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
