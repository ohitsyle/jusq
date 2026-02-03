// Test script to verify RFID conversion functionality
import { convertRfidToHexLittleEndian, validateRfidFormat, formatRfidForDisplay } from './utils/rfidConverter.js';

console.log('🧪 Testing RFID Conversion Functions\n');

// Test cases with various RFID formats
const testCases = [
  // Decimal numbers
  { input: '123456789', expected: '75BCD15', description: 'Decimal number' },
  { input: '987654321', expected: '3ADE68B1', description: 'Large decimal number' },
  { input: '123', expected: '7B', description: 'Small decimal number' },
  
  // Hex formats
  { input: 'ABC123', expected: 'ABC123', description: 'Hex string' },
  { input: 'abc123', expected: 'ABC123', description: 'Lowercase hex' },
  { input: '75BCD15', expected: '75BCD15', description: 'Hex from decimal conversion' },
  
  // Mixed formats
  { input: 'RFID-123456', expected: '1E240', description: 'Mixed alphanumeric (extract numbers)' },
  { input: 'TAG:ABC123', expected: 'ABC123', description: 'Mixed with hex' },
  
  // Edge cases
  { input: '0', expected: '0', description: 'Zero' },
  { input: 'FF', expected: 'FF', description: 'Two-digit hex' },
  { input: '255', expected: 'FF', description: 'Decimal 255 to hex' },
];

console.log('🔄 Testing convertRfidToHexLittleEndian:');
testCases.forEach(({ input, expected, description }) => {
  const result = convertRfidToHexLittleEndian(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${description}: "${input}" → "${result}" (expected: "${expected}")`);
});

console.log('\n✅ Testing validateRfidFormat:');
const validationTests = [
  { input: '123456', expected: true, description: 'Valid decimal' },
  { input: 'ABC123', expected: true, description: 'Valid hex' },
  { input: 'abc123', expected: true, description: 'Valid lowercase hex' },
  { input: 'RFID-123', expected: false, description: 'Invalid mixed format' },
  { input: '', expected: false, description: 'Empty string' },
  { input: null, expected: false, description: 'Null value' },
  { input: undefined, expected: false, description: 'Undefined value' },
];

validationTests.forEach(({ input, expected, description }) => {
  const result = validateRfidFormat(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${description}: "${input}" → ${result} (expected: ${expected})`);
});

console.log('\n🎨 Testing formatRfidForDisplay:');
const displayTests = [
  { input: 'ABC123', expected: 'AB C1 23', description: '6-digit hex' },
  { input: '12345678', expected: '12 34 56 78', description: '8-digit hex' },
  { input: 'ABC', expected: 'ABC', description: '3-digit hex' },
  { input: '123', expected: '7B', description: 'Decimal converted then formatted' },
];

displayTests.forEach(({ input, expected, description }) => {
  const result = formatRfidForDisplay(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${description}: "${input}" → "${result}" (expected: "${expected}")`);
});

console.log('\n🎯 Real-world RFID conversion examples:');
const realWorldTests = [
  '1234567890123',
  'A1B2C3D4E5F6',
  '9876543210987654321',
  'RFID-001234567890',
  'TAG-ABCDEF123456',
];

realWorldTests.forEach(input => {
  const converted = convertRfidToHexLittleEndian(input);
  const formatted = formatRfidForDisplay(converted);
  console.log(`📝 "${input}" → "${converted}" → "${formatted}"`);
});

console.log('\n✅ RFID conversion testing completed!');
