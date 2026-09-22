// src/utils/maskCard.js
// A card ID with all but its last 4 characters hidden ("•••• •••• 1A2B").
// Card IDs are what the readers trust, so screens never show the full value.
// Same format as the website and server (maskRfid in their rfidConverter.js).
export default function maskCard(id) {
  const cleaned = String(id || '').replace(/[\s:-]/g, '').toUpperCase();
  if (!cleaned) return '';
  return cleaned.length > 4 ? `•••• •••• ${cleaned.slice(-4)}` : '••••••••';
}
