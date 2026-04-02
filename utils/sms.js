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
function buildJobDoneWithFeedbackSms({ clientName, vehicleReg, jobType, trackingLink }) {
  const name = clientName || "Customer";
  return `Dear ${name}, your speed governor ${jobType} for ${vehicleReg} has been completed. Thank you for choosing JENDIE.\nRate us: ${trackingLink}`;
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

  return `Dear ${name},you have a new job assigned as below:\nVehicle Reg: ${vehicleReg}\nJob Type: ${jobType}\nJob Date:${dateStr}\nLocation and Contact: ${location || "Check app"} login https://jendietech.vercel.app/ to proceed`;
}

module.exports = {
  normalizeKenyaPhone,
  buildJobDoneClientSms,
  buildFeedbackSms,
  buildJobDoneWithFeedbackSms, // ✅ added
  buildJobAssignedTechnicianSms,
};