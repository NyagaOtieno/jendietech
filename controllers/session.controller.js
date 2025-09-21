const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ----------------------------
// Login Admin or Staff
// ----------------------------
exports.loginAdminStaff = async (req, res) => {
  const { userId, latitude, longitude } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "TECHNICIAN") {
      return res.status(403).json({ message: "Use technician login endpoint" });
    }

    const session = await prisma.session.create({
      data: {
        userId,
        loginTime: new Date(),
        latitude: latitude || null,
        longitude: longitude || null,
        active: true,
      },
    });

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { online: true, lastLogin: new Date() },
    });

    res.json({ message: "Admin/Staff logged in", session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ----------------------------
// Logout Technician (with location)
// ----------------------------
exports.logoutTechnician = async (req, res) => {
  const { userId, latitude, longitude } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role !== "TECHNICIAN") {
      return res.status(403).json({ message: "Use admin/staff logout endpoint" });
    }

    const updated = await prisma.session.updateMany({
      where: { userId: Number(userId), active: true },
      data: {
        active: false,
        logoutTime: new Date(),
        latitude: latitude || null,
        longitude: longitude || null,
      },
    });

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { online: false, lastLogout: new Date() },
    });

    res.json({ message: "Technician logged out", updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ----------------------------
// Get Online Users
// ----------------------------
exports.getOnlineUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { online: true },
      select: {
        id: true,
        name: true,
        role: true,
        region: true,
        lastLogin: true,
        lastLogout: true,
      },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
