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
        latitude: latitude || null,
        longitude: longitude || null,
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

    // Update login state
    await prisma.user.update({
      where: { id: user.id },
      data: { online: true, lastLogin: new Date() },
    });

    // Record session with technician location
    await prisma.session.create({
      data: {
        userId: user.id,
        loginTime: new Date(),
        active: true,
        latitude: latitude || null,
        longitude: longitude || null,
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
    const {
      fullName,
      nationalId,
      password,
      emailAddress,
      phone,
      primaryLocation,
      specialization,
      role,
    } = req.body;

    const email = emailAddress;
    const name = fullName;
    const region = primaryLocation;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        nationalId,
        role: role || "TECHNICIAN",
        region,
        specialization,
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
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
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
        latitude: latitude || null,
        longitude: longitude || null,
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
