// nucash-server/routes/userdashboard.js
// API routes for user dashboard (students/employees)

import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import UserConcern from '../models/UserConcern.js';
import Shuttle from '../models/Shuttle.js'; 

import bcrypt from 'bcrypt';

// JWT verification middleware
const getJWTSecret = () => process.env.JWT_SECRET || 'nucash_secret_2025';

/**
 * POST /api/user/auth/login
 * User login (students/employees)
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, pin } = req.body;

    console.log('🔐 User login attempt:', email);

    if (!email || !pin) {
      return res.status(400).json({
        error: 'Email and PIN are required'
      });
    }

    // Find user by email
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${email.trim().toLowerCase()}$`, 'i') }
    });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        error: 'Invalid email or PIN'
      });
    }

    // Verify PIN
    let isValidPin = false;
    if (user.pin.startsWith('$2b$') || user.pin.startsWith('$2a$')) {
      // Hashed PIN
      isValidPin = await bcrypt.compare(pin, user.pin);
    } else {
      // Plain text PIN (temporary PIN from registration)
      isValidPin = user.pin === pin;
    }

    if (!isValidPin) {
      console.log('❌ Invalid PIN for user:', email);
      return res.status(401).json({
        error: 'Invalid email or PIN'
      });
    }

    // Check if user needs activation (first login with temporary PIN)
    if (!user.isActive) {
      console.log('⚠️  User account needs activation:', email);
      return res.status(403).json({
        requiresActivation: true,
        accountId: user._id.toString(),
        accountType: 'user',
        email: user.email,
        fullName: user.fullName || `${user.firstName} ${user.lastName}`,
        message: 'Account activation required. Please change your temporary PIN.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        userId: user.userId,
        email: user.email,
        role: user.role
      },
      getJWTSecret(),
      { expiresIn: '24h' }
    );

    console.log('✅ User login successful:', user.fullName || `${user.firstName} ${user.lastName}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        userId: user.userId,
        schoolUId: user.schoolUId,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName || `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        balance: user.balance,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('❌ User login error:', error);
    res.status(500).json({
      error: 'Server error during login'
    });
  }
});

const verifyUserToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJWTSecret());

    // Find the user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * GET /api/user/balance
 * Get current user's balance (JWT authenticated)
 */
