// src/utils/phone.util.js

const PHONE_REGEX = /^(?:\+254|0)(?:7|1)\d{8}$/;

/**
 * Check if phone is valid Kenyan number
 */
function isValidKenyanPhone(phone) {
  return PHONE_REGEX.test(phone);
}

/**
 * Convert 07XXXXXXXX / 01XXXXXXXX → +2547XXXXXXXX / +2541XXXXXXXX
 */
function normalizeKenyanPhone(phone) {
  phone = phone.trim();

  if (phone.startsWith("0")) {
    return "+254" + phone.slice(1);
  }

  return phone;
}

module.exports = {
  isValidKenyanPhone,
  normalizeKenyanPhone,
};
