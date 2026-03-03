const axios = require("axios");

async function sendSmsMSpace({ to, message }) {
  const baseURL = process.env.MSPACE_BASE_URL || "https://api.mspace.co.ke/smsapi/v2";
  const apikey = process.env.MSPACE_API_KEY;
  const username = process.env.MSPACE_USERNAME;
  const senderId = process.env.MSPACE_SENDER_ID;

  if (!apikey || !username || !senderId) {
    throw new Error("Missing MSPACE_API_KEY/MSPACE_USERNAME/MSPACE_SENDER_ID in .env");
  }

  const payload = {
    username,
    senderId,
    recipient: to,
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

  return res.data;
}

module.exports = { sendSmsMSpace };