/**
 * seed.js
 * Safe seeding: does NOT wipe production data, only ensures admin exists.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🔹 Ensuring admin user exists...");

  const adminEmail = "admin@jendie.com";

  const adminExists = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!adminExists) {
    const adminPass = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: { 
        name: "Kennedy (Admin)", 
        email: adminEmail, 
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

  console.log("✅ Seed complete. No other data was touched.");
}

main()
  .catch(e => { 
    console.error("❌ Seed error:", e); 
    process.exit(1); 
  })
  .finally(async () => { await prisma.$disconnect(); });