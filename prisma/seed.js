const { PrismaClient } = require('@prisma/client');
const bcrypt = require("bcryptjs");
const path = require("path");

const prisma = new PrismaClient();

// Example GPS coordinates for locations
const LOCATION_COORDS = {
  Nairobi: { latitude: -1.2921, longitude: 36.8219 },
  Mombasa: { latitude: -4.0435, longitude: 39.6682 },
};

// Sample clients for jobs
const CLIENTS = [
  { name: "Peter Kiprotich", phone: "+254722123456" },
  { name: "Jane Mwangi", phone: "+254733456789" },
  { name: "Tom Odhiambo", phone: "+254711223344" },
  { name: "Alice Wanjiku", phone: "+254700123456" },
];

async function main() {
  console.log("🔹 Clearing existing data...");

  // Delete in proper order to satisfy foreign keys
  await prisma.rollCallUser.deleteMany({});
  await prisma.rollCall.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.jobHistory.deleteMany({});
  await prisma.photo.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("🔹 Creating users...");

  // Hash passwords
  const adminPass = await bcrypt.hash("admin123", 10);
  const tech1Pass = await bcrypt.hash("tech123", 10);
  const tech2Pass = await bcrypt.hash("tech456", 10);

  // Create users (with phone)
  const admin = await prisma.user.create({
    data: { 
      name: "Kennedy (Admin)", 
      email: "admin@jendie.com", 
      phone: "+254700000001",
      role: "ADMIN", 
      region: "Nairobi", 
      password: adminPass 
    },
  });

  const tech1 = await prisma.user.create({
    data: { 
      name: "John Doe", 
      email: "tech1@jendie.com", 
      phone: "+254700000002",
      role: "TECHNICIAN", 
      region: "Nairobi", 
      password: tech1Pass 
    },
  });

  const tech2 = await prisma.user.create({
    data: { 
      name: "Jane Smith", 
      email: "tech2@jendie.com", 
      phone: "+254700000003",
      role: "TECHNICIAN", 
      region: "Mombasa", 
      password: tech2Pass 
    },
  });

  console.log("🔹 Creating rollcall for all technicians...");
  const technicians = [tech1, tech2];

  const rollCall = await prisma.rollCall.create({ data: { region: "All", date: new Date() } });

  await prisma.rollCallUser.createMany({
    data: technicians.map(tech => ({
      rollCallId: rollCall.id,
      userId: tech.id,
      status: "PRESENT",
      checkIn: new Date(),
      checkOut: null,
      latitude: LOCATION_COORDS[tech.region].latitude,
      longitude: LOCATION_COORDS[tech.region].longitude,
    })),
  });

  console.log("🔹 Creating multiple jobs per technician with history, photos, and sessions...");

  const JOB_TYPES = ["INSTALL", "RENEWAL", "REPAIR"];
  const GOVERNOR_STATUS = ["NEW", "RENEWED", "REPAIRED"];
  const NUM_JOBS = 5; // per technician

  for (const tech of technicians) {
    for (let i = 0; i < NUM_JOBS; i++) {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + i); // staggered dates
      const client = CLIENTS[i % CLIENTS.length];

      const job = await prisma.job.create({
        data: {
          vehicleReg: `KCT${Math.floor(100 + Math.random() * 900)}${tech.id}`,
          jobType: JOB_TYPES[i % JOB_TYPES.length],
          status: i === 0 ? "PENDING" : "DONE",
          scheduledDate,
          location: tech.region,
          assignedTechnician: { connect: { id: tech.id } },
          governorSerial: `GOV${Math.floor(100 + Math.random() * 900)}`,
          governorStatus: GOVERNOR_STATUS[i % GOVERNOR_STATUS.length],
          clientName: client.name,
          clientPhone: client.phone,
        },
      });

      // Job history
      await prisma.jobHistory.create({
        data: {
          jobId: job.id,
          status: job.status,
          remarks: i === 0 ? "Job created" : "Job completed",
          latitude: LOCATION_COORDS[tech.region].latitude,
          longitude: LOCATION_COORDS[tech.region].longitude,
          updatedBy: tech.id,
        },
      });

      // Placeholder photo
      await prisma.photo.create({
        data: {
          jobId: job.id,
          url: path.join("uploads", "placeholder.jpg"),
          uploadedAt: new Date(),
        },
      });
    }

    // Initial session for technician
    await prisma.session.create({
      data: {
        userId: tech.id,
        loginTime: new Date(),
        active: true,
        latitude: LOCATION_COORDS[tech.region].latitude,
        longitude: LOCATION_COORDS[tech.region].longitude,
      },
    });
  }

  console.log("✅ Seed complete (Users + RollCall + Jobs + Photos + Job History + Active Sessions)");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
