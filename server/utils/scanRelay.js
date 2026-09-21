// server/utils/scanRelay.js
// Phone-as-card-reader relay (testing aid). The NUCash app's hidden Scanner
// Mode reads a card by NFC and pushes its chip ID here; a web page waiting
// for a card picks it up once.
//
//   kiosk    — one public slot (the kiosk page isn't signed in; it only registers)
//   treasury — a private slot per Treasury admin, reachable only with the
//              6-digit pairing code shown on their Cash-In screen, because a
//              card there leads to crediting money.

import crypto from 'crypto';

const SCAN_TTL_MS = 15 * 1000;
const PAIR_TTL_MS = 8 * 60 * 60 * 1000; // a working day

let kioskScan = null; // { uid, at }
const pairsByCode = new Map(); // code -> { adminId, createdAt, scan }
const codeByAdmin = new Map(); // adminId -> code

const fresh = (scan) => scan && Date.now() - scan.at <= SCAN_TTL_MS;

export function pushKioskScan(uid) {
  kioskScan = { uid, at: Date.now() };
}

export function takeKioskScan() {
  if (!fresh(kioskScan)) return null;
  const { uid } = kioskScan;
  kioskScan = null; // consume so it only fires once
  return uid;
}

function livePair(code) {
  const pair = pairsByCode.get(code);
  if (!pair) return null;
  if (Date.now() - pair.createdAt > PAIR_TTL_MS) {
    pairsByCode.delete(code);
    if (codeByAdmin.get(pair.adminId) === code) codeByAdmin.delete(pair.adminId);
    return null;
  }
  return pair;
}

// Same code every time for the same admin until it expires or they disconnect,
// so the phone doesn't need re-pairing each time the Cash-In window opens.
export function pairTreasury(adminId) {
  const existing = codeByAdmin.get(adminId);
  if (existing && livePair(existing)) return existing;
  let code;
  do { code = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } while (pairsByCode.has(code));
  pairsByCode.set(code, { adminId, createdAt: Date.now(), scan: null });
  codeByAdmin.set(adminId, code);
  return code;
}

export function unpairTreasury(adminId) {
  const code = codeByAdmin.get(adminId);
  if (code) pairsByCode.delete(code);
  codeByAdmin.delete(adminId);
}

// false when the code isn't active (wrong, expired, or disconnected)
export function pushTreasuryScan(code, uid) {
  const pair = livePair(code);
  if (!pair) return false;
  pair.scan = { uid, at: Date.now() };
  return true;
}

export function takeTreasuryScan(adminId) {
  const code = codeByAdmin.get(adminId);
  const pair = code && livePair(code);
  if (!pair || !fresh(pair.scan)) return null;
  const { uid } = pair.scan;
  pair.scan = null;
  return uid;
}

setInterval(() => {
  for (const code of pairsByCode.keys()) livePair(code);
}, 30 * 60 * 1000).unref();
