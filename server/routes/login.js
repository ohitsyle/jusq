// nucash-server/routes/login.js
// FIXED: 
// 1. Uses driver.fullName (virtual) for proper name display
// 2. Uses bcrypt.compare() for password verification
// 3. Supports merchant email OR username login
// 4. 6-digit PIN support

import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import Driver from '../models/Driver.js';
import Merchant from '../models/Merchant.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import { logLogin } from '../utils/logger.js';

// Don't read JWT_SECRET at module level - dotenv hasn't loaded yet
// Read it inside functions where it's needed
const getJWTSecret = () => process.env.JWT_SECRET || 'nucash_secret_2025';

/**
 * POST /login/check-email
 * Check if email exists and return user name for PIN entry screen
 */
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('📧 Checking email:', normalizedEmail);

    // Check drivers first
    const driver = await Driver.findOne({ 
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
      isActive: true 
    });

    if (driver) {
      // FIXED: Use fullName virtual, or construct from firstName + lastName
      const driverName = driver.fullName || `${driver.firstName} ${driver.lastName}`.trim();
      console.log('✅ Found driver:', driverName);
      return res.json({
        exists: true,
        name: driverName,
        role: 'driver'
      });
    }

    // Check merchants by email OR username
    const merchant = await Merchant.findOne({
      $or: [
        { email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } },
        { username: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } }
      ],
      isActive: true
    });

    if (merchant) {
      console.log('✅ Found merchant:', merchant.contactPerson || merchant.businessName);
      return res.json({
        exists: true,
        name: merchant.contactPerson || merchant.businessName,
        role: 'merchant'
      });
    }

    // Check users (students/employees) - don't filter by isActive to allow activation flow
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });

    if (user) {
      const userName = user.fullName || `${user.firstName} ${user.lastName}`.trim();
      console.log('✅ Found user:', userName, user.isActive ? '(active)' : '(inactive - needs activation)');
      return res.json({
        exists: true,
        name: userName,
        role: user.role // 'student' or 'employee'
      });
    }

    console.log('❌ Email/username not found:', normalizedEmail);
    return res.json({ exists: false });

  } catch (error) {
    console.error('❌ Check email error:', error);
    res.status(500).json({ error: 'Server error checking email' });
  }
});

/**
 * POST /login
 * Authenticate driver or merchant with email + PIN
 * PIN is sent as 'password' field
 */
