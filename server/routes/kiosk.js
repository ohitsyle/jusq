// nucash-server/routes/kiosk.js
// Self-service registration kiosk (public — the kiosk is not logged in).
// Treasury remains the primary registration channel; this is a backup channel
// with tighter validation and per-IP rate limiting.
//
// The NUCash app uses the same endpoints with { source: 'phone' } so students
// can register on their own phone instead of queueing at the kiosk.
//
// Identity controls (see user manual):
//  - Email follows the account email rule (utils/emailPolicy.js: any address
//    for now, school domains only once ACCOUNT_EMAIL_DOMAINS is set). The
//    temporary PIN is delivered ONLY to that mailbox, so an account can't be
//    activated by anyone but the mailbox owner.
//  - RFID is validated/normalized with the same converter Treasury uses, and
//    must not already belong to someone.
//  - Every kiosk registration is logged to the Treasury event log for audit.

import express from 'express';
import User from '../models/User.js';
import { sendTemporaryPIN } from '../services/emailService.js';
import { convertRfidToHexLittleEndian, validateRfidFormat } from '../utils/rfidConverter.js';
import { logAdminAction } from '../utils/logger.js';
import { pushScan, takeScan, RELAY_TARGETS } from '../utils/scanRelay.js';
import { accountEmailProblem } from '../utils/emailPolicy.js';

const router = express.Router();


const NAME_RE = /^[A-Za-zÀ-ÿÑñ' .-]{1,40}$/;

// ---- simple per-IP rate limiting (kiosk is a public endpoint) --------------
const hits = new Map(); // key -> { count, windowStart }
function limited(ip, bucket, max, windowMs) {
  const key = `${bucket}|${ip}`;
  const now = Date.now();
  const e = hits.get(key);
  if (e && now - e.windowStart <= windowMs) {
    if (e.count >= max) return true;
    e.count += 1;
    return false;
  }
  hits.set(key, { count: 1, windowStart: now });
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of hits) if (now - e.windowStart > 60 * 60 * 1000) hits.delete(k);
}, 10 * 60 * 1000).unref();

// The phone reads the card's raw chip ID (hex). Payments look cards up by that
// exact value, so an app registration must store it unchanged — the kiosk's
// reader converter would byte-reverse 7-byte IDs and break later taps.
const PHONE_UID_RE = /^([0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$/;
const fromPhone = (req) => req.body?.source === 'phone';
function cardKey(req) {
  const raw = String(req.body?.rfid || '').trim();
  if (fromPhone(req)) {
    const hex = raw.replace(/[\s:-]/g, '').toUpperCase();
    return PHONE_UID_RE.test(hex) ? hex : null;
  }
  return raw && validateRfidFormat(raw) ? convertRfidToHexLittleEndian(raw) : null;
}

// ---- phone-as-scanner relay (for testing without a USB RFID reader) --------
// A phone in the app's hidden Scanner Mode reads a card via NFC and POSTs the
// UID here, picking the kiosk, a Treasury Cash-In window or System Admin's
// Add New User form as the destination (see utils/scanRelay.js).

/** POST /api/kiosk/relay  { uid, target?: 'kiosk' | 'treasury' | 'sysad' } */
router.post('/relay', (req, res) => {
  if (limited(req.ip, 'relay', 60, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many scans. Please wait a moment.' });
  }
  const uid = String(req.body?.uid || '').replace(/[\s:-]/g, '').toUpperCase();
  if (!uid || !validateRfidFormat(uid)) {
    return res.status(400).json({ error: 'Invalid card UID' });
  }
  const target = RELAY_TARGETS.includes(req.body?.target) ? req.body.target : 'kiosk';
  pushScan(target, uid);
  console.log(`[Scanner relay] ${target} scan received`);
  res.json({ success: true });
});

/** GET /api/kiosk/relay/latest — kiosk polls; returns a fresh scan once, then clears it */
router.get('/relay/latest', (req, res) => {
  res.json({ uid: takeScan('kiosk') });
});

/**
 * POST /api/kiosk/check-card  { rfid }
 * Is this card already registered?
 */
router.post('/check-card', async (req, res) => {
  try {
    // Phones share campus Wi-Fi (one IP for many students), so their cap is higher.
    if (limited(req.ip, fromPhone(req) ? 'check-phone' : 'check', fromPhone(req) ? 300 : 60, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }

    const converted = cardKey(req);
    if (!converted) {
      return res.status(400).json({ error: 'Card not recognized. Please tap your school ID.' });
    }
    const user = await User.findOne({ rfidUId: converted }).select('firstName isActive').lean();

    return res.json({
      registered: !!user,
      firstName: user ? user.firstName : null,
      activated: user ? !!user.isActive : null
    });
  } catch (error) {
    console.error('Kiosk check-card error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

/**
 * POST /api/kiosk/register  { rfid, email, firstName, middleName, lastName, schoolUId }
 * Creates an INACTIVE account (same as Treasury registration) and emails a
 * temporary PIN to the school email. Activation happens on the website.
 */
router.post('/register', async (req, res) => {
  try {
    let { email, firstName, middleName, lastName, schoolUId } = req.body;
    email = String(email || '').trim().toLowerCase();

    // Kiosk: 10 an hour per kiosk. App: phones on campus Wi-Fi share one IP, so
    // allow more per IP but only 3 attempts an hour per email address.
    const tooMany = fromPhone(req)
      ? limited(req.ip, 'register-phone', 60, 60 * 60 * 1000) || limited(email || req.ip, 'register-email', 3, 60 * 60 * 1000)
      : limited(req.ip, 'register', 10, 60 * 60 * 1000);
    if (tooMany) {
      return res.status(429).json({ error: fromPhone(req)
        ? 'Too many registration attempts. Please try again later or visit the Treasury Office.'
        : 'Too many registrations from this kiosk. Please see the Treasury Office.' });
    }
    firstName = String(firstName || '').trim();
    middleName = String(middleName || '').trim();
    lastName = String(lastName || '').trim();
    const schoolDigits = String(schoolUId || '').replace(/\D/g, '');

    // --- validation -----------------------------------------------------
    const converted = cardKey(req);
    if (!converted) {
      return res.status(400).json({ error: 'Card not recognized. Please restart and tap your school ID again.' });
    }
    const emailProblem = accountEmailProblem(email);
    if (emailProblem) return res.status(400).json({ error: emailProblem });
    if (!NAME_RE.test(firstName)) return res.status(400).json({ error: 'Please enter a valid first name.' });
    if (!NAME_RE.test(lastName)) return res.status(400).json({ error: 'Please enter a valid last name.' });
    if (middleName && !NAME_RE.test(middleName)) return res.status(400).json({ error: 'Please enter a valid middle name.' });
    if (schoolDigits.length !== 10) {
      return res.status(400).json({ error: 'School ID must be 10 digits (e.g. 2023-121235).' });
    }

    // --- uniqueness -------------------------------------------------------
    if (await User.findOne({ rfidUId: converted })) {
      return res.status(409).json({ error: 'This ID card is already registered.' });
    }
    if (await User.findOne({ schoolUId: schoolDigits })) {
      return res.status(409).json({ error: 'This school ID number is already registered.' });
    }
    if (await User.findOne({ email })) {
      return res.status(409).json({ error: 'This email is already registered.' });
    }

    // --- create (mirrors Treasury registration) ---------------------------
    const tempPin = String(Math.floor(100000 + Math.random() * 900000));
    const lastUser = await User.findOne().sort({ userId: -1 });
    const userId = lastUser && lastUser.userId ? lastUser.userId + 1 : 100000;

    const user = new User({
      userId,
      schoolUId: schoolDigits,
      rfidUId: converted,
      firstName,
      lastName,
      middleName,
      email,
      pin: tempPin, // plaintext temp PIN, replaced (and hashed) at activation — same as Treasury flow
      role: 'student',
      balance: 0,
      isActive: false, // must activate on the website (change PIN)
      isDeactivated: false
    });
    await user.save();

    // --- email the temporary PIN ------------------------------------------
    let emailSent = false;
    try {
      const formattedSchoolId = `${schoolDigits.slice(0, 4)}-${schoolDigits.slice(4)}`;
      emailSent = await sendTemporaryPIN(email, tempPin, `${firstName} ${lastName}`, formattedSchoolId);
    } catch (e) {
      console.error('Kiosk temp-PIN email failed:', e.message);
    }

    // --- audit trail (appears in Treasury logs) ----------------------------
    logAdminAction({
      action: fromPhone(req) ? 'User Registered (App)' : 'User Registered (Kiosk)',
      description: `${fromPhone(req) ? 'NUCash app' : 'Kiosk'} self-registration: ${firstName} ${lastName} (${schoolDigits})`,
      adminId: fromPhone(req) ? 'app' : 'kiosk',
      adminName: fromPhone(req) ? 'NUCash App' : 'Registration Kiosk',
      adminRole: 'treasury',
      department: 'treasury',
      targetEntity: 'user',
      targetId: user._id.toString(),
      crudOperation: 'registration',
      changes: { schoolUId: schoolDigits, rfidUId: converted, email, via: fromPhone(req) ? 'app' : 'kiosk' },
      ipAddress: req.ip
    }).catch(() => {});

    return res.status(201).json({ success: true, emailSent });
  } catch (error) {
    console.error('Kiosk registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again or visit the Treasury Office.' });
  }
});

export default router;
