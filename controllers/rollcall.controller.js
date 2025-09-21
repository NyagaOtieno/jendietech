const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const checkIn = async (req, res) => {
  const { rollCallId, userId, status, latitude, longitude } = req.body;
  try {
    const entry = await prisma.rollCallUser.create({
      data: {
        rollCallId,
        userId,
        status,
        checkIn: new Date(),
        latitude,
        longitude
      }
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const checkOut = async (req, res) => {
  const { rollCallId, userId, status, latitude, longitude } = req.body;
  try {
    const entry = await prisma.rollCallUser.updateMany({
      where: { rollCallId, userId },
      data: { status, checkOut: new Date(), latitude, longitude }
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { checkIn, checkOut };
