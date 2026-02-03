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
    // Remove any whitespace and convert to uppercase
    let cleanedRfid = rfid.replace(/\s+/g, '').toUpperCase();
    
    // If it's already in hex format (contains A-F but not only digits), just validate and return
    if (/[A-F]/.test(cleanedRfid) && /^[0-9A-F]+$/.test(cleanedRfid)) {
      return cleanedRfid;
    }
    
    // If it's all digits, convert from decimal to hex
    if (/^\d+$/.test(cleanedRfid)) {
      const decimalValue = parseInt(cleanedRfid, 10);
      
      // Convert to hex
      let hexValue = decimalValue.toString(16).toUpperCase();
      
      // Ensure it's an even number of characters (pad with leading zero if needed)
      if (hexValue.length % 2 !== 0) {
        hexValue = '0' + hexValue;
      }
      
      return hexValue;
    }
    
    // If it contains mixed format, try to extract the largest numeric part
    const numericParts = cleanedRfid.match(/\d+/g);
    if (numericParts && numericParts.length > 0) {
      // Find the largest numeric part
      const largestNumeric = numericParts.reduce((a, b) => a.length > b.length ? a : b);
      const decimalValue = parseInt(largestNumeric, 10);
      
      let hexValue = decimalValue.toString(16).toUpperCase();
      
      if (hexValue.length % 2 !== 0) {
        hexValue = '0' + hexValue;
      }
      
      return hexValue;
    }
    
    // If we can't parse it, return the original cleaned value
    return cleanedRfid;
    
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