router.post('/', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email and PIN are required' });
    }

    const normalizedEmail = emailOrUsername.trim().toLowerCase();
    console.log('🔐 Login attempt for:', normalizedEmail);

    // Try driver login first
    const driver = await Driver.findOne({ 
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
      isActive: true 
    });

    if (driver) {
      // FIXED: Use bcrypt.compare() for hashed passwords
      let isValidPin = false;
      
      // Check if password is hashed (starts with $2b$ or $2a$)
      if (driver.password.startsWith('$2b$') || driver.password.startsWith('$2a$')) {
        // Hashed password - use bcrypt compare
        isValidPin = await bcrypt.compare(password, driver.password);
      } else {
        // Plain text password (legacy) - direct compare
        isValidPin = driver.password === password;
      }
      
      if (isValidPin) {
        const token = jwt.sign(
          { id: driver._id, role: 'driver', driverId: driver.driverId },
          getJWTSecret(),
          { expiresIn: '24h' }
        );

        // FIXED: Use fullName virtual or construct name
        const driverName = driver.fullName || `${driver.firstName} ${driver.lastName}`.trim();
        console.log('✅ Driver login successful:', driverName);

        return res.json({
          token,
          role: 'driver',
          driverId: driver.driverId,
          name: driverName,
          email: driver.email
        });
      } else {
        console.log('❌ Invalid PIN for driver:', normalizedEmail);
        return res.status(401).json({ error: 'Invalid PIN' });
      }
    }

    // Try admin login (motorpool, treasury, merchant admins) - check without isActive filter first
    const admin = await Admin.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });

    if (admin) {
      // Use bcrypt.compare() for hashed PINs
      let isValidPin = false;

      if (admin.pin.startsWith('$2b$') || admin.pin.startsWith('$2a$')) {
        isValidPin = await bcrypt.compare(password, admin.pin);
      } else {
        isValidPin = admin.pin === password;
      }

      if (!isValidPin) {
        console.log('❌ Invalid PIN for admin:', normalizedEmail);
        return res.status(401).json({ error: 'Invalid PIN' });
      }

      // Check if admin needs activation
      if (!admin.isActive) {
        console.log('⚠️  Admin account needs activation:', normalizedEmail);
        return res.status(403).json({
          requiresActivation: true,
          accountId: admin._id.toString(),
          accountType: 'admin',
          email: admin.email,
          fullName: `${admin.firstName} ${admin.lastName}`,
          message: 'Account activation required'
        });
      }

      // Admin is active, proceed with login
      console.log('🔐 Signing admin token with getJWTSecret():', getJWTSecret());
      const token = jwt.sign(
        { id: admin._id, role: admin.role || 'admin', adminId: admin.adminId },
        getJWTSecret(),
        { expiresIn: '24h' }
      );

      const adminName = `${admin.firstName} ${admin.lastName}`.trim() || admin.email || 'Admin';
      console.log('✅ Admin login successful:', adminName);

      // Log admin login event
      await logLogin({
        adminId: admin.adminId,
        adminName: adminName,
        userType: `Admin (${admin.role})`,
        adminRole: admin.role,
        department: admin.role,
        ipAddress: req.ip || req.connection?.remoteAddress,
        deviceInfo: req.headers['user-agent']
      });

      return res.json({
        token,
        role: admin.role || 'admin',
        adminId: admin.adminId,
        name: adminName,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName
      });
    }

    // Try merchant login (by email OR username)
    const merchant = await Merchant.findOne({ 
      $or: [
        { email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } },
        { username: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } }
      ],
      isActive: true 
    });

    if (merchant) {
      // FIXED: Use bcrypt.compare() for hashed passwords
      let isValidPin = false;
      
      if (merchant.pin.startsWith('$2b$') || merchant.pin.startsWith('$2a$')) {
        isValidPin = await bcrypt.compare(password, merchant.pin);
      } else {
        isValidPin = merchant.pin === password;
      }
      
      if (isValidPin) {
        const token = jwt.sign(
          { id: merchant._id, role: 'merchant', merchantId: merchant.merchantId },
          getJWTSecret(),
          { expiresIn: '24h' }
        );

        console.log('✅ Merchant login successful:', merchant.businessName);

        return res.json({
          token,
          role: 'merchant',
          merchantId: merchant.merchantId,
          businessName: merchant.businessName,
          contactPerson: merchant.contactPerson
        });
      } else {
        console.log('❌ Invalid PIN for merchant:', normalizedEmail);
        return res.status(401).json({ error: 'Invalid PIN' });
      }
    }

    // Try user login (students/employees) - check without isActive filter first
    console.log(`🔍 Searching for user with email: ${normalizedEmail}`);
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });

    // Debug: List all users in database
    const allUsers = await User.find({}).select('email isActive');
    console.log(`📋 All users in database (${allUsers.length}):`, allUsers.map(u => `${u.email} (active: ${u.isActive})`));

    if (user) {
      // Use bcrypt.compare() for hashed PINs
      let isValidPin = false;

      if (user.pin.startsWith('$2b$') || user.pin.startsWith('$2a$')) {
        isValidPin = await bcrypt.compare(password, user.pin);
      } else {
        isValidPin = user.pin === password;
      }

      if (!isValidPin) {
        console.log('❌ Invalid PIN for user:', normalizedEmail);
        return res.status(401).json({ error: 'Invalid PIN' });
      }

      // Check if user needs activation
      if (!user.isActive) {
        console.log('⚠️  User account needs activation:', normalizedEmail);
        return res.status(403).json({
          requiresActivation: true,
          accountId: user._id.toString(),
          accountType: 'user',
          email: user.email,
          fullName: user.fullName || `${user.firstName} ${user.lastName}`,
          message: 'Account activation required'
        });
      }

      // User is active, proceed with login
      const token = jwt.sign(
        { id: user._id, role: user.role, userId: user.userId },
        getJWTSecret(),
        { expiresIn: '24h' }
      );

      const userName = user.fullName || `${user.firstName} ${user.lastName}`.trim();
      console.log('✅ User login successful:', userName);

      return res.json({
        token,
        role: user.role, // 'student' or 'employee'
        userId: user._id.toString(),
        name: userName,
        email: user.email
      });
    }

    console.log('❌ User not found:', normalizedEmail);
    return res.status(401).json({ error: 'User not found' });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ============================================================================
// FORGOT PIN ENDPOINTS (for Users/Students/Employees)
// ============================================================================

// OTP storage (in production, use Redis or database)
const userOtpStore = new Map();

// Email transporter - created lazily to ensure env vars are loaded
let _transporter = null;
const getTransporter = () => {
  if (!_transporter) {
    console.log('📧 Creating email transporter with:', {
      user: process.env.EMAIL_USER,
      passLength: process.env.EMAIL_PASSWORD?.length || 0
    });
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'nucashsystem@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password'
      }
    });
  }
  return _transporter;
};

/**
 * POST /login/forgot-pin
 * Send OTP to user email for PIN reset
 */
