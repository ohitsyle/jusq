// client/src/utils/rfidConverter.js
// Shared RFID conversion utility for all admin modals
// Converts scanned/typed RFID (decimal or hex) to hex little-endian format

/**
 * Convert RFID input to hex little-endian format.
 * RFID scanners typically output a decimal number (e.g., "0013370852").
 * This converts it to the hex little-endian format stored in the database.
 *
 * @param {string} input - Raw RFID input (decimal number or hex string)
 * @returns {string} - RFID in hex little-endian format (uppercase, 8 chars)
 */
export function convertToHexLittleEndian(input) {
  if (!input) return '';

  const cleaned = input.replace(/[\s:-]/g, '').toUpperCase();

  // If it's already an 8-char hex string (already converted), return as-is
  if (/^[0-9A-F]{8}$/.test(cleaned)) {
    return cleaned;
  }

  // If it's a hex string (contains A-F), reverse bytes for little-endian
  if (/^[0-9A-F]+$/.test(cleaned) && /[A-F]/.test(cleaned)) {
    let hex = cleaned;
    if (hex.length % 2 !== 0) hex = '0' + hex;
    while (hex.length < 8) hex = '0' + hex;
    const bytes = hex.match(/.{2}/g) || [];
    return bytes.reverse().join('');
  }

  // If it's all digits (decimal from scanner), convert to hex little-endian
  if (/^\d+$/.test(cleaned)) {
    const decimal = BigInt(cleaned);
    let hex = decimal.toString(16).toUpperCase();
    if (hex.length % 2 !== 0) hex = '0' + hex;
    while (hex.length < 8) hex = '0' + hex;
    // Reverse bytes for little-endian
    const bytes = hex.match(/.{2}/g) || [];
    return bytes.reverse().join('');
  }

  // Can't parse — return cleaned input
  return cleaned;
}

/**
 * Validate RFID format (accepts decimal or hex)
 * @param {string} input - Raw RFID input
 * @returns {boolean}
 */
export function validateRfid(input) {
  if (!input) return false;
  const cleaned = input.replace(/[\s:-]/g, '');
  return /^[0-9A-Fa-f]+$/.test(cleaned) || /^\d+$/.test(cleaned);
}

/**
 * Format RFID for display with spaces (e.g., "A1 B2 C3 D4")
 * @param {string} hex - Hex RFID string
 * @returns {string}
 */
export function formatRfidDisplay(hex) {
  if (!hex) return '';
  return hex.match(/.{2}/g)?.join(' ') || hex;
}

export default { convertToHexLittleEndian, validateRfid, formatRfidDisplay };
