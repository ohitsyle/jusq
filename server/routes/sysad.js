// server/routes/sysad.js
// System Admin routes for user management, card transfers, configurations, and more

import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import SystemLog from '../models/SystemLog.js';
import Concern from '../models/Concern.js';
import Feedback from '../models/Feedback.js';
import UserConcern from '../models/UserConcern.js';
import bcrypt from 'bcrypt';

// ============================================================
// DASHBOARD ENDPOINTS
// ============================================================

/**
 * GET /api/admin/sysad/dashboard
 * Get system admin dashboard metrics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // User metrics - User model uses isActive (boolean) not status (string)
    const [totalUsers, activeUsers, inactiveUsers, studentCount, employeeCount] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: { $ne: true } }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'employee' })
    ]);

    // Admin count
    const adminCount = await Admin.countDocuments({ isActive: true });

    // Financial metrics
    const [balanceResult, totalTransactions, todayCashIn, merchantCount] = await Promise.all([
      User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]),
      Transaction.countDocuments({ status: { $nin: ['Failed', 'Refunded'] } }),
      Transaction.aggregate([
        {
          $match: {
            transactionType: 'credit',
            createdAt: { $gte: today },
            status: { $nin: ['Failed', 'Refunded'] }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Merchant.countDocuments({ isActive: true })
    ]);

    // Recent admin activity
    const recentActivity = await SystemLog.find({
      eventType: { $in: ['admin_login', 'admin_logout', 'user_created', 'user_updated', 'config_changed'] }
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      userMetrics: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        admins: adminCount,
        students: studentCount,
        employees: employeeCount
      },
      financialMetrics: {
        totalBalance: balanceResult[0]?.total || 0,
        totalTransactions,
        todayCashIn: todayCashIn[0]?.total || 0,
        activeMerchants: merchantCount
      },
      recentActivity: recentActivity.map(log => ({
        id: log._id,
        action: log.eventType,
        details: log.description,
        admin: log.metadata?.adminName || 'System',
        timestamp: log.timestamp
      }))
    });
  } catch (error) {
    console.error('❌ Sysad dashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================

/**
 * GET /api/admin/sysad/users
 * Get paginated list of users with filters
 */
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter for Users
    const userFilter = {};
    // Build filter for Admins
    const adminFilter = {};
    let includeAdmins = !role || role === 'all' || role === 'admin';

    if (role && role !== 'all' && role !== 'admin') {
      userFilter.role = role;
      includeAdmins = false;
    }

    if (status && status !== 'all') {
      // User model uses isActive (boolean) not status (string)
      userFilter.isActive = status === 'active';
      adminFilter.isActive = status === 'active';
    }

    if (search) {
      const searchFilter = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { schoolUId: { $regex: search, $options: 'i' } }
      ];
      userFilter.$or = searchFilter;
      adminFilter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { adminId: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch users
    let users = [];
    let admins = [];
    let userTotal = 0;
    let adminTotal = 0;

    // Only include regular users if not filtering by admin role
    if (role !== 'admin') {
      [users, userTotal] = await Promise.all([
        User.find(userFilter)
          .select('-password -pin')
          .sort(sort)
          .lean(),
        User.countDocuments(userFilter)
      ]);
    }

    // Include admins if needed
    if (includeAdmins) {
      [admins, adminTotal] = await Promise.all([
        Admin.find(adminFilter)
          .select('-password')
          .sort(sort)
          .lean(),
        Admin.countDocuments(adminFilter)
      ]);
    }

    // Combine and format results
    const combinedResults = [
      ...users.map(u => ({ ...u, _type: 'user' })),
      ...admins.map(a => ({
        ...a,
        _type: 'admin',
        // Map admin fields to user fields for consistent display
        schoolUId: a.adminId,
        isActive: a.isActive
      }))
    ];

    // Sort combined results
    combinedResults.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    // Apply pagination to combined results
    const total = userTotal + adminTotal;
    const paginatedResults = combinedResults.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      users: paginatedResults,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/users/metrics
 * Get user metrics for dashboard cards
 */
router.get('/users/metrics', async (req, res) => {
  try {
    // User model uses isActive (boolean) not status (string)
    const [total, active, inactive, students, employees, admins] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: { $ne: true } }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'employee' }),
      Admin.countDocuments({ isActive: true })
    ]);

    res.json({
      success: true,
      metrics: { total, active, inactive, students, employees, admins }
    });
  } catch (error) {
    console.error('❌ User metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/users
 * Create a new user
 */
router.post('/users', async (req, res) => {
  try {
    const { firstName, lastName, email, role, studentId, password } = req.body;

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password || 'NUCash2024!', 10);

    const user = new User({
      firstName,
      lastName,
      email,
      role: role || 'student',
      studentId,
      password: hashedPassword,
      status: 'active',
      balance: 0
    });

    await user.save();

    // Log action
    await SystemLog.create({
      eventType: 'user_created',
      description: `New user created: ${firstName} ${lastName} (${email})`,
      severity: 'info',
      metadata: { userId: user._id, adminAction: true }
    });

    res.json({
      success: true,
      message: 'User created successfully',
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error('❌ Create user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/sysad/users/:userId
 * Update a user
 */
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, role, studentId, status, schoolUId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check email uniqueness if changed
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (role) user.role = role;
    if (studentId !== undefined) user.studentId = studentId;
    if (schoolUId !== undefined) user.schoolUId = schoolUId;
    // Handle status - convert 'active'/'inactive' to isActive boolean
    if (status !== undefined) {
      user.isActive = status === 'active';
      user.isDeactivated = status !== 'active';
      if (user.isDeactivated) {
        user.deactivatedAt = new Date();
      }
    }

    await user.save();

    // Log action
    await SystemLog.create({
      eventType: 'user_updated',
      description: `User updated: ${user.firstName} ${user.lastName}`,
      severity: 'info',
      metadata: { userId: user._id, adminAction: true }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/sysad/users/:userId
 * Delete a user (soft delete - set isDeactivated to true and isActive to false)
 */
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Soft delete - using the correct User model fields
    user.isActive = false;
    user.isDeactivated = true;
    user.deactivatedAt = new Date();
    await user.save();

    // Log action
    await SystemLog.create({
      eventType: 'user_deleted',
      description: `User deleted: ${user.firstName} ${user.lastName}`,
      severity: 'warning',
      metadata: { userId: user._id, adminAction: true }
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/sysad/users/:userId/toggle-status
 * Toggle user active/inactive status (uses isActive boolean, not status string)
 */
router.patch('/users/:userId/toggle-status', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Toggle isActive (boolean field in User model)
    user.isActive = !user.isActive;
    // Also update isDeactivated field to keep them in sync
    user.isDeactivated = !user.isActive;
    if (user.isDeactivated) {
      user.deactivatedAt = new Date();
    } else {
      user.deactivatedAt = null;
    }
    await user.save();

    const statusText = user.isActive ? 'activated' : 'deactivated';

    // Log action
    await SystemLog.create({
      eventType: 'user_status_changed',
      description: `User ${statusText}: ${user.firstName} ${user.lastName}`,
      severity: 'info',
      metadata: { userId: user._id, isActive: user.isActive, adminAction: true }
    });

    res.json({
      success: true,
      message: `User ${statusText} successfully`,
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error('❌ Toggle status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/users/export
 * Export users to CSV
 */
router.get('/users/export', async (req, res) => {
  try {
    const { role, status } = req.query;

    const filter = {};
    if (role && role !== 'all') filter.role = role;
    if (status && status !== 'all') filter.isActive = status === 'active';

    const users = await User.find(filter).select('-password').lean();

    // Generate CSV
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Role', 'Student ID', 'Status', 'Balance', 'Created At'];
    const rows = users.map(u => [
      u._id,
      u.firstName,
      u.lastName,
      u.email,
      u.role,
      u.studentId || '',
      u.status,
      u.balance,
      new Date(u.createdAt).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users_export_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('❌ Export users error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// CARD TRANSFER ENDPOINTS
// ============================================================

/**
 * GET /api/admin/sysad/card-lookup/:cardUid
 * Look up user by RFID UID (rfidUId field in User model)
 */
router.get('/card-lookup/:cardUid', async (req, res) => {
  try {
    const { cardUid } = req.params;

    // User model uses rfidUId field, not cardUid
    const user = await User.findOne({ rfidUId: cardUid }).select('-password -pin').lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'No user found with this RFID' });
    }

    // Get transaction count
    const transactionCount = await Transaction.countDocuments({ userId: user._id });

    res.json({
      success: true,
      user: {
        ...user,
        transactionCount
      }
    });
  } catch (error) {
    console.error('❌ Card lookup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/transfer-card
 * Transfer RFID from one card to another (uses rfidUId field)
 */
router.post('/transfer-card', async (req, res) => {
  try {
    const { oldCardUid, newCardUid, adminId } = req.body;

    // Find user with old RFID - User model uses rfidUId field
    const user = await User.findOne({ rfidUId: oldCardUid });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user found with old RFID' });
    }

    // Check if new RFID is already in use
    const existingUser = await User.findOne({ rfidUId: newCardUid });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'New RFID is already assigned to another user' });
    }

    // Store old RFID for logging
    const oldRfid = user.rfidUId;

    // Update RFID
    user.rfidUId = newCardUid;
    await user.save();

    // Log action
    await SystemLog.create({
      eventType: 'card_transferred',
      description: `RFID transferred for ${user.firstName} ${user.lastName}: ${oldRfid} -> ${newCardUid}`,
      severity: 'info',
      metadata: {
        userId: user._id,
        oldRfidUId: oldRfid,
        newRfidUId: newCardUid,
        adminId,
        adminAction: true
      }
    });

    res.json({
      success: true,
      message: 'Card transferred successfully',
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error('❌ Transfer card error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// CONFIGURATION ENDPOINTS
// ============================================================

// In-memory config store (in production, use database)
let systemConfig = {
  maintenanceMode: false,
  maintenanceMessage: 'System is under maintenance. Please try again later.',
  autoExport: {
    enabled: false,
    frequency: 'weekly',
    types: ['transactions', 'users'],
    email: ''
  },
  deactivationScheduler: {
    enabled: false,
    date: null,
    time: null
  }
};

/**
 * GET /api/admin/sysad/config
 * Get system configuration
 */
router.get('/config', async (req, res) => {
  try {
    res.json({ success: true, config: systemConfig });
  } catch (error) {
    console.error('❌ Get config error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/sysad/config
 * Update system configuration
 */
router.put('/config', async (req, res) => {
  try {
    const updates = req.body;

    systemConfig = { ...systemConfig, ...updates };

    // Log config change
    await SystemLog.create({
      eventType: 'config_changed',
      description: 'System configuration updated',
      severity: 'info',
      metadata: { changes: Object.keys(updates), adminAction: true }
    });

    res.json({ success: true, message: 'Configuration updated', config: systemConfig });
  } catch (error) {
    console.error('❌ Update config error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/maintenance-mode
 * Toggle maintenance mode
 */
router.post('/maintenance-mode', async (req, res) => {
  try {
    const { enabled, message } = req.body;

    systemConfig.maintenanceMode = enabled;
    if (message) systemConfig.maintenanceMessage = message;

    // Log action
    await SystemLog.create({
      eventType: 'maintenance_mode_changed',
      description: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      severity: enabled ? 'warning' : 'info',
      metadata: { enabled, adminAction: true }
    });

    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      maintenanceMode: systemConfig.maintenanceMode
    });
  } catch (error) {
    console.error('❌ Maintenance mode error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/auto-export
 * Configure automatic exports
 */
router.post('/auto-export', async (req, res) => {
  try {
    const { enabled, frequency, types, email } = req.body;

    systemConfig.autoExport = {
      enabled: enabled !== undefined ? enabled : systemConfig.autoExport.enabled,
      frequency: frequency || systemConfig.autoExport.frequency,
      types: types || systemConfig.autoExport.types,
      email: email || systemConfig.autoExport.email
    };

    // Log action
    await SystemLog.create({
      eventType: 'auto_export_configured',
      description: `Auto export ${systemConfig.autoExport.enabled ? 'enabled' : 'disabled'}`,
      severity: 'info',
      metadata: { config: systemConfig.autoExport, adminAction: true }
    });

    res.json({
      success: true,
      message: 'Auto export configured',
      autoExport: systemConfig.autoExport
    });
  } catch (error) {
    console.error('❌ Auto export config error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/manual-export
 * Generate manual export
 */
router.post('/manual-export', async (req, res) => {
  try {
    const { type, startDate, endDate } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let data, headers, filename;

    if (type === 'transactions') {
      data = await Transaction.find({
        createdAt: { $gte: start, $lte: end }
      }).lean();

      headers = ['ID', 'User ID', 'Type', 'Amount', 'Status', 'Description', 'Created At'];
      const rows = data.map(t => [
        t._id,
        t.userId,
        t.transactionType,
        t.amount,
        t.status,
        t.description || '',
        new Date(t.createdAt).toISOString()
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      filename = `transactions_${startDate}_to_${endDate}.csv`;

      // Log action
      await SystemLog.create({
        eventType: 'manual_export',
        description: `Manual export generated: ${type} from ${startDate} to ${endDate}`,
        severity: 'info',
        metadata: { type, startDate, endDate, recordCount: data.length, adminAction: true }
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      return res.send(csv);
    }

    if (type === 'users') {
      data = await User.find({
        createdAt: { $gte: start, $lte: end }
      }).select('-password').lean();

      headers = ['ID', 'First Name', 'Last Name', 'Email', 'Role', 'Status', 'Balance', 'Created At'];
      const rows = data.map(u => [
        u._id,
        u.firstName,
        u.lastName,
        u.email,
        u.role,
        u.status,
        u.balance,
        new Date(u.createdAt).toISOString()
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      filename = `users_${startDate}_to_${endDate}.csv`;

      await SystemLog.create({
        eventType: 'manual_export',
        description: `Manual export generated: ${type} from ${startDate} to ${endDate}`,
        severity: 'info',
        metadata: { type, startDate, endDate, recordCount: data.length, adminAction: true }
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      return res.send(csv);
    }

    res.status(400).json({ success: false, message: 'Invalid export type' });
  } catch (error) {
    console.error('❌ Manual export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/deactivation-scheduler
 * Configure student deactivation scheduler
 */
router.post('/deactivation-scheduler', async (req, res) => {
  try {
    const { enabled, date, time } = req.body;

    systemConfig.deactivationScheduler = {
      enabled: enabled !== undefined ? enabled : systemConfig.deactivationScheduler.enabled,
      date: date || systemConfig.deactivationScheduler.date,
      time: time || systemConfig.deactivationScheduler.time
    };

    // Log action
    await SystemLog.create({
      eventType: 'deactivation_scheduler_configured',
      description: `Deactivation scheduler ${systemConfig.deactivationScheduler.enabled ? 'enabled' : 'disabled'}`,
      severity: 'info',
      metadata: { config: systemConfig.deactivationScheduler, adminAction: true }
    });

    res.json({
      success: true,
      message: 'Deactivation scheduler configured',
      scheduler: systemConfig.deactivationScheduler
    });
  } catch (error) {
    console.error('❌ Deactivation scheduler error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// CONCERNS & FEEDBACK ENDPOINTS
// ============================================================

/**
 * GET /api/admin/sysad/concerns
 * Get ALL concerns and feedbacks from the NUCash system (sysad sees everything)
 */
router.get('/concerns', async (req, res) => {
  try {
    const { page = 1, limit = 100, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sysad sees ALL concerns - no department filter
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { feedbackText: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { concernId: { $regex: search, $options: 'i' } }
      ];
    }

    const [concerns, total] = await Promise.all([
      UserConcern.find(filter)
        .populate('userId', 'firstName lastName email schoolUId')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      UserConcern.countDocuments(filter)
    ]);

    // Map userId to user field for frontend compatibility
    const mappedConcerns = concerns.map(c => ({
      ...c,
      user: c.userId,
      createdAt: c.submittedAt || c.createdAt
    }));

    // Get stats - ALL concerns
    const [pending, inProgress, resolved, totalAll] = await Promise.all([
      UserConcern.countDocuments({ status: 'pending' }),
      UserConcern.countDocuments({ status: 'in_progress' }),
      UserConcern.countDocuments({ status: 'resolved' }),
      UserConcern.countDocuments({})
    ]);

    res.json({
      success: true,
      concerns: mappedConcerns,
      stats: { pending, inProgress, resolved, total: totalAll },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get concerns error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/feedbacks
 * Get all feedbacks
 */
router.get('/feedbacks', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};

    if (search) {
      filter.$or = [
        { comment: { $regex: search, $options: 'i' } }
      ];
    }

    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Feedback.countDocuments(filter)
    ]);

    // Calculate average rating
    const ratingResult = await Feedback.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      feedbacks,
      stats: {
        total,
        avgRating: ratingResult[0]?.avgRating?.toFixed(1) || '0.0'
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get feedbacks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/sysad/concerns/:id/status
 * Update concern status (same as treasury)
 */
router.patch('/concerns/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reply, adminName } = req.body;

    const concern = await UserConcern.findById(id).populate('userId', 'firstName lastName email');
    if (!concern) {
      return res.status(404).json({ success: false, message: 'Concern not found' });
    }

    // Track status change
    const wasInProgress = concern.status === 'in_progress';
    concern.status = status;

    // Set inProgressDate if moving to in_progress
    if (status === 'in_progress' && !concern.inProgressDate) {
      concern.inProgressDate = new Date();
    }

    if (status === 'resolved') {
      // Use resolution field for assistance, adminResponse for feedback
      if (concern.submissionType === 'assistance') {
        concern.resolution = reply;
      } else {
        concern.adminResponse = reply;
      }
      concern.resolvedDate = new Date();
      // Note: resolvedBy expects ObjectId, so we skip it or use null
      // Store admin name in notes instead

      // Add resolution note
      if (!concern.notes) concern.notes = [];
      concern.notes.push({
        message: `✓ Resolved: ${reply}`,
        adminName: adminName || 'System Admin',
        timestamp: new Date()
      });
    }

    await concern.save();

    // Log action
    await SystemLog.create({
      eventType: 'concern_status_updated',
      description: `Concern ${concern.concernId} status updated to ${status}`,
      severity: 'info',
      metadata: { concernId: id, status, adminName, adminAction: true }
    });

    res.json({
      success: true,
      message: `Concern ${status === 'resolved' ? 'resolved' : 'updated'} successfully`,
      concern
    });
  } catch (error) {
    console.error('❌ Update concern status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/concerns/:id/note
 * Add note to concern (same as treasury)
 */
router.post('/concerns/:id/note', async (req, res) => {
  try {
    const { id } = req.params;
    const { note, adminName } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Note message is required' });
    }

    const concern = await UserConcern.findById(id);
    if (!concern) {
      return res.status(404).json({ success: false, message: 'Concern not found' });
    }

    // Initialize notes array if it doesn't exist
    if (!concern.notes) {
      concern.notes = [];
    }

    // Add the new note
    concern.notes.push({
      message: note.trim(),
      adminName: adminName || 'System Admin',
      timestamp: new Date()
    });

    await concern.save();

    // Log action
    await SystemLog.create({
      eventType: 'concern_note_added',
      description: `Note added to concern ${concern.concernId}`,
      severity: 'info',
      metadata: { concernId: id, adminName, adminAction: true }
    });

    res.json({
      success: true,
      message: 'Note added successfully',
      concern
    });
  } catch (error) {
    console.error('❌ Add note error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/sysad/concerns/:concernId/resolve
 * Resolve a concern (legacy endpoint)
 */
router.patch('/concerns/:concernId/resolve', async (req, res) => {
  try {
    const { concernId } = req.params;
    const { resolution, adminId, adminName } = req.body;

    const concern = await UserConcern.findById(concernId);
    if (!concern) {
      return res.status(404).json({ success: false, message: 'Concern not found' });
    }

    concern.status = 'resolved';
    concern.adminResponse = resolution;
    concern.resolvedDate = new Date();
    concern.resolvedBy = adminName || adminId;

    await concern.save();

    // Log action
    await SystemLog.create({
      eventType: 'concern_resolved',
      description: `Concern resolved: ${concern.concernId}`,
      severity: 'info',
      metadata: { concernId, adminId, adminAction: true }
    });

    res.json({
      success: true,
      message: 'Concern resolved successfully',
      concern
    });
  } catch (error) {
    console.error('❌ Resolve concern error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/concerns/export
 * Export concerns to CSV
 */
router.get('/concerns/export', async (req, res) => {
  try {
    const concerns = await Concern.find({ department: 'sysad' }).lean();

    const headers = ['ID', 'Subject', 'Description', 'Status', 'User Name', 'User Email', 'Created At', 'Resolved At'];
    const rows = concerns.map(c => [
      c._id,
      `"${c.subject?.replace(/"/g, '""') || ''}"`,
      `"${c.description?.replace(/"/g, '""') || ''}"`,
      c.status,
      c.userName || '',
      c.userEmail || '',
      new Date(c.createdAt).toISOString(),
      c.resolvedAt ? new Date(c.resolvedAt).toISOString() : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sysad_concerns_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('❌ Export concerns error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/feedbacks/export
 * Export feedbacks to CSV
 */
router.get('/feedbacks/export', async (req, res) => {
  try {
    const feedbacks = await Feedback.find().lean();

    const headers = ['ID', 'Rating', 'Comment', 'User Name', 'User Email', 'Created At'];
    const rows = feedbacks.map(f => [
      f._id,
      f.rating,
      `"${f.comment?.replace(/"/g, '""') || ''}"`,
      f.userName || '',
      f.userEmail || '',
      new Date(f.createdAt).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=feedbacks_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('❌ Export feedbacks error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
