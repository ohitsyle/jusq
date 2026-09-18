// Philippine mobile numbers, stored as +639XXXXXXXXX (E.164).
// Accepts the ways people actually type them: 09171234567, 9171234567,
// +63 917 123 4567, 63-917-123-4567. Returns null if it isn't a PH mobile.
export function normalizePhMobile(input) {
  if (input == null) return null;
  let digits = String(input).replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return /^9\d{9}$/.test(digits) ? `+63${digits}` : null;
}

// Escape user input before building a RegExp from it, so "." or ".*" match
// literally instead of acting as wildcards.
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
