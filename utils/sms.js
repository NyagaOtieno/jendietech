function normalizeKenyaPhone(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/\s+/g, "").replace(/[()-]/g, "");

  if (/^07\d{8}$/.test(p)) return `254${p.slice(1)}`;
  if (/^\+2547\d{8}$/.test(p)) return p.slice(1);
  if (/^2547\d{8}$/.test(p)) return p;

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

module.exports = {
  normalizeKenyaPhone,
  buildJobDoneClientSms,
  buildFeedbackSms,
};