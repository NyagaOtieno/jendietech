// ----------------------
// utils/sms.js
// ----------------------

function normalizeKenyaPhone(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/\s+/g, "").replace(/[()-]/g, "");

  // ✅ FIX: Support ALL formats correctly for MSpace
  if (/^07\d{8}$/.test(p)) return p;              // 0722XXXXXX
  if (/^\+2547\d{8}$/.test(p)) return p;          // +254722XXXXXX
  if (/^2547\d{8}$/.test(p)) return `+${p}`;      // convert to +254...

  const digits = p.replace(/\D/g, "");
  return digits || null;
}

function buildJobDoneClientSms({ clientName, vehicleReg, jobType }) {
  const name = clientName || "Customer";
  return `Hi ${name}, your job (${jobType}) for ${vehicleReg} is completed. Thank you.`;
}

function buildFeedbackSms({ clientName, feedbackLink }) {
  const name = clientName || "Customer";
  return `Hi ${name}, please rate our service: ${feedbackLink}`;
}

// ✅ NEW: Combined SMS (Completion + Feedback in ONE message)
function buildJobDoneWithFeedbackSms({ clientName, vehicleReg, jobType, feedbackLink }) {
  const name = clientName || "Customer";
  return `Hi ${name}, your job (${jobType}) for ${vehicleReg} is completed. Thank you for choosing JENDIE.\nRate us: ${feedbackLink}`;
}

/**
 * Builds SMS to notify technician of new job assignment
 */
function buildJobAssignedTechnicianSms({
  technicianName,
  vehicleReg,
  jobType,
  scheduledDate,
  location,
}) {
  const name = technicianName || "Technician";

  const dateStr = scheduledDate
    ? new Date(scheduledDate).toLocaleString("en-KE", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Scheduled";

  return `Hi ${name}, new job assigned:\nVehicle: ${vehicleReg}\nType: ${jobType}\n${dateStr}\nLocation: ${location || "Check app"}`;
}

module.exports = {
  normalizeKenyaPhone,
  buildJobDoneClientSms,
  buildFeedbackSms,
  buildJobDoneWithFeedbackSms, // ✅ added
  buildJobAssignedTechnicianSms,
};