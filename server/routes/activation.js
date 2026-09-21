// nucash-server/routes/activation.js
// Account activation flow for users and admins

import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Helper function to generate 6-digit OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// Only someone who just signed in with the temporary PIN may activate.
// The login (and /check-account) hands out this short-lived pass; every step
// below requires it, so knowing an account ID is not enough to set its PIN.
export const issueActivationToken = (account, accountType) => jwt.sign(
  { id: String(account._id), accountType, purpose: 'activation' },
  process.env.JWT_SECRET,
  { expiresIn: '30m' }
);

const WEAK_PINS = ['123456', '654321', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '000000'];
const MAX_OTP_FAILS = 5;
const RESEND_COOLDOWN_MS = 55 * 1000;
const otpFails = new Map(); // accountId -> wrong codes since the last one was issued
const lastOtpSent = new Map(); // accountId -> when a code was last emailed

async function requireActivationPass(req, res, next) {
  const { accountId, accountType } = req.body || {};
  if (!accountId || !['admin', 'user'].includes(accountType)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Body first (the app's API client puts its own login token in the header), then header (web).
  const header = req.headers.authorization || '';
  const token = req.body.activationToken || (header.startsWith('Bearer ') ? header.slice(7) : '');
  let pass;
  try {
    pass = jwt.verify(token || '', process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'Your activation session has expired. Please sign in again with your temporary PIN.', restart: true });
  }
  if (pass.purpose !== 'activation' || pass.id !== String(accountId) || pass.accountType !== accountType) {
    return res.status(403).json({ error: 'Your activation session has expired. Please sign in again with your temporary PIN.', restart: true });
  }

  const Model = accountType === 'admin'
    ? (await import('../models/Admin.js')).default
    : (await import('../models/User.js')).default;
  const account = await Model.findById(accountId);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  if (account.isDeactivated) {
    return res.status(403).json({ error: 'Your account has been deactivated. Please visit ITSO to reactivate your account.', deactivated: true });
  }
  if (account.isActive) {
    return res.status(409).json({ error: 'This account is already activated. Please sign in with your PIN.', alreadyActive: true });
  }
  req.activation = { Model, account };
  next();
}

async function emailActivationCode(Model, account) {
  const otp = generateOTP();
  await Model.findByIdAndUpdate(account._id, { $set: { resetOtp: otp, resetOtpExpireAt: new Date(Date.now() + 10 * 60 * 1000) } });
  otpFails.delete(String(account._id));
  lastOtpSent.set(String(account._id), Date.now());
  const { sendActivationOTP } = await import('../services/emailService.js');
  await sendActivationOTP(account.email, otp, account.fullName || `${account.firstName} ${account.lastName}`);
}

// POST /api/activation/check-account
// Check if account needs activation
router.post('/check-account', async (req, res) => {
  try {
    const { email, pin, accountType } = req.body; // accountType: 'admin' or 'user'

    if (!email || !pin || !accountType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Import appropriate model
    let Model;
    if (accountType === 'admin') {
      const { default: Admin } = await import('../models/Admin.js');
      Model = Admin;
    } else {
      const { default: User } = await import('../models/User.js');
      Model = User;
    }

    // Find account by email
    const account = await Model.findOne({ email: email.toLowerCase().trim() });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Verify PIN - handle both hashed and plain text PINs
    const bcrypt = await import('bcrypt');
    const storedPin = account.pin || account.password;
    let isPinValid = false;

    // Check if PIN is hashed (starts with bcrypt prefix)
    if (storedPin && (storedPin.startsWith('$2b$') || storedPin.startsWith('$2a$'))) {
      // Hashed PIN - use bcrypt compare
      isPinValid = await bcrypt.default.compare(pin, storedPin);
    } else {
      // Plain text PIN (temporary PIN from registration)
      isPinValid = storedPin === pin;
    }

    if (!isPinValid) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // Block deactivated users entirely — they cannot activate
    if (account.isDeactivated) {
      return res.status(403).json({
        error: 'Your account has been deactivated. Please visit ITSO to reactivate your account.',
        deactivated: true
      });
    }

    // Check if account is already active
    if (account.isActive) {
      return res.json({
        needsActivation: false,
        message: 'Account is already active'
      });
    }

    // Account needs activation
    res.json({
      needsActivation: true,
      accountId: account._id,
      activationToken: issueActivationToken(account, accountType === 'admin' ? 'admin' : 'user'),
      email: account.email,
      fullName: account.fullName || `${account.firstName} ${account.lastName}`,
      isActive: account.isActive || false
    });

  } catch (error) {
    console.error('Check account error:', error);
    res.status(500).json({ error: 'Failed to check account' });
  }
});

// POST /api/activation/accept-terms
// Acknowledges the terms. Actual activation happens after PIN change + OTP.
router.post('/accept-terms', requireActivationPass, async (req, res) => {
  console.log(`✅ Terms accepted for ${req.activation.account.email}`);
  res.json({ success: true, message: 'Terms accepted successfully' });
});

// POST /api/activation/set-new-pin
// Sets the new PIN and emails a verification code (only for accounts still
// waiting for activation — see requireActivationPass).
router.post('/set-new-pin', requireActivationPass, async (req, res) => {
  try {
    const { newPin } = req.body;
    const { Model, account } = req.activation;

    if (!/^\d{6}$/.test(String(newPin || ''))) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
    }
    if (WEAK_PINS.includes(newPin)) {
      return res.status(400).json({ error: 'Please choose a stronger PIN' });
    }

    const bcrypt = (await import('bcrypt')).default;
    await Model.findByIdAndUpdate(account._id, { $set: { pin: await bcrypt.hash(newPin, 10) } });
    await emailActivationCode(Model, account);

    res.json({
      success: true,
      message: 'PIN updated successfully. OTP sent to your email.',
      email: account.email
    });
  } catch (error) {
    console.error('Set new PIN error:', error);
    res.status(500).json({ error: 'Failed to set new PIN' });
  }
});

// POST /api/activation/verify-otp
// Checks the emailed code and activates the account. 5 wrong codes void it.
router.post('/verify-otp', requireActivationPass, async (req, res) => {
  try {
    const { otp } = req.body;
    const { Model, account } = req.activation;
    const key = String(account._id);

    if (!otp) return res.status(400).json({ error: 'Missing required fields' });
    if (!account.resetOtp) {
      return res.status(400).json({ error: 'No code found. Please tap "Resend Code".' });
    }
    if (Date.now() > new Date(account.resetOtpExpireAt).getTime()) {
      return res.status(400).json({ error: 'That code has expired. Please tap "Resend Code".' });
    }
    if (account.resetOtp !== String(otp)) {
      const fails = (otpFails.get(key) || 0) + 1;
      otpFails.set(key, fails);
      if (fails >= MAX_OTP_FAILS) {
        otpFails.delete(key);
        await Model.findByIdAndUpdate(account._id, { $set: { resetOtp: '', resetOtpExpireAt: null } });
        return res.status(400).json({ error: 'Too many wrong codes. Please tap "Resend Code" for a new one.' });
      }
      return res.status(400).json({ error: `Invalid code. ${MAX_OTP_FAILS - fails} attempt${MAX_OTP_FAILS - fails === 1 ? '' : 's'} left.` });
    }

    const updated = await Model.findByIdAndUpdate(
      account._id,
      { $set: { isActive: true, resetOtp: '', resetOtpExpireAt: null } },
      { new: true }
    );
    otpFails.delete(key);
    lastOtpSent.delete(key);
    console.log(`✅ Account activated for ${updated.email}`);

    res.json({
      success: true,
      message: 'Account activated successfully!',
      account: {
        email: updated.email,
        fullName: updated.fullName || `${updated.firstName} ${updated.lastName}`,
        role: updated.role || 'user',
        isActive: updated.isActive
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// POST /api/activation/resend-otp
// Emails a fresh code (at most one a minute, so the inbox can't be flooded).
router.post('/resend-otp', requireActivationPass, async (req, res) => {
  try {
    const { Model, account } = req.activation;
    const last = lastOtpSent.get(String(account._id)) || 0;
    if (Date.now() - last < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another code.' });
    }
    await emailActivationCode(Model, account);
    res.json({ success: true, message: 'OTP resent successfully', email: account.email });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

export default router;
