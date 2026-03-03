const { PrismaClient } = require("@prisma/client"); 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/** ----------------------
 * Helpers
 * ---------------------- */

/**
 * Create or get today's rollcall entry for a technician
 */
const handleRollCall = async (user, latitude, longitude) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let rollCall = await prisma.rollCall.findFirst({ where: { date: today } });
  if (!rollCall) {
    rollCall = await prisma.rollCall.create({
      data: { date: today, region: user.region || "All" },
    });
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
};

/** ----------------------
 * Controllers
 * ---------------------- */

/**
 * @desc Login user
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password, latitude, longitude } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    // Require location for technicians
    if (user.role === "TECHNICIAN" && (latitude === undefined || longitude === undefined)) {
      return res.status(400).json({ message: "Technicians must provide latitude and longitude" });
    }

    // Update login state
    await prisma.user.update({
      where: { id: user.id },
      data: { online: true, lastLogin: new Date() },
    });

    // Record session with location
    await prisma.session.create({
      data: {
        userId: user.id,
        loginTime: new Date(),
        active: true,
        latitude,
        longitude,
      },
    });

    // Handle rollcall only for technicians
    if (user.role === "TECHNICIAN") await handleRollCall(user, latitude, longitude);

    // Generate token
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        region: user.region,
        phone: user.phone,
        specialization: user.specialization,
        online: true,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

/**
 * @desc Register user
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    // Accept BOTH naming styles (old + new)
    const {
      // old fields
      fullName,
      nationalId,
      emailAddress,
      primaryLocation,

      // new fields
      name: nameNew,
      email: emailNew,
      region: regionNew,

      // shared
      password,
      phone,
      specialization,
      role,
    } = req.body;

    const email = (emailNew || emailAddress || "").trim().toLowerCase();
    const name = (nameNew || fullName || "").trim();
    const region = (regionNew || primaryLocation || null);

    // ✅ Validate early (avoid Prisma crash)
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!password) return res.status(400).json({ message: "Password is required" });

    // optional: normalize phone a bit
    const phoneClean = phone ? String(phone).trim() : null;

    // Check duplicates by email (and optionally phone)
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) return res.status(409).json({ message: "User already exists (email)" });

    // If phone is unique in your schema, also guard it:
    if (phoneClean) {
      const existingByPhone = await prisma.user.findUnique({ where: { phone: phoneClean } }).catch(() => null);
      if (existingByPhone) return res.status(409).json({ message: "User already exists (phone)" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone: phoneClean,
        nationalId: nationalId || null,
        role: role || "TECHNICIAN",
        region,
        specialization: specialization || null,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        region: newUser.region,
        phone: newUser.phone,
        nationalId: newUser.nationalId,
        specialization: newUser.specialization,
      },
    });
  } catch (error) {
    // handle Prisma unique errors nicely (if you have unique constraints)
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "User already exists (unique constraint)" });
    }
    console.error("Register error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
};

/**
 * @desc Logout user
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const { userId, latitude, longitude } = req.body;
    if (!userId)
      return res.status(400).json({ message: "User ID required" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Require location for technicians
    if (user.role === "TECHNICIAN" && (latitude === undefined || longitude === undefined)) {
      return res.status(400).json({ message: "Technicians must provide latitude and longitude" });
    }

    // Update user online state
    await prisma.user.update({
      where: { id: userId },
      data: { online: false, lastLogout: new Date() },
    });

    // Update active session with logout location
    await prisma.session.updateMany({
      where: { userId, active: true },
      data: {
        active: false,
        logoutTime: new Date(),
        latitude,
        longitude,
      },
    });

    // Rollcall checkout for technicians
    if (user.role === "TECHNICIAN") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rollCall = await prisma.rollCall.findFirst({ where: { date: today } });
      if (rollCall) {
        const rollCallUser = await prisma.rollCallUser.findFirst({
          where: { rollCallId: rollCall.id, userId },
        });
        if (rollCallUser && !rollCallUser.checkOut) {
          await prisma.rollCallUser.update({
            where: { id: rollCallUser.id },
            data: { checkOut: new Date(), status: "CHECKED_OUT" },
          });
        }
      }
    }

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
