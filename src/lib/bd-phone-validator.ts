/**
 * Bangladeshi Phone Number Validator & Normalizer
 *
 * Valid BD mobile numbers:
 * - 11 digits starting with 01 (013, 014, 015, 016, 017, 018, 019)
 * - May include +88 or 88 country code prefix
 * - May contain spaces, dashes, or parentheses
 */

export const BD_PHONE_REGEX = /^(?:\+?88)?01[3-9]\d{8}$/;

export const BD_PHONE_ERROR_MESSAGE =
  "Please enter a valid 11-digit Bangladeshi mobile number starting with 01 (e.g. 01712345678)";

/**
 * Normalizes a Bangladeshi phone number into standard 11-digit format (e.g. 01712345678)
 */
export function normalizeBDPhone(phone: string): string {
  if (!phone) return "";
  
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, "");

  // If starts with country code 8801..., strip leading 88
  if (digits.startsWith("8801") && digits.length === 13) {
    digits = digits.substring(2);
  }

  return digits;
}

/**
 * Checks whether a given string is a valid Bangladeshi mobile number
 */
export function isValidBDPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;

  const normalized = normalizeBDPhone(phone);
  return /^01[3-9]\d{8}$/.test(normalized);
}
