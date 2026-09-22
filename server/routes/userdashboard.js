// nucash-server/routes/userdashboard.js
// API routes for user dashboard (students/employees)
// UPDATED: Simplified deactivation - immediate account freeze, no reason required, force logout

import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import UserConcern from '../models/UserConcern.js';
import Shuttle from '../models/Shuttle.js'; 

import bcrypt from 'bcrypt';
import { copyPinToAdmin, adminOf, issueAdminSession } from '../utils/linkedAccounts.js';

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

    // Check if account is deactivated or inactive
    if (!user.isActive || user.isDeactivated) {
      console.log('⚠️  Account is deactivated/inactive:', email);
      return res.status(403).json({
        error: 'Your account has been deactivated. Please visit ITSO to reactivate your account.',
        deactivated: true
      });
    }

    // Check if account is not yet activated (new account, hasn't changed PIN)
    if (!user.isActive) {
      console.log('⚠️  Account is not yet activated:', email);
      return res.status(403).json({
        error: 'Your account is not yet activated. Please go through the activation process first.',
        needsActivation: true
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

    // Get user from database
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if account is deactivated or inactive
    if (!user.isActive || user.isDeactivated) {
      console.log('⚠️  Account is deactivated/inactive:', user.email);
      return res.status(403).json({
        error: 'Your account has been deactivated. Please visit ITSO to reactivate your account.',
        deactivated: true
      });
    }

    // Logins issued before a security sign-out (e.g. transfer PIN lockout) are dead,
    // and nobody can use the account while it's locked.
    if (user.transferLockedUntil && user.transferLockedUntil > new Date()) {
      const mins = Math.ceil((user.transferLockedUntil - Date.now()) / 60000);
      return res.status(401).json({
        error: `Your account is locked for ${mins} more minute${mins === 1 ? '' : 's'} after 3 wrong PINs. Check your email for details.`,
        locked: true,
        signedOut: true
      });
    }
    if (user.sessionsValidAfter && (decoded.iat || 0) * 1000 < user.sessionsValidAfter.getTime()) {
      return res.status(401).json({
        error: 'You were signed out because your PIN was changed or your account was secured on another device. Please sign in again.',
        signedOut: true
      });
    }

    req.user = user;
    req.tokenClaims = decoded; // e.g. viaAdmin: session opened through the admin login
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

// Signs out every device logged into this account. JWT iat is in whole seconds,
// so the cutoff is floored to the second — a token issued right after (the
// device that made the change) stays valid.
const revokeUserSessions = () => new Date(Math.floor(Date.now() / 1000) * 1000);

const issueUserToken = (user, viaAdmin) => jwt.sign(
  { id: user._id, role: user.role, userId: user.userId, ...(viaAdmin ? { viaAdmin } : {}) },
  getJWTSecret(),
  { expiresIn: '24h' }
);

/**
 * POST /api/user/switch-to-admin
 * From an admin's own wallet back to their admin dashboard. Only for wallet
 * sessions that were opened through that admin's login (token claim
 * viaAdmin), so a wallet signed in some other way can't reach admin pages.
 */
router.post('/switch-to-admin', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user.linkedAdminId || req.tokenClaims?.viaAdmin !== String(user.linkedAdminId)) {
      return res.status(403).json({ error: 'Please sign in with your admin account to open the admin dashboard.' });
    }
    const admin = await adminOf(user);
    if (!admin || admin.isDeactivated || admin.isActive === false) {
      return res.status(403).json({ error: 'Your admin account is not active. Please contact ITSO.' });
    }
    const session = issueAdminSession(admin);
    const { logAdminAction } = await import('../utils/logger.js');
    logAdminAction({
      adminId: admin.adminId, adminName: `${admin.firstName} ${admin.lastName}`.trim(), adminRole: admin.role,
      department: admin.role, action: 'Switched to Admin', description: 'returned to the admin dashboard from their wallet',
      targetEntity: 'admin', targetId: String(admin._id), crudOperation: 'account_switch', ipAddress: req.ip
    }).catch(() => {});
    res.json({ success: true, ...session });
  } catch (error) {
    console.error('Switch to admin error:', error);
    res.status(500).json({ error: 'Could not open the admin dashboard. Please try again.' });
  }
});

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
      return {
        _id: tx._id.toString(),
        id: tx.transactionId || tx._id.toString(),
        transactionId: tx.transactionId,
        date: new Date(tx.createdAt).toLocaleDateString('en-PH'),
        time: new Date(tx.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        details: tx.description || (tx.transactionType === 'credit' ? 'Cash In' : (tx.merchantId ? 'Purchase' : 'Payment')),
        amount: tx.amount,
        type: tx.transactionType,
        transactionType: tx.transactionType,
        status: tx.status,
        balance: tx.balance,
        shuttleId: tx.shuttleId,
        plateNumber: tx.shuttleId ? shuttleMap[tx.shuttleId] : null,
        merchantId: tx.merchantId,
        merchantName: tx.merchantName,
        businessName: tx.businessName,
        description: tx.description || '',
        transferPeerSchoolId: tx.transferPeerSchoolId || null,
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
      isActive: user.isActive,
      pinChangedAt: user.pinChangedAt || null
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/merchants
 * Get list of merchants for the concern/feedback area picker.
 * IMPORTANT: must be defined BEFORE the `/:userId` param route below, otherwise
 * Express matches `/merchants` as `/:userId` (userId="merchants") and this never runs.
 */
router.get('/merchants', verifyUserToken, async (req, res) => {
  try {
    const Merchant = (await import('../models/Merchant.js')).default;

    // Return all merchants (matches the admin merchant list). A student can
    // report a concern to a store regardless of the merchant's own login state.
    const merchants = await Merchant.find()
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
 * GET /api/user/trips
 * The logged-in user's shuttle trip history ("where they went"), joined with
 * route + shuttle details. Defined BEFORE /:userId to avoid route shadowing.
 */
router.get('/trips', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const Transaction = (await import('../models/Transaction.js')).default;
    const Route = (await import('../models/Route.js')).default;
    const Shuttle = (await import('../models/Shuttle.js')).default;

    // Shuttle-related transactions for this user (payments + refunds)
    const txs = await Transaction.find({
      userId: user._id,
      shuttleId: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 }).limit(100).lean();

    const routeIds = [...new Set(txs.map(t => t.routeId).filter(Boolean))];
    const shuttleIds = [...new Set(txs.map(t => t.shuttleId).filter(Boolean))];

    const [routes, shuttles] = await Promise.all([
      Route.find({ routeId: { $in: routeIds } }).lean(),
      Shuttle.find({ shuttleId: { $in: shuttleIds } }).lean()
    ]);
    const routeMap = Object.fromEntries(routes.map(r => [r.routeId, r]));
    const shuttleMap = Object.fromEntries(shuttles.map(s => [s.shuttleId, s]));

    const trips = txs.map(t => {
      const r = routeMap[t.routeId] || {};
      const s = shuttleMap[t.shuttleId] || {};
      return {
        id: t.transactionId || t._id,
        date: t.createdAt,
        fare: t.amount,
        status: t.status,
        isRefund: t.status === 'Refunded',
        routeName: r.routeName || 'NU Shuttle Service',
        from: r.fromName || null,
        to: r.toName || null,
        plateNumber: s.plateNumber || null,
        vehicle: s.vehicleModel || s.vehicleType || null
      };
    });

    res.json({ trips, totalTrips: trips.filter(t => !t.isRefund).length });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/promos
 * Active promotions for end-users + whether the promotions tab is enabled.
 * Defined BEFORE /:userId to avoid route shadowing.
 */
router.get('/promos', verifyUserToken, async (req, res) => {
  try {
    const PromotionCampaign = (await import('../models/PromotionCampaign.js')).default;
    const Configuration = (await import('../models/Configuration.js')).default;

    const cfg = await Configuration.findOne({ configType: 'tabVisibility', adminRole: 'global' });
    const tabEnabled = cfg?.tabVisibility?.promotions ?? true;

    const promos = await PromotionCampaign.find({ active: true }).sort({ createdAt: -1 }).lean();
    res.json({ tabEnabled, promos });
  } catch (error) {
    console.error('Error fetching promos:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/user/lookup/:schoolId
 * Look up a transfer recipient by school ID (digits only). Returns minimal,
 * non-sensitive info (no balance). Defined BEFORE /:userId to avoid shadowing.
 */
router.get('/lookup/:schoolId', verifyUserToken, async (req, res) => {
  try {
    const digits = String(req.params.schoolId || '').replace(/\D/g, '');
    if (!digits) return res.json({ found: false });

    const recipient = await User.findOne({ schoolUId: digits });
    if (!recipient) return res.json({ found: false });

    // Can't send to yourself
    if (String(recipient._id) === String(req.user._id)) {
      return res.json({ found: false, self: true });
    }
    // Recipient must be an active, non-deactivated account
    if (!recipient.isActive || recipient.isDeactivated) {
      return res.json({ found: false, inactive: true });
    }

    return res.json({
      found: true,
      schoolUId: recipient.schoolUId,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      fullName: `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim(),
      accountType: recipient.role
    });
  } catch (error) {
    console.error('Error looking up recipient:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// SEND MONEY (student-to-student)
// ============================================================================
const TRANSFER_DAILY_LIMIT = 5000;          // ₱ per sender per day (Asia/Manila)
const TRANSFER_MAX_PIN_FAILS = 3;           // wrong PINs in a row before the account locks
const TRANSFER_LOCK_MINUTES = 30;
const MAX_FAVORITES = 20;

const manilaDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // YYYY-MM-DD
const round2 = (n) => Math.round(n * 100) / 100;
const peso = (n) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const manilaTime = (d) => d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const fullNameOf = (u) => `${u.firstName || ''} ${u.lastName || ''}`.trim();
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatSchoolId = (id) => {
  const d = String(id || '');
  return d.length === 10 ? `${d.slice(0, 4)}-${d.slice(4)}` : d.length === 8 ? `${d.slice(0, 2)}-${d.slice(2)}` : d;
};

// Human-readable device for the lockout email. The app may send X-Device-Name.
function describeDevice(req) {
  const hint = String(req.headers['x-device-name'] || '').replace(/[^\w .()-]/g, '').slice(0, 60).trim();
  if (hint) return `${hint} (NUCash app)`;
  const ua = String(req.headers['user-agent'] || '');
  if (/okhttp/i.test(ua)) return 'an Android phone (NUCash app)';
  if (/CFNetwork|Darwin/i.test(ua) && !/Mozilla/i.test(ua)) return 'an iPhone (NUCash app)';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a web browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'an unknown device';
  return `${browser} on ${os}`;
}

// Today's total already sent, from the transaction history (source of truth).
async function sentTodayFromHistory(userId) {
  const since = new Date(`${manilaDay()}T00:00:00+08:00`);
  const [row] = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), transactionType: 'debit',
      transferPeerSchoolId: { $ne: null }, status: 'Completed', createdAt: { $gte: since } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return round2(row?.total || 0);
}

// Make sure the sender's daily counter is for today (resets at midnight Manila time).
async function syncDailyCounter(user) {
  const today = manilaDay();
  if (user.transferDay !== today) {
    const sent = await sentTodayFromHistory(user._id);
    await User.updateOne({ _id: user._id, transferDay: { $ne: today } }, { $set: { transferDay: today, transferSentToday: sent } });
  }
  const fresh = await User.findById(user._id).select('transferSentToday balance');
  return { today, sentToday: round2(fresh.transferSentToday || 0), balance: round2(fresh.balance || 0) };
}

const peerSummary = (u) => ({
  schoolUId: u.schoolUId,
  displayId: formatSchoolId(u.schoolUId),
  fullName: fullNameOf(u),
  firstName: u.firstName,
  lastName: u.lastName,
  accountType: u.role
});

function sendTransferEmail(to, subject, heading, color, rows, footer) {
  (async () => {
    try {
      const { sendEmail } = await import('../services/emailService.js');
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background: #181D40; padding: 22px 28px;">
            <div style="color: #FFD41C; font-size: 13px; font-weight: 700; letter-spacing: 1px;">NUCASH SYSTEM</div>
            <div style="color: #FFFFFF; font-size: 20px; font-weight: 800; margin-top: 4px;">${escapeHtml(heading)}</div>
          </div>
          <div style="padding: 24px 28px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #333;">
              ${rows.map(([k, v]) => `<tr><td style="padding: 8px 0; color: #777;">${escapeHtml(k)}</td><td style="padding: 8px 0; text-align: right; font-weight: 600; color: ${k === 'Amount' ? color : '#181D40'};">${escapeHtml(v)}</td></tr>`).join('')}
            </table>
            <p style="color: #999; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 16px;">${escapeHtml(footer)}</p>
          </div>
        </div>`;
      await sendEmail({ to, subject, html });
    } catch (mailErr) {
      console.error('Transfer email failed:', mailErr.message);
    }
  })();
}

/**
 * GET /api/user/transfer/overview
 * Everything the Send Money screen needs: balance, daily allowance, favorites, recents.
 */
router.get('/transfer/overview', verifyUserToken, async (req, res) => {
  try {
    const me = req.user;
    const { sentToday, balance } = await syncDailyCounter(me);

    const favIds = (me.transferFavorites || []).slice(0, MAX_FAVORITES);
    const recentTx = await Transaction.find({ userId: me._id, transactionType: 'debit', transferPeerSchoolId: { $ne: null }, status: 'Completed' })
      .sort({ createdAt: -1 }).limit(50).select('transferPeerSchoolId amount createdAt').lean();
    const recentMap = new Map();
    for (const t of recentTx) if (!recentMap.has(t.transferPeerSchoolId)) recentMap.set(t.transferPeerSchoolId, t);
    const recentIds = [...recentMap.keys()].slice(0, 5);

    const peers = await User.find({ schoolUId: { $in: [...new Set([...favIds, ...recentIds])] }, isActive: true, isDeactivated: { $ne: true } })
      .select('schoolUId firstName lastName role').lean();
    const byId = new Map(peers.filter((p) => String(p._id) !== String(me._id)).map((p) => [p.schoolUId, p]));

    res.json({
      me: { fullName: fullNameOf(me), schoolUId: me.schoolUId, displayId: formatSchoolId(me.schoolUId) },
      balance,
      dailyLimit: TRANSFER_DAILY_LIMIT,
      sentToday,
      remainingToday: round2(Math.max(0, TRANSFER_DAILY_LIMIT - sentToday)),
      attemptsLeft: Math.max(0, TRANSFER_MAX_PIN_FAILS - (me.transferPinFails || 0)),
      favorites: favIds.filter((id) => byId.has(id)).map((id) => peerSummary(byId.get(id))),
      recents: recentIds.filter((id) => byId.has(id)).map((id) => ({
        ...peerSummary(byId.get(id)),
        isFavorite: favIds.includes(id),
        lastAmount: recentMap.get(id).amount,
        lastAt: recentMap.get(id).createdAt
      }))
    });
  } catch (error) {
    console.error('Transfer overview error:', error);
    res.status(500).json({ error: 'Could not load Send Money' });
  }
});

// Card taps come from the phone's NFC reader as the raw chip ID (hex), the same
// value driver/merchant phones send for payments. At most 20 lookups per
// student per 10 minutes, so card numbers can't be scanned in bulk.
const cardLookups = new Map(); // userId -> { count, first }
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cardLookups) if (now - v.first > 10 * 60 * 1000) cardLookups.delete(k);
}, 10 * 60 * 1000).unref();

/**
 * GET /api/user/lookup-card/:uid
 * Send Money "Tap their card": who owns this school ID card?
 */
router.get('/lookup-card/:uid', verifyUserToken, async (req, res) => {
  try {
    const key = String(req.user._id);
    const hit = cardLookups.get(key);
    if (hit && Date.now() - hit.first <= 10 * 60 * 1000) {
      if (hit.count >= 20) return res.status(429).json({ error: 'Too many card taps. Please wait a few minutes.' });
      hit.count += 1;
    } else cardLookups.set(key, { count: 1, first: Date.now() });

    const uid = String(req.params.uid || '').replace(/[\s:-]/g, '').toUpperCase();
    if (!/^[0-9A-F]{8,20}$/.test(uid)) return res.json({ found: false });
    const recipient = await User.findOne({ rfidUId: uid });
    if (!recipient) return res.json({ found: false });
    if (String(recipient._id) === key) return res.json({ found: false, self: true });
    if (!recipient.isActive || recipient.isDeactivated) return res.json({ found: false, inactive: true });
    return res.json({ found: true, ...peerSummary(recipient) });
  } catch (error) {
    console.error('Card lookup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/** POST /api/user/transfer/favorites  { schoolUId } — add a favorite recipient */
router.post('/transfer/favorites', verifyUserToken, async (req, res) => {
  try {
    const digits = String(req.body.schoolUId || '').replace(/\D/g, '');
    const peer = digits && await User.findOne({ schoolUId: digits }).select('_id schoolUId').lean();
    if (!peer || String(peer._id) === String(req.user._id)) return res.status(404).json({ error: 'Recipient not found' });
    const favs = (req.user.transferFavorites || []).filter((id) => id !== digits);
    if (favs.length >= MAX_FAVORITES) return res.status(409).json({ error: `You can keep up to ${MAX_FAVORITES} favorites` });
    await User.updateOne({ _id: req.user._id }, { $set: { transferFavorites: [digits, ...favs] } });
    res.json({ success: true, isFavorite: true });
  } catch (error) {
    res.status(500).json({ error: 'Could not save favorite' });
  }
});

/** DELETE /api/user/transfer/favorites/:schoolUId — remove a favorite */
router.delete('/transfer/favorites/:schoolUId', verifyUserToken, async (req, res) => {
  try {
    const digits = String(req.params.schoolUId || '').replace(/\D/g, '');
    await User.updateOne({ _id: req.user._id }, { $pull: { transferFavorites: digits } });
    res.json({ success: true, isFavorite: false });
  } catch (error) {
    res.status(500).json({ error: 'Could not remove favorite' });
  }
});

/**
 * POST /api/user/transfer
 * Body: { recipientSchoolId, amount, pin }.
 * - ₱5,000 per sender per day (Asia/Manila), enforced atomically with the balance check.
 * - 3 wrong PINs in a row lock the account for 30 min, sign it out everywhere and
 *   email the student. Wrong PIN = 422 and lock = 423 (never 401: clients log out on 401).
 * Defined BEFORE /:userId to avoid shadowing.
 */
router.post('/transfer', verifyUserToken, async (req, res) => {
  try {
    const sender = req.user;
    const { recipientSchoolId, amount, pin } = req.body;

    // Validate inputs
    const digits = String(recipientSchoolId || '').replace(/\D/g, '');
    const amt = round2(parseFloat(amount) || 0);
    if (!digits) return res.status(400).json({ error: 'Recipient school ID is required' });
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount' });
    if (!pin) return res.status(400).json({ error: 'PIN is required' });

    // Account state checks for the sender
    if (!sender.isActive || sender.isDeactivated) {
      return res.status(403).json({ error: 'Your account cannot send transfers right now' });
    }

    // Find recipient (before the PIN, so a lockout email can say who it was for)
    const recipient = await User.findOne({ schoolUId: digits });
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (String(recipient._id) === String(sender._id)) return res.status(400).json({ error: 'You cannot transfer to yourself' });
    if (!recipient.isActive || recipient.isDeactivated) return res.status(409).json({ error: 'Recipient account is not active' });
    const recipientName = fullNameOf(recipient);
    const senderName = fullNameOf(sender);

    // Verify sender PIN
    const pinValid = sender.pin && (sender.pin.startsWith('$2') ? await bcrypt.compare(String(pin), sender.pin) : sender.pin === String(pin));
    if (!pinValid) {
      const after = await User.findByIdAndUpdate(sender._id, { $inc: { transferPinFails: 1 } }, { new: true });
      const fails = after.transferPinFails || 0;
      if (fails < TRANSFER_MAX_PIN_FAILS) {
        const left = TRANSFER_MAX_PIN_FAILS - fails;
        return res.status(422).json({
          error: `Incorrect PIN. ${left} attempt${left === 1 ? '' : 's'} left before your account is locked.`,
          attemptsLeft: left
        });
      }

      // Third strike: lock, sign out everywhere, tell the student, leave a trail for ITSO
      const now = new Date();
      const lockedUntil = new Date(now.getTime() + TRANSFER_LOCK_MINUTES * 60 * 1000);
      await User.updateOne({ _id: sender._id }, { $set: { transferLockedUntil: lockedUntil, sessionsValidAfter: now, transferPinFails: 0 } });
      const device = describeDevice(req);
      const who = `${recipientName} (${formatSchoolId(recipient.schoolUId)})`;

      sendTransferEmail(
        sender.email,
        'Your NUCash account was locked',
        'Account locked for your security',
        '#EF4444',
        [
          ['What happened', `3 wrong PINs while sending ${peso(amt)} to ${who}`],
          ['Device', device],
          ['IP address', req.ip || 'unknown'],
          ['When', manilaTime(now)],
          ['Locked until', manilaTime(lockedUntil)]
        ],
        `We locked you out of ${device} because of 3 failed attempts at trying to send ${peso(amt)} to ${who}. ` +
        `You have been signed out on all devices and can sign in again after ${manilaTime(lockedUntil)}. ` +
        'No money was sent. If this transaction wasn\'t you, please report it to ITSO and change your PIN.'
      );
      import('../utils/logger.js').then(({ logSecurity }) => logSecurity({
        title: 'Send Money Locked',
        description: `${senderName} (${formatSchoolId(sender.schoolUId)}) locked for ${TRANSFER_LOCK_MINUTES} min after 3 wrong PINs sending ${peso(amt)} to ${who} from ${device}`,
        severity: 'warning',
        userId: String(sender._id),
        ipAddress: req.ip,
        action: 'transfer_pin_lockout',
        reason: '3 consecutive wrong PINs',
        blocked: true,
        attempts: TRANSFER_MAX_PIN_FAILS
      })).catch(() => {});

      return res.status(423).json({
        locked: true,
        lockedUntil,
        error: `Too many wrong PINs. For your security your account is locked until ${manilaTime(lockedUntil)} and you've been signed out. We've emailed you the details.`
      });
    }
    if (sender.transferPinFails) await User.updateOne({ _id: sender._id }, { $set: { transferPinFails: 0 } });

    // Daily allowance + balance, checked and applied in ONE atomic update so two
    // transfers at the same moment can't overspend either limit.
    const { today } = await syncDailyCounter(sender);
    const debited = await User.findOneAndUpdate(
      { _id: sender._id, balance: { $gte: amt }, transferDay: today, transferSentToday: { $lte: round2(TRANSFER_DAILY_LIMIT - amt) } },
      { $inc: { balance: -amt, transferSentToday: amt } },
      { new: true }
    );
    if (!debited) {
      const now = await User.findById(sender._id).select('balance transferSentToday').lean();
      const remaining = round2(Math.max(0, TRANSFER_DAILY_LIMIT - (now.transferSentToday || 0)));
      if ((now.balance || 0) < amt) return res.status(409).json({ error: 'Insufficient balance', balance: now.balance });
      return res.status(409).json({
        error: remaining > 0
          ? `That's over your daily limit. You can send ${peso(remaining)} more today (${peso(TRANSFER_DAILY_LIMIT)} per day).`
          : `You've reached today's ${peso(TRANSFER_DAILY_LIMIT)} sending limit. Try again tomorrow.`,
        remainingToday: remaining
      });
    }

    // Atomic credit; compensate the sender if the credit somehow fails
    let credited;
    try {
      credited = await User.findByIdAndUpdate(recipient._id, { $inc: { balance: amt } }, { new: true });
      if (!credited) throw new Error('Recipient update returned null');
    } catch (creditErr) {
      await User.findByIdAndUpdate(sender._id, { $inc: { balance: amt, transferSentToday: -amt } }); // refund
      console.error('Transfer credit failed, refunded sender:', creditErr.message);
      return res.status(500).json({ error: 'Transfer failed. Your balance was not affected.' });
    }

    const senderBal = round2(debited.balance);
    const recipientBal = round2(credited.balance);
    const sentAt = new Date();
    const referenceNo = Transaction.generateTransactionId();

    // Transaction records for both parties (the sender's ID is the reference no.)
    await Transaction.create([
      {
        transactionId: referenceNo,
        transactionType: 'debit',
        amount: amt,
        balance: senderBal,
        status: 'Completed',
        userId: sender._id,
        schoolUId: sender.schoolUId,
        email: sender.email,
        description: `Transfer to ${recipientName} (${recipient.schoolUId})`,
        transferPeerSchoolId: recipient.schoolUId,
        viewFor: 'user'
      },
      {
        transactionId: Transaction.generateTransactionId(),
        transactionType: 'credit',
        amount: amt,
        balance: recipientBal,
        status: 'Completed',
        userId: recipient._id,
        schoolUId: recipient.schoolUId,
        email: recipient.email,
        description: `Transfer from ${senderName} (${sender.schoolUId})`,
        transferPeerSchoolId: sender.schoolUId,
        viewFor: 'user'
      }
    ]);

    // Notify both parties (fire-and-forget — never block or fail the transfer on email)
    const when = manilaTime(sentAt);
    const footer = 'This is an automated receipt. If you didn\'t make this transfer, please contact the Treasury Office / ITSO immediately.';
    sendTransferEmail(sender.email, `You sent ${peso(amt)} • NUCash`, 'Money Sent', '#EF4444', [
      ['Amount', `- ${peso(amt)}`], ['To', `${recipientName} (${formatSchoolId(recipient.schoolUId)})`],
      ['Reference no.', referenceNo], ['New balance', peso(senderBal)], ['Date', when]
    ], footer);
    sendTransferEmail(recipient.email, `You received ${peso(amt)} • NUCash`, 'Money Received', '#10B981', [
      ['Amount', `+ ${peso(amt)}`], ['From', `${senderName} (${formatSchoolId(sender.schoolUId)})`],
      ['Reference no.', referenceNo], ['New balance', peso(recipientBal)], ['Date', when]
    ], footer);

    return res.json({
      success: true,
      message: `${peso(amt)} sent to ${recipientName}`,
      newBalance: senderBal,
      recipientName,
      amount: amt,
      referenceNo,
      sentAt,
      to: peerSummary(recipient),
      from: { fullName: senderName, schoolUId: sender.schoolUId, displayId: formatSchoolId(sender.schoolUId) },
      isFavorite: (sender.transferFavorites || []).includes(recipient.schoolUId),
      remainingToday: round2(Math.max(0, TRANSFER_DAILY_LIMIT - (debited.transferSentToday || 0)))
    });
  } catch (error) {
    console.error('Error processing transfer:', error);
    res.status(500).json({ error: 'Server error during transfer' });
  }
});

// A token may only read its own records via the param routes below. Combined
// with verifyUserToken (which rejects deleted/deactivated accounts), this means
// a removed user's app loses access on its next request.
const requireSelf = (req, res, next) => {
  if (String(req.user._id) !== String(req.params.userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

/**
 * GET /api/user/:userId
 * Get user info and balance (token holder may only read their own record)
 */
router.get('/:userId', verifyUserToken, requireSelf, async (req, res) => {
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
router.get('/:userId/transactions', verifyUserToken, requireSelf, async (req, res) => {
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
router.get('/:userId/concerns', verifyUserToken, requireSelf, async (req, res) => {
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
    if (department === 'merchants' && merchant) {
      reportTo = merchant;
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

// OTP storage for PIN change and deactivation (in production, use Redis)
const pinChangeOtpStore = new Map();
const deactivationOtpStore = new Map();

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { phone } = req.body;

    // IDENTITY LOCK: names are set at registration and tied to the school
    // email for shuttle-safety/audit traceability. Users cannot self-edit
    // their name — corrections go through Treasury/ITSO (sysad Manage Users).
    if (req.body.firstName || req.body.lastName || req.body.middleName) {
      return res.status(403).json({
        error: 'Name changes must be requested at the Treasury Office or ITSO.'
      });
    }

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
 * POST /api/user/send-pin-change-otp
 * Send OTP for PIN change verification
 */
router.post('/send-pin-change-otp', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({ error: 'Current and new PIN are required' });
    }

    if (!/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 6 digits' });
    }

    // Verify current PIN
    let isValidPin = false;
    if (user.pin.startsWith('$2b$') || user.pin.startsWith('$2a$')) {
      isValidPin = await bcrypt.compare(currentPin, user.pin);
    } else {
      isValidPin = user.pin === currentPin;
    }

    if (!isValidPin) {
      return res.status(400).json({ error: 'Current PIN is incorrect' });
    }

    if (currentPin === newPin) {
      return res.status(400).json({ error: 'New PIN must be different from current PIN' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with expiry (10 minutes) and the new PIN
    pinChangeOtpStore.set(user.email, {
      otp,
      newPin,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    // Send email with OTP
    const { sendPinChangeOtpEmail } = await import('../services/emailService.js');

    try {
      await sendPinChangeOtpEmail(user.email, user.firstName || 'User', otp);
      console.log(`📧 PIN change OTP sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send PIN change OTP email:', emailError);
      // In development, log the OTP
      console.log(`📝 Development OTP for ${user.email}: ${otp}`);
    }

    return res.json({
      success: true,
      message: 'Verification code sent to your email'
    });
  } catch (error) {
    console.error('Error sending PIN change OTP:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/user/change-pin
 * Change user PIN with OTP verification
 */
router.post('/change-pin', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    // Verify OTP
    const storedData = pinChangeOtpStore.get(user.email);

    if (!storedData) {
      return res.status(400).json({ error: 'No verification code found. Please request a new code.' });
    }

    if (Date.now() > storedData.expiresAt) {
      pinChangeOtpStore.delete(user.email);
      return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // OTP is valid, change the PIN
    const salt = await bcrypt.genSalt(10);
    user.pin = await bcrypt.hash(storedData.newPin, salt);
    user.pinChangedAt = new Date();
    // A new PIN signs out every other phone and browser; this device gets a fresh token.
    user.sessionsValidAfter = revokeUserSessions();
    await user.save();
    await copyPinToAdmin(user); // an admin's own wallet shares the admin PIN

    // Clear OTP
    pinChangeOtpStore.delete(user.email);

    console.log(`✅ PIN changed successfully for ${user.email}`);

    return res.json({
      success: true,
      message: 'PIN changed successfully',
      token: issueUserToken(user, req.tokenClaims?.viaAdmin)
    });
  } catch (error) {
    console.error('Error changing PIN:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// DEACTIVATION ENDPOINTS - SIMPLIFIED (NO REASON REQUIRED)
// ============================================================

/**
 * POST /api/user/send-deactivation-otp
 * Send OTP for account deactivation verification
 */
router.post('/send-deactivation-otp', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with expiry (10 minutes)
    deactivationOtpStore.set(user.email, {
      otp,
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
 * POST /api/user/deactivate-account
 * Immediately deactivate account after OTP verification
 * 🔥 NO UserConcern creation, NO admin approval needed
 * ✅ Sets isActive = false (account freeze)
 * ✅ Preserves ALL user data (balance, transactions, etc.)
 */
router.post('/deactivate-account', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: 'Verification code is required' });
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
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Clear OTP
    deactivationOtpStore.delete(user.email);

    // 🔥 FREEZE ACCOUNT - Set both isActive and isDeactivated to false/true
    user.isActive = false;
    user.isDeactivated = true;
    user.deactivatedAt = new Date();
    user.sessionsValidAfter = revokeUserSessions();
    await user.save();

    // Log the deactivation for admin audit trail
    const { logUserAction } = await import('../utils/logger.js');
    await logUserAction({
      userId: user._id,
      userName: user.fullName || `${user.firstName} ${user.lastName}`,
      action: 'Account Deactivated',
      description: 'User deactivated their account',
      details: { 
        balance: user.balance,
        schoolUId: user.schoolUId,
        email: user.email,
        deactivatedAt: new Date().toISOString()
      }
    });

    // Send confirmation email
    const { sendAccountDeactivatedEmail } = await import('../services/emailService.js');
    
    try {
      await sendAccountDeactivatedEmail(
        user.email, 
        user.firstName || 'User',
        user.balance
      );
    } catch (emailError) {
      console.error('Failed to send deactivation confirmation email:', emailError);
    }

    console.log(`⚠️  Account deactivated: ${user.email} (Balance: ₱${user.balance.toFixed(2)})`);

    return res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating account:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/user/request-transaction-history
 * Send transaction history to user's email
 */
router.post('/request-transaction-history', verifyUserToken, async (req, res) => {
  try {
    const user = req.user;

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

    // Generate PDF
    const PDFDocument = (await import('pdfkit')).default;

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).fillColor('#181D40').text('NUCash Transaction History', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666666').text(`Generated for: ${userName}`, { align: 'center' });
      doc.text(`Date Range: ${dateRange}`, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, { align: 'center' });
      doc.moveDown(0.5);

      // Summary
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#FFD41C').lineWidth(2).stroke();
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#22C55E').text(`Total Cash-In: +₱${totalCredit.toFixed(2)}`, 40);
      doc.fontSize(11).fillColor('#EF4444').text(`Total Payments: -₱${totalDebit.toFixed(2)}`, 40);
      doc.fontSize(11).fillColor('#181D40').text(`Current Balance: ₱${user.balance?.toFixed(2) || '0.00'}`, 40);
      doc.fontSize(11).fillColor('#181D40').text(`Total Transactions: ${transactions.length}`, 40);
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#E5E7EB').lineWidth(1).stroke();
      doc.moveDown(0.5);

      // Table header
      const colX = [40, 150, 230, 350, 440];
      const colHeaders = ['Date', 'Type', 'Description', 'Amount', 'Status'];
      doc.fontSize(8).fillColor('#FFD41C');
      doc.rect(40, doc.y - 2, 515, 16).fill('#181D40');
      const headerY = doc.y;
      colHeaders.forEach((h, i) => {
        doc.fillColor('#FFD41C').text(h, colX[i], headerY, { width: (colX[i + 1] || 555) - colX[i], height: 14 });
      });
      doc.y = headerY + 18;

      // Table rows
      transactions.forEach((tx, idx) => {
        if (doc.y > 750) {
          doc.addPage();
          doc.y = 40;
        }
        const rowY = doc.y;
        const date = new Date(tx.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
        const txType = tx.transactionType === 'credit' ? 'Cash-In' : 'Payment';
        const sign = tx.transactionType === 'credit' ? '+' : '-';
        const amount = tx.amount || 0;
        const desc = tx.description || tx.merchantName || 'Transaction';

        if (idx % 2 === 0) {
          doc.rect(40, rowY - 2, 515, 14).fill('#F9FAFB');
        }

        doc.fontSize(8).fillColor('#333333');
        doc.text(date, colX[0], rowY, { width: 108, height: 12 });
        doc.text(txType, colX[1], rowY, { width: 78, height: 12 });
        doc.text(desc.substring(0, 25), colX[2], rowY, { width: 118, height: 12 });
        doc.fillColor(tx.transactionType === 'credit' ? '#22C55E' : '#EF4444')
          .text(`${sign}₱${amount.toFixed(2)}`, colX[3], rowY, { width: 88, height: 12 });
        doc.fillColor('#333333').text(tx.status || 'Completed', colX[4], rowY, { width: 80, height: 12 });
        doc.y = rowY + 16;
      });

      // Footer
      doc.moveDown(1);
      doc.fontSize(8).fillColor('#999999').text('This document was automatically generated by NUCash System', { align: 'center' });
      doc.text('National University - Laguna Campus', { align: 'center' });

      doc.end();
    });

    const mailOptions = {
      from: `"NUCash System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '📊 NUCash - Your Transaction History (PDF)',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; text-align: center; padding: 30px;">
          <h2 style="color: #181D40;">Transaction History</h2>
          <p style="color: #666;">Hello <strong>${userName}</strong>,</p>
          <p style="color: #666;">Please find your transaction history attached as a PDF document.</p>
          <p style="color: #666; font-size: 13px;">
            <strong>Transactions:</strong> ${transactions.length} |
            <strong>Cash-In:</strong> +₱${totalCredit.toFixed(2)} |
            <strong>Payments:</strong> -₱${totalDebit.toFixed(2)}
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 11px;">NUCash System - National University, Laguna Campus</p>
    </div>
      `,
      attachments: [{
        filename: `NUCash_TransactionHistory_${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Transaction history PDF sent to ${user.email}`);

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