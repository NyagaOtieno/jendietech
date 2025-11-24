const { PrismaClient } = require('@prisma/client');
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🔹 Clearing all non-admin data...");

  // Delete in proper order to satisfy foreign keys
  await prisma.rollCallUser.deleteMany({});
  await prisma.rollCall.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.jobHistory.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.job.deleteMany({});

  // Delete all users except admin
  await prisma.user.deleteMany({
    where: {
      role: { not: "ADMIN" }
    }
  });

  console.log("🔹 Ensuring admin user exists...");

  // Check if admin exists
  const adminExists = await prisma.user.findUnique({
    where: { email: "admin@jendie.com" }
  });

  if (!adminExists) {
    const adminPass = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: { 
        name: "Kennedy (Admin)", 
        email: "admin@jendie.com", 
        phone: "+254722301062",
        role: "ADMIN", 
        region: "Nairobi", 
        password: adminPass 
      },
    });
    console.log("✅ Admin created");
  } else {
    console.log("✅ Admin already exists");
  }

  console.log("✅ Database cleaned: only admin remains");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
