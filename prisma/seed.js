const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create Users
  const admin = await prisma.user.create({
    data: {
      name: "Kennedy (Admin)",
      email: "admin@jendie.com",
      role: "ADMIN",
      region: "Nairobi",
      password: "hashedpassword",
    },
  });

  const tech1 = await prisma.user.create({
    data: {
      name: "John Doe",
      email: "tech1@jendie.com",
      role: "TECHNICIAN",
      region: "Nairobi",
      password: "hashedpassword",
    },
  });

  const tech2 = await prisma.user.create({
    data: {
      name: "Jane Smith",
      email: "tech2@jendie.com",
      role: "TECHNICIAN",
      region: "Mombasa",
      password: "hashedpassword",
    },
  });

  // Create Jobs
  await prisma.job.create({
    data: {
      vehicleReg: "KCT123X",
      jobType: "INSTALL",
      status: "PENDING",
      scheduledDate: new Date(),
      location: "Nairobi",
      assignedTechnician: { connect: { id: tech1.id } },
    },
  });

  await prisma.job.create({
    data: {
      vehicleReg: "KDD456Y",
      jobType: "RENEWAL",
      status: "DONE",
      scheduledDate: new Date(),
      location: "Mombasa",
      assignedTechnician: { connect: { id: tech2.id } },
    },
  });

  console.log("✅ Seed data created");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
