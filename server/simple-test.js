// Simple test for RFID conversion
function convertRfidToHexLittleEndian(rfid) {
  if (!rfid) return '';

  try {
    let cleanedRfid = rfid.replace(/\s+/g, '').toUpperCase();
    
    // If it's already in hex format (contains A-F but not only digits), just validate and return
    if (/[A-F]/.test(cleanedRfid) && /^[0-9A-F]+$/.test(cleanedRfid)) {
      return cleanedRfid;
    }
    
    // If it's all digits, convert from decimal to hex
    if (/^\d+$/.test(cleanedRfid)) {
      const decimalValue = parseInt(cleanedRfid, 10);
      let hexValue = decimalValue.toString(16).toUpperCase();
      
      if (hexValue.length % 2 !== 0) {
        hexValue = '0' + hexValue;
      }
      
      return hexValue;
    }
    
    return cleanedRfid;
  } catch (error) {
    console.error('❌ RFID conversion error:', error);
    return rfid;
  }
}

console.log('🧪 Testing RFID conversion:');
console.log('123456789 →', convertRfidToHexLittleEndian('123456789'));
console.log('255 →', convertRfidToHexLittleEndian('255'));
console.log('ABC123 →', convertRfidToHexLittleEndian('ABC123'));
console.log('RFID-123456 →', convertRfidToHexLittleEndian('RFID-123456'));
console.log('0 →', convertRfidToHexLittleEndian('0'));
