import express from "express";
import { sendNotificationSMS } from "../controllers/notification.controller.js";

const router = express.Router();

/**
 * POST /api/notifications/sms
 * Triggers an SMS notification
 */
router.post("/sms", sendNotificationSMS);

export default router;