router.post('/forgot-pin', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('📧 Forgot PIN request for:', normalizedEmail);

    // Find user by email
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ 
        success: true, 
        message: 'If your email is registered, you will receive a PIN reset OTP.' 
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with expiry (10 minutes)
    userOtpStore.set(normalizedEmail, {
      otp,
      purpose: 'pin_reset',
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      userId: user._id.toString()
    });

    // Send OTP email
    const userName = user.fullName || `${user.firstName} ${user.lastName}`.trim();
    const mailOptions = {
      from: `"NUCash System" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: '🔐 NUCash - PIN Reset Verification Code',
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 3px solid #FFD41C; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #181D40; margin: 0; }
    .otp-box { background: #181D40; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; }
    .otp-code { font-size: 48px; font-weight: bold; letter-spacing: 10px; color: #FFD41C; margin: 20px 0; font-family: monospace; }
    .otp-label { color: #FBFBFB; font-size: 16px; font-weight: 600; margin: 0; }
    .otp-expiry { color: #FBFBFB; font-size: 14px; margin: 10px 0 0 0; opacity: 0.8; }
    .warning-box { background: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 20px 0; color: #e65100; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 PIN Reset Request</h1>
      <p style="color: #666;">NUCash System</p>
    </div>

    <p>Hello <strong>${userName}</strong>,</p>

    <p>We received a request to reset your PIN. Use the verification code below to proceed:</p>

    <div class="otp-box">
      <p class="otp-label">Your Verification Code</p>
      <div class="otp-code">${otp}</div>
      <p class="otp-expiry">Valid for 10 minutes</p>
    </div>

    <div class="warning-box">
      <strong>⚠️ Security Notice:</strong>
      <ul style="margin: 10px 0 0 0; padding-left: 20px;">
        <li>This code expires in <strong>10 minutes</strong></li>
        <li>Never share this code with anyone</li>
        <li>If you didn't request this, please ignore this email</li>
      </ul>
    </div>

    <div class="footer">
      <p>This is an automated message from NUCash System</p>
      <p>National University - Laguna Campus</p>
      <p>&copy; 2026 NUCash. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `
    };

    try {
      await getTransporter().sendMail(mailOptions);
      console.log(`📧 PIN reset OTP sent to ${normalizedEmail}`);
    } catch (emailError) {
      console.error('❌ Failed to send email:', emailError);
      // Still return success to prevent email enumeration
    }

    res.json({
      success: true,
      message: 'If your email is registered, you will receive a PIN reset OTP.'
    });
  } catch (error) {
    console.error('❌ Forgot PIN error:', error);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

/**
 * POST /login/verify-otp
 * Verify OTP code for PIN reset
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('🔐 Verifying OTP for:', normalizedEmail);

    // Get stored OTP
    const storedOtp = userOtpStore.get(normalizedEmail);

    if (!storedOtp || storedOtp.purpose !== 'pin_reset') {
      return res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
    }

    if (Date.now() > storedOtp.expiresAt) {
      userOtpStore.delete(normalizedEmail);
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    if (storedOtp.otp !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // OTP is valid - mark as verified but don't delete yet (needed for reset)
    storedOtp.verified = true;
    userOtpStore.set(normalizedEmail, storedOtp);

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
  }
});

/**
 * POST /login/reset-pin
 * Reset PIN with verified OTP
 */
router.post('/reset-pin', async (req, res) => {
  try {
    const { email, newPin } = req.body;

    if (!email || !newPin) {
      return res.status(400).json({ error: 'Email and new PIN are required' });
    }

    // Validate PIN format (6 digits)
    if (!/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('🔐 Resetting PIN for:', normalizedEmail);

    // Get stored OTP and verify it was validated
    const storedOtp = userOtpStore.get(normalizedEmail);

    if (!storedOtp || !storedOtp.verified) {
      return res.status(400).json({ error: 'Please verify OTP first' });
    }

    if (Date.now() > storedOtp.expiresAt) {
      userOtpStore.delete(normalizedEmail);
      return res.status(400).json({ error: 'Session expired. Please request a new OTP.' });
    }

    // Find user
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(newPin, salt);

    // Update PIN
    user.pin = hashedPin;
    await user.save();

    // Clear OTP
    userOtpStore.delete(normalizedEmail);

    console.log(`🔐 PIN reset successful for: ${normalizedEmail}`);

    res.json({
      success: true,
      message: 'PIN reset successfully. You can now login with your new PIN.'
    });
  } catch (error) {
    console.error('❌ Reset PIN error:', error);
    res.status(500).json({ error: 'Failed to reset PIN. Please try again.' });
  }
});

export default router;