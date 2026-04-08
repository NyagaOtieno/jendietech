// src/utils/phone.util.js

/**
 * Check if phone is valid Kenyan number
 */
function isValidKenyanPhone(phone) {
  if (!phone) return false;
  // Remove all extra leading + signs
  phone = phone.trim().replace(/^\++/, '');
  // Must start with 0, 1, or 254
  return /^(?:0|1|254)(?:1|7)\d{8}$/.test(phone);
}

/**
 * Normalize Kenyan phone to +254XXXXXXXXX
 */
function normalizeKenyanPhone(phone) {
  if (!phone) return null;

  // Remove whitespace & leading +
  phone = phone.trim().replace(/^\++/, '');

  // Starts with 0
  if (phone.startsWith("0")) return "+254" + phone.slice(1);

  // Starts with 1 (01XXXXXXXX)
  if (phone.startsWith("1")) return "+254" + phone;

  // Starts with 254
  if (phone.startsWith("254")) return "+" + phone;

  // Already +254
  if (phone.startsWith("+254")) return phone;

  // Invalid
  return null;
}

module.exports = { isValidKenyanPhone, normalizeKenyanPhone };