// Test frontend RFID conversion
const normalizeRfidHex = (input) => {
  if (!input) return '';

  // Remove any whitespace and convert to uppercase
  let cleaned = input.replace(/\s+/g, '').toUpperCase();
  
  // If it's already in hex format (contains A-F but not only digits), just validate and return
  if (/[A-F]/.test(cleaned) && /^[0-9A-F]+$/.test(cleaned)) {
    return cleaned;
  }
  
  // If it's all digits, convert from decimal to hex
  if (/^\d+$/.test(cleaned)) {
    const decimalValue = parseInt(cleaned, 10);
    let hexValue = decimalValue.toString(16).toUpperCase();
    
    // Ensure it's an even number of characters (pad with leading zero if needed)
    if (hexValue.length % 2 !== 0) {
      hexValue = '0' + hexValue;
    }
    
    return hexValue;
  }
  
  // If it contains mixed format, try to extract the largest numeric part
  const numericParts = cleaned.match(/\d+/g);
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
  return cleaned;
};

console.log('🧪 Testing Frontend RFID Conversion:');
console.log('123456789 →', normalizeRfidHex('123456789'));
console.log('255 →', normalizeRfidHex('255'));
console.log('ABC123 →', normalizeRfidHex('ABC123'));
console.log('RFID-123456 →', normalizeRfidHex('RFID-123456'));
console.log('0 →', normalizeRfidHex('0'));
console.log('abc123 →', normalizeRfidHex('abc123'));
