// Utility functions for RFID tag conversion

/**
 * Convert RFID tag to hex little-endian format
 * This handles various RFID tag formats and converts them to consistent hex little-endian
 * 
 * @param {string} rfid - The RFID tag in various formats (decimal, hex, etc.)
 * @returns {string} - RFID in hex little-endian format (uppercase, no spaces)
 */
export function convertRfidToHexLittleEndian(rfid) {
  if (!rfid) {
    return '';
  }

  try {
    // Must stay byte-for-byte identical to the client converter
    // (client/src/utils/rfidConverter.js#convertToHexLittleEndian) so that a
    // value converted on the client and re-converted here is unchanged
    // (idempotent). The DB stores this byte-reversed little-endian form.
    const cleaned = rfid.replace(/[\s:-]/g, '').toUpperCase();

    // Already an 8-char hex string (already converted) — return as-is.
    // This idempotency prevents the old bug where an all-digit converted
    // value (e.g. "56341200") was re-parsed as decimal and corrupted.
    if (/^[0-9A-F]{8}$/.test(cleaned)) {
      return cleaned;
    }

    // Hex string containing A-F — reverse bytes for little-endian.
    if (/^[0-9A-F]+$/.test(cleaned) && /[A-F]/.test(cleaned)) {
      let hex = cleaned;
      if (hex.length % 2 !== 0) hex = '0' + hex;
      while (hex.length < 8) hex = '0' + hex;
      const bytes = hex.match(/.{2}/g) || [];
      return bytes.reverse().join('');
    }

    // All digits (decimal from scanner) — convert to hex, then byte-reverse.
    if (/^\d+$/.test(cleaned)) {
      const decimal = BigInt(cleaned);
      let hex = decimal.toString(16).toUpperCase();
      if (hex.length % 2 !== 0) hex = '0' + hex;
      while (hex.length < 8) hex = '0' + hex;
      const bytes = hex.match(/.{2}/g) || [];
      return bytes.reverse().join('');
    }

    // Can't parse — return the cleaned value.
    return cleaned;

  } catch (error) {
    console.error('❌ RFID conversion error:', error);
    // Return original value if conversion fails
    return rfid;
  }
}

/**
 * Validate RFID tag format
 * @param {string} rfid - The RFID tag to validate
 * @returns {boolean} - True if valid format
 */
export function validateRfidFormat(rfid) {
  if (!rfid) {
    return false;
  }
  
  const cleanedRfid = rfid.replace(/\s+/g, '').toUpperCase();
  
  // Accept hex format (A-F, 0-9) or pure decimal
  return /^[0-9A-F]+$/.test(cleanedRfid) || /^\d+$/.test(cleanedRfid);
}

/**
 * Format RFID for display (consistent format)
 * @param {string} rfid - The RFID tag
 * @returns {string} - Formatted RFID for display
 */
export function formatRfidForDisplay(rfid) {
  if (!rfid) {
    return '';
  }
  
  const hexRfid = convertRfidToHexLittleEndian(rfid);
  
  // Add spaces every 2 characters for readability
  if (hexRfid.length <= 8) {
    return hexRfid.match(/.{2}/g)?.join(' ') || hexRfid;
  }
  
  // For longer RFID tags, still add spaces every 2 characters
  return hexRfid.match(/.{2}/g)?.join(' ') || hexRfid;
}

export default {
  convertRfidToHexLittleEndian,
  validateRfidFormat,
  formatRfidForDisplay
};
