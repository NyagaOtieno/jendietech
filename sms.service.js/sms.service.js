import fetch from "node-fetch";

export async function sendSMS(phone, message) {
  const url =
    `http://api.mspace.co.ke/mspaceservice/wr/sms/sendtext/` +
    `username=${process.env.MSPACE_USER}` +
    `/password=${process.env.MSPACE_PASS}` +
    `/senderid=${process.env.MSPACE_SENDER}` +
    `/recipient=${phone}` +
    `/message=${encodeURIComponent(message)}`;

  const response = await fetch(url);
  return await response.text();
}
