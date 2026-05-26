import { sendSMS } from "../services/sms.service.js";

export async function notifyUser(req, res) {
  const { phone, message } = req.body;

  try {
    const result = await sendSMS(phone, message);
    res.json({ success: true, response: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
