const axios = require("axios");

// ✅ Helper (ADDED, not replacing anything)
function formatPhone(to) {
  if (!to) return null;

  let phone = String(to).trim().replace(/\s+/g, "");

  if (phone.startsWith("+254")) return phone;
  if (phone.startsWith("254")) return `+${phone}`;
  if (phone.startsWith("0")) return `+254${phone.slice(1)}`;

  return phone;
}

async function sendSmsMSpace({ to, message }) {
  const baseURL = process.env.MSPACE_BASE_URL || "https://api.mspace.co.ke/smsapi/v2";
  const apikey = process.env.MSPACE_API_KEY;
  const username = process.env.MSPACE_USERNAME;
  const senderId = process.env.MSPACE_SENDER_ID;

  if (!apikey || !username || !senderId) {
    throw new Error("Missing MSPACE_API_KEY/MSPACE_USERNAME/MSPACE_SENDER_ID in .env");
  }

  // ✅ FORMAT NUMBER (added safely)
  const formattedTo = formatPhone(to);
  if (!formattedTo) throw new Error(`Invalid phone: ${to}`);

  const payload = {
    username,
    senderId,
    recipient: formattedTo,
    message,
  };

  const res = await axios.post(`${baseURL}/sendtext`, payload, {
    headers: {
      apikey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 15000,
  });

  // ✅ LOG RESPONSE (added)
  console.log("📡 MSpace Response:", res.data);

  return res.data;
}

module.exports = { sendSmsMSpace };