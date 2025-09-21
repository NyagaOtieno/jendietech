const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/**
 * Haversine formula to calculate distance between two GPS points in meters
 */
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * @desc Login user with GPS verification for technicians
 * @route POST /api/auth/login
 * @body { email, password, latitude, longitude }
 */
exports.login = async (req, res) => {
  try {
    const { email, password, latitude, longitude } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });


    if (user.role === "TECHNICIAN") {
      if (!latitude || !longitude) {
        return res.status(400).json({ message: "GPS coordinates required for technicians" });
      }


      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const job = await prisma.job.findFirst({
        where: {
          technicianId: user.id,
          scheduledDate: { gte: today },
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      });

      if (job && job.location) {

        const locationMap = {
          Nairobi: { latitude: -1.2921, longitude: 36.8219 },
          Mombasa: { latitude: -4.0435, longitude: 39.6682 },
        };
        const jobCoords = locationMap[job.location];
        if (jobCoords) {
          const distance = getDistanceFromLatLonInMeters(
            latitude,
            longitude,
            jobCoords.latitude,
            jobCoords.longitude
          );
          const MAX_DISTANCE = 500;
          if (distance > MAX_DISTANCE) {
            return res.status(403).json({
              message: `Technician too far from job location (${distance.toFixed(0)}m)`,
            });
          }
        }
      }
    }


    await prisma.user.update({
      where: { id: user.id },
      data: { online: true, lastLogin: new Date() },
    });


    await prisma.session.create({
      data: { userId: user.id, loginTime: new Date(), active: true, latitude, longitude },
    });


    if (user.role === "TECHNICIAN") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let rollCall = await prisma.rollCall.findFirst({ where: { date: today } });
      if (!rollCall) {
        rollCall = await prisma.rollCall.create({ data: { date: today, region: user.region || "All" } });
      }

      const existingEntry = await prisma.rollCallUser.findFirst({
        where: { rollCallId: rollCall.id, userId: user.id },
      });

      if (!existingEntry) {
        await prisma.rollCallUser.create({
          data: {
            rollCallId: rollCall.id,
            userId: user.id,
            status: "PRESENT",
            checkIn: new Date(),
            latitude,
            longitude,
          },
        });
      }
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, region: user.region, online: true },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Register user (Admin only)
 * @route POST /api/auth/register
 * @body { name, email, phone, password, role, region }
 */
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, role, region } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "Name, email, phone, and password are required" });
    }

    const phoneRegex = /^07\d{8}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ message: "Phone must be in format 07XXXXXXXX" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: hashedPassword,
        role: role || "TECHNICIAN",
        region: region || null,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        region: newUser.region,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * @desc Logout user
 * @route POST /api/auth/logout
 * @body { userId }
 */
exports.logout = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    await prisma.user.update({ where: { id: userId }, data: { online: false, lastLogout: new Date() } });
    await prisma.session.updateMany({ where: { userId, active: true }, data: { active: false, logoutTime: new Date() } });

    if (user.role === "TECHNICIAN") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rollCall = await prisma.rollCall.findFirst({ where: { date: today } });
      if (rollCall) {
        const rollCallUser = await prisma.rollCallUser.findFirst({ where: { rollCallId: rollCall.id, userId } });
        if (rollCallUser && !rollCallUser.checkOut) {
          await prisma.rollCallUser.update({ where: { id: rollCallUser.id }, data: { checkOut: new Date(), status: "CHECKED_OUT" } });
        }
      }
    }

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};