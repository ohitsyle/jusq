// nucash-server/routes/kiosk.js
// Self-service registration kiosk (public — the kiosk is not logged in).
// Treasury remains the primary registration channel; this is a backup channel
// with tighter validation and per-IP rate limiting.
//
// Identity controls (see user manual):
//  - Email MUST be a school-issued address (allow-listed domains). The
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

const router = express.Router();

// School-issued email domains accepted at the kiosk.
const ALLOWED_EMAIL_DOMAINS = [
  'students.nu-laguna.edu.ph',
  'nu-laguna.edu.ph',
  'nu.edu.ph'
];

const NAME_RE = /^[A-Za-zÀ-ÿÑñ' .-]{1,40}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

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

/**
 * POST /api/kiosk/check-card  { rfid }
 * Is this card already registered?
 */
router.post('/check-card', async (req, res) => {
  try {
    if (limited(req.ip, 'check', 60, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    }

    const { rfid } = req.body;
    if (!rfid || !validateRfidFormat(String(rfid).trim())) {
      return res.status(400).json({ error: 'Card not recognized. Please tap your school ID.' });
    }

    const converted = convertRfidToHexLittleEndian(String(rfid).trim());
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
    if (limited(req.ip, 'register', 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many registrations from this kiosk. Please see the Treasury Office.' });
    }

    let { rfid, email, firstName, middleName, lastName, schoolUId } = req.body;
    email = String(email || '').trim().toLowerCase();
    firstName = String(firstName || '').trim();
    middleName = String(middleName || '').trim();
    lastName = String(lastName || '').trim();
    const schoolDigits = String(schoolUId || '').replace(/\D/g, '');

    // --- validation -----------------------------------------------------
    if (!rfid || !validateRfidFormat(String(rfid).trim())) {
      return res.status(400).json({ error: 'Card not recognized. Please restart and tap your school ID again.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const domain = email.split('@')[1];
    if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      return res.status(400).json({
        error: `Please use your school-issued email (e.g. yourname@${ALLOWED_EMAIL_DOMAINS[0]}).`
      });
    }
    if (!NAME_RE.test(firstName)) return res.status(400).json({ error: 'Please enter a valid first name.' });
    if (!NAME_RE.test(lastName)) return res.status(400).json({ error: 'Please enter a valid last name.' });
    if (middleName && !NAME_RE.test(middleName)) return res.status(400).json({ error: 'Please enter a valid middle name.' });
    if (schoolDigits.length !== 10) {
      return res.status(400).json({ error: 'School ID must be 10 digits (e.g. 2023-121235).' });
    }

    const converted = convertRfidToHexLittleEndian(String(rfid).trim());

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
      action: 'User Registered (Kiosk)',
      description: `Kiosk self-registration: ${firstName} ${lastName} (${schoolDigits})`,
      adminId: 'kiosk',
      adminName: 'Registration Kiosk',
      adminRole: 'treasury',
      department: 'treasury',
      targetEntity: 'user',
      targetId: user._id.toString(),
      crudOperation: 'registration',
      changes: { schoolUId: schoolDigits, rfidUId: converted, email, via: 'kiosk' },
      ipAddress: req.ip
    }).catch(() => {});

    return res.status(201).json({ success: true, emailSent });
  } catch (error) {
    console.error('Kiosk registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again or visit the Treasury Office.' });
  }
});

export default router;