router.get('/balance', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    return res.json({
      success: true,
      balance: user.balance,
      name: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      schoolUId: user.schoolUId,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/transactions
 * Get current user's transactions (JWT authenticated)
 */
router.get('/transactions', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build query - search by user's _id or schoolUId
    const query = {
      $or: [
        { userId: user._id },
        { schoolUId: user.schoolUId }
      ]
    };

    // Add date filters if provided
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) {
        query.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    // Add transaction type filter
    if (req.query.transactionType) {
      query.transactionType = req.query.transactionType;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query)
    ]);

    // ✅ Get unique shuttle IDs from transactions
    const shuttleIds = [...new Set(
      transactions
        .filter(tx => tx.shuttleId)
        .map(tx => tx.shuttleId)
    )];

    // ✅ Fetch all shuttles in one query
    const Shuttle = mongoose.model('Shuttle');
    const shuttles = await Shuttle.find({ 
      shuttleId: { $in: shuttleIds } 
    }).lean();

    // ✅ Create a map of shuttleId -> plateNumber for quick lookup
    const shuttleMap = {};
    shuttles.forEach(shuttle => {
      shuttleMap[shuttle.shuttleId] = shuttle.plateNumber;
    });

    // ✅ Format transactions for frontend with ALL needed fields
    const formattedTransactions = transactions.map(tx => {
      // 🐛 DEBUG: Log first transaction to see what fields exist
      if (transactions.indexOf(tx) === 0) {
        console.log('📊 Sample transaction from DB:', {
          transactionId: tx.transactionId,
          shuttleId: tx.shuttleId,
          plateNumber: tx.shuttleId ? shuttleMap[tx.shuttleId] : null,
          merchantId: tx.merchantId,
          merchantName: tx.merchantName,
          businessName: tx.businessName,
          status: tx.status,
          transactionType: tx.transactionType
        });
      }

      return {
        _id: tx._id.toString(),
        id: tx.transactionId || tx._id.toString(),
        transactionId: tx.transactionId,
        date: new Date(tx.createdAt).toLocaleDateString('en-PH'),
        time: new Date(tx.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        details: tx.transactionType === 'credit' ? 'Cash In' : (tx.merchantId ? 'Purchase' : 'Payment'),
        amount: tx.amount,
        type: tx.transactionType,
        transactionType: tx.transactionType,
        status: tx.status,
        balance: tx.balance,
        shuttleId: tx.shuttleId,
        plateNumber: tx.shuttleId ? shuttleMap[tx.shuttleId] : null, // ✅ Add plateNumber from lookup
        merchantId: tx.merchantId,
        merchantName: tx.merchantName,
        businessName: tx.businessName,
        createdAt: tx.createdAt
      };
    });

    return res.json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/concerns/my-concerns
 * Get current user's submitted concerns (JWT authenticated)
 */
router.get('/concerns/my-concerns', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;

    const concerns = await UserConcern.find({
      $or: [
        { userId: user._id },
        { userEmail: user.email }
      ]
    })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      concerns: concerns
    });
  } catch (error) {
    console.error('Error fetching concerns:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/profile
 * Get current user's profile (JWT authenticated)
 */
router.get('/profile', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    return res.json({
      success: true,
      _id: user._id,
      userId: user.userId,
      schoolUId: user.schoolUId,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      fullName: user.fullName || `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
      balance: user.balance,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/merchants
 * Get list of active merchants for concern dropdown
 */
router.get('/merchants', verifyUserToken, async (req, res) => {
  try {
    const Merchant = (await import('../models/Merchant.js')).default;

    const merchants = await Merchant.find({ isActive: true })
      .select('merchantId businessName')
      .sort({ businessName: 1 })
      .lean();

    return res.json({
      success: true,
      merchants: merchants.map(m => ({
        value: m.businessName,
        label: m.businessName
      }))
    });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/:userId
 * Get user info and balance (by userId param - for admin use)
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      _id: user._id,
      userId: user.userId,
      schoolUId: user.schoolUId,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      balance: user.balance,
      isActive: user.isActive,
      isVerified: user.isVerified
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/:userId/transactions?limit=10
 * Get user's recent transactions (by userId param - for admin use)
 */
router.get('/:userId/transactions', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/:userId/concerns
 * Get user's submitted concerns (by userId param - for admin use)
 */
router.get('/:userId/concerns', async (req, res) => {
  try {
    const { userId } = req.params;

    const concerns = await UserConcern.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(concerns);
  } catch (error) {
    console.error('Error fetching concerns:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/user/concerns
 * Submit a new concern (assistance request)
 */
router.post('/concerns', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { department, merchant, subject, details } = req.body;

    if (!department) {
      return res.status(400).json({ error: 'Department is required' });
    }

    if (!subject || !details) {
      return res.status(400).json({ error: 'Subject and details are required' });
    }

    // Build the reportTo field based on department
    let reportTo = department;
    if (department === 'merchants') {
      reportTo = 'Merchant Office';
    }

    const concern = await UserConcern.create({
      userId: user._id,
      userName: user.fullName || `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      submissionType: 'assistance',
      reportTo,
      subject,
      feedbackText: details,
      selectedConcerns: [subject],
      status: 'pending',
      priority: 'medium'
    });

    console.log('✅ Concern submitted:', concern.concernId, 'by', user.email);

    return res.json({
      success: true,
      concernId: concern.concernId,
      message: 'Concern submitted successfully'
    });
  } catch (error) {
    console.error('Error creating concern:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/user/feedback
 * Submit feedback with rating
 */
router.post('/feedback', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { department, merchant, subject, feedback, rating } = req.body;

    if (!department) {
      return res.status(400).json({ error: 'Department is required' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating (1-5) is required' });
    }

    // Build the reportTo field based on department
    let reportTo = department;
    if (department === 'merchants' && merchant) {
      reportTo = merchant;
    }

    const feedbackDoc = await UserConcern.create({
      userId: user._id,
      userName: user.fullName || `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      submissionType: 'feedback',
      reportTo,
      subject: subject || null,
      feedbackText: feedback || null,
      rating,
      status: null,
      priority: null
    });

    console.log('✅ Feedback submitted:', feedbackDoc.concernId, 'by', user.email, 'Rating:', rating);

    return res.json({
      success: true,
      concernId: feedbackDoc.concernId,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// USER PROFILE & SECURITY ENDPOINTS
// ============================================================

// OTP storage for deactivation (in production, use Redis)
const deactivationOtpStore = new Map();

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { firstName, lastName, phone } = req.body;

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;

    await user.save();

    return res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/user/change-pin
 * Change user PIN
 */
router.post('/change-pin', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({ error: 'Current and new PIN are required' });
    }

    if (!/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
    }

    // Verify current PIN
    let isValidPin = false;
    if (user.pin.startsWith('$2b$') || user.pin.startsWith('$2a$')) {
      isValidPin = await bcrypt.compare(currentPin, user.pin);
    } else {
      isValidPin = user.pin === currentPin;
    }

    if (!isValidPin) {
      return res.status(401).json({ error: 'Current PIN is incorrect' });
    }

    // Hash and save new PIN
    const salt = await bcrypt.genSalt(10);
    user.pin = await bcrypt.hash(newPin, salt);
    await user.save();

    return res.json({
      success: true,
      message: 'PIN changed successfully'
    });
  } catch (error) {
    console.error('Error changing PIN:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/user/send-deactivation-otp
 * Send OTP for account deactivation verification
 */
router.post('/send-deactivation-otp', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Deactivation reason is required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with expiry (10 minutes)
    deactivationOtpStore.set(user.email, {
      otp,
      reason: reason.trim(),
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Send email with OTP
    const { sendDeactivationOtpEmail } = await import('../services/emailService.js');

    try {
      await sendDeactivationOtpEmail(user.email, user.firstName || 'User', otp);
      console.log(`📧 Deactivation OTP sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send deactivation OTP email:', emailError);
      // In development, log the OTP
      console.log(`📝 Development OTP for ${user.email}: ${otp}`);
    }

    return res.json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    console.error('Error sending deactivation OTP:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/user/request-deactivation
 * Submit deactivation request with OTP verification
 */
router.post('/request-deactivation', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { reason, otp } = req.body;

    if (!reason || !otp) {
      return res.status(400).json({ error: 'Reason and verification code are required' });
    }

    // Verify OTP
    const storedData = deactivationOtpStore.get(user.email);

    if (!storedData) {
      return res.status(400).json({ error: 'No verification code found. Please request a new code.' });
    }

    if (Date.now() > storedData.expiresAt) {
      deactivationOtpStore.delete(user.email);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (storedData.otp !== otp) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // Clear OTP
    deactivationOtpStore.delete(user.email);

    // Create deactivation request as a concern
    await UserConcern.create({
      userId: user._id,
      userName: user.fullName || `${user.firstName} ${user.lastName}`,
      userEmail: user.email,
      submissionType: 'assistance',
      reportTo: 'sysad',
      subject: 'Account Deactivation Request',
      feedbackText: `User has requested account deactivation.\n\nReason: ${reason.trim()}\n\nCurrent Balance: ₱${user.balance.toFixed(2)}\nSchool ID: ${user.schoolUId}`,
      selectedConcerns: ['Account Deactivation'],
      status: 'pending',
      priority: 'high'
    });

    // Log the request
    const { logUserAction } = await import('../utils/logger.js');
    await logUserAction({
      userId: user._id,
      userName: user.fullName || `${user.firstName} ${user.lastName}`,
      action: 'Deactivation Request',
      description: 'submitted an account deactivation request',
      details: { reason: reason.trim() }
    });

    console.log(`⚠️ Deactivation request from ${user.email}`);

    return res.json({
      success: true,
      message: 'Deactivation request submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting deactivation request:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/user/request-transaction-history
 * Send transaction history to user's email
 */
router.post('/request-transaction-history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJWTSecret());

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { startDate, endDate, type } = req.body;

    // Build query for transactions
    const query = { userId: user._id };
    if (type) query.transactionType = type;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    // Fetch transactions
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // Import nodemailer
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'nucashsystem@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password'
      }
    });

    // Format transactions for email
    const userName = user.fullName || `${user.firstName} ${user.lastName}`.trim();
    const dateRange = startDate && endDate 
      ? `from ${startDate} to ${endDate}` 
      : startDate ? `from ${startDate}` 
      : endDate ? `until ${endDate}` 
      : 'all time';

    let transactionRows = '';
    let totalCredit = 0;
    let totalDebit = 0;

    transactions.forEach(tx => {
      const date = new Date(tx.createdAt).toLocaleDateString('en-PH', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      });
      const amount = tx.amount || 0;
      const txType = tx.transactionType === 'credit' ? 'Cash-In' : 'Payment';
      const sign = tx.transactionType === 'credit' ? '+' : '-';
      const color = tx.transactionType === 'credit' ? '#22C55E' : '#EF4444';
      
      if (tx.transactionType === 'credit') totalCredit += amount;
      else totalDebit += amount;

      transactionRows += `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px; font-size: 13px;">${date}</td>
          <td style="padding: 12px; font-size: 13px;">${txType}</td>
          <td style="padding: 12px; font-size: 13px;">${tx.description || tx.merchantName || 'Transaction'}</td>
          <td style="padding: 12px; font-size: 13px; color: ${color}; font-weight: 600;">${sign}₱${amount.toFixed(2)}</td>
          <td style="padding: 12px; font-size: 13px;">${tx.status || 'Completed'}</td>
        </tr>
      `;
    });

    const mailOptions = {
      from: `"NUCash System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '📊 NUCash - Your Transaction History',
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; border-bottom: 3px solid #FFD41C; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #181D40; margin: 0; }
    .summary { display: flex; gap: 20px; margin-bottom: 30px; }
    .summary-card { flex: 1; padding: 20px; border-radius: 10px; text-align: center; }
    .credit-card { background: #DCFCE7; }
    .debit-card { background: #FEE2E2; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #181D40; color: #FFD41C; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Transaction History</h1>
      <p style="color: #666;">NUCash System</p>
    </div>

    <p>Hello <strong>${userName}</strong>,</p>
    <p>Here is your requested transaction history (${dateRange}):</p>

    <div style="display: flex; gap: 20px; margin: 20px 0;">
      <div style="flex: 1; padding: 20px; border-radius: 10px; background: #DCFCE7; text-align: center;">
        <p style="margin: 0; color: #166534; font-size: 12px; font-weight: 600;">TOTAL CASH-IN</p>
        <p style="margin: 5px 0 0 0; color: #22C55E; font-size: 24px; font-weight: 700;">+₱${totalCredit.toFixed(2)}</p>
      </div>
      <div style="flex: 1; padding: 20px; border-radius: 10px; background: #FEE2E2; text-align: center;">
        <p style="margin: 0; color: #991B1B; font-size: 12px; font-weight: 600;">TOTAL PAYMENTS</p>
        <p style="margin: 5px 0 0 0; color: #EF4444; font-size: 24px; font-weight: 700;">-₱${totalDebit.toFixed(2)}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Description</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${transactionRows || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">No transactions found</td></tr>'}
      </tbody>
    </table>

    <p style="margin-top: 20px; color: #666; font-size: 13px;">
      <strong>Total Transactions:</strong> ${transactions.length}<br>
      <strong>Current Balance:</strong> ₱${user.balance?.toFixed(2) || '0.00'}
    </p>

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

    await transporter.sendMail(mailOptions);
    console.log(`📧 Transaction history sent to ${user.email}`);

    res.json({
      success: true,
      message: 'Transaction history has been sent to your email'
    });
  } catch (error) {
    console.error('Error sending transaction history:', error);
    res.status(500).json({ error: 'Failed to send transaction history' });
  }
});

export default router;