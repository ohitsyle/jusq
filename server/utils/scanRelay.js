// server/utils/scanRelay.js
// Phone-as-card-reader relay (testing aid). The NUCash app's hidden Scanner
// Mode reads a card by NFC and pushes its chip ID here, choosing where it goes;
// the page waiting for a card picks it up once.
//   kiosk    — the registration kiosk page (not signed in)
//   treasury — a Treasury Cash-In window waiting for a card (Treasury login)

const SCAN_TTL_MS = 15 * 1000;
const slots = { kiosk: null, treasury: null }; // target -> { uid, at }

export const RELAY_TARGETS = Object.keys(slots);

export function pushScan(target, uid) {
  slots[target] = { uid, at: Date.now() };
}

// Each scan is handed out once, and only while fresh
export function takeScan(target) {
  const scan = slots[target];
  slots[target] = null;
  return scan && Date.now() - scan.at <= SCAN_TTL_MS ? scan.uid : null;
}
