const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single user
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  let { name, email, phone, password, role, region } = req.body;
   phone = phone?.toString().trim() || null;
   if (phone && !isValidKenyanPhone(phone)) {
  return res.status(400).json({
    status: "error",
    message:
      "Invalid phone format. Use +2547XXXXXXXX, +2541XXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX",
  });
}

if (phone) {
  phone = normalizeKenyanPhone(phone);
}
  try {
    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: { name, phone, role, region },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id: Number(id) } });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
