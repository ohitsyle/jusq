// server/routes/sysad.js
// System Admin routes for user management, card transfers, configurations, and more

import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Transaction from '../models/Transaction.js';
import Merchant from '../models/Merchant.js';
import SystemLog from '../models/SystemLog.js';
import EventLog from '../models/EventLog.js';
import Concern from '../models/Concern.js';
import Feedback from '../models/Feedback.js';
import UserConcern from '../models/UserConcern.js';
import bcrypt from 'bcrypt';
import { sendTemporaryPIN } from '../services/emailService.js';
import { checkMaintenanceMode, getMaintenanceStatus, setMaintenanceMode } from '../middlewares/maintenanceMode.js';
import { logAdminAction, logMaintenanceMode, logStudentDeactivation, logAutoExportConfigChange, logManualExport } from '../utils/logger.js';
import { extractAdminInfo } from '../middlewares/extractAdminInfo.js';

// Apply admin info extraction middleware to all sysad routes
router.use(extractAdminInfo);

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

    // Recent admin activity — pull from both SystemLog and EventLog collections
    const SYSAD_EVENT_TYPES = [
      // SystemLog events (written directly by sysad routes)
      'user_created', 'user_updated', 'user_deleted', 'user_status_changed',
      'admin_created', 'admin_login', 'admin_logout',
      'card_transferred', 'config_changed', 'auto_export_configured', 'manual_export',
      'concern_status_updated', 'concern_note_added', 'concern_resolved',
      'scheduled_student_deactivation',
      // EventLog events (written by logger.js utilities)
      'login', 'logout', 'cash_in', 'registration',
      'maintenance_mode', 'student_deactivation',
      'crud_create', 'crud_update', 'crud_delete',
    ];

    const [systemLogs, eventLogs] = await Promise.all([
      SystemLog.find({ eventType: { $in: SYSAD_EVENT_TYPES } })
        .sort({ timestamp: -1 }).limit(10).lean(),
      EventLog.find({ eventType: { $in: SYSAD_EVENT_TYPES } })
        .sort({ timestamp: -1 }).limit(10).lean(),
    ]);

    // Merge, normalize, sort by timestamp desc, take top 10
    const mergedActivity = [
      ...systemLogs.map(log => ({
        id: log._id,
        action: log.eventType,
        details: log.description,
        admin: log.metadata?.adminName || log.metadata?.performedBy || 'System',
        timestamp: log.timestamp || log.createdAt,
      })),
      ...eventLogs.map(log => ({
        id: log._id,
        action: log.eventType,
        details: log.description || log.title,
        admin: log.adminName || log.metadata?.adminName || 'System',
        timestamp: log.timestamp || log.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

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
      recentActivity: mergedActivity
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
      if (status === 'deactivated') {
        // Filter for deactivated users only
        userFilter.isDeactivated = true;
      } else {
        // User model uses isActive (boolean) not status (string)
        userFilter.isActive = status === 'active';
        adminFilter.isActive = status === 'active';
      }
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
      
      // For adminId, try to convert to number first, if it's a valid number
      const adminIdSearch = parseInt(search);
      if (!isNaN(adminIdSearch)) {
        adminFilter.adminId = adminIdSearch;
      } else {
        // If not a number, search string fields
        adminFilter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch users and admins
    let users = [];
    let admins = [];
    let userTotal = 0;
    let adminTotal = 0;

    // Always fetch regular users (students/employees)
    // Only skip users if role filter is specifically 'admin'
    const fetchUsers = role !== 'admin';

    if (fetchUsers) {
      [users, userTotal] = await Promise.all([
        User.find(userFilter)
          .select('-password -pin')
          .sort(sort)
          .lean(),
        User.countDocuments(userFilter)
      ]);
    }

    // Include admins when role filter is 'all', 'admin', or not specified
    if (includeAdmins) {
      [admins, adminTotal] = await Promise.all([
        Admin.find(adminFilter)
          .select('-pin')
          .sort(sort)
          .lean(),
        Admin.countDocuments(adminFilter)
      ]);
    }

    // Combine results - mark each record's type for client-side differentiation
    const combinedResults = [
      ...users.map(u => ({ ...u, _type: 'user' })),
      ...admins.map(a => ({ ...a, _type: 'admin', role: a.role || 'admin' }))
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
    // Count users and admins separately then combine
    const [userTotal, userActive, userInactive, userDeactivated, students, employees, adminTotal, adminActive, adminInactive] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: { $ne: true } }),
      User.countDocuments({ isDeactivated: true }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'employee' }),
      Admin.countDocuments(),
      Admin.countDocuments({ isActive: true }),
      Admin.countDocuments({ isActive: { $ne: true } })
    ]);

    res.json({
      success: true,
      metrics: {
        total: userTotal + adminTotal,
        active: userActive + adminActive,
        inactive: userInactive + adminInactive,
        deactivated: userDeactivated,
        students,
        employees,
        admins: adminTotal
      }
    });
  } catch (error) {
    console.error('❌ User metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/users/check-rfid
 * Check if RFID is available
 */
router.get('/users/check-rfid', async (req, res) => {
  try {
    const { rfidUId } = req.query;
    if (!rfidUId) {
      return res.status(400).json({ success: false, message: 'RFID is required' });
    }
    const existing = await User.findOne({ rfidUId });
    res.json({ success: true, available: !existing });
  } catch (error) {
    console.error('❌ Check RFID error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/users/check-email
 * Check if email is available (checks both User and Admin)
 */
router.get('/users/check-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    res.json({ success: true, available: !existingUser && !existingAdmin });
  } catch (error) {
    console.error('❌ Check email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/users/check-schoolid
 * Check if School ID is available (checks both User and Admin)
 */
router.get('/users/check-schoolid', async (req, res) => {
  try {
    const { schoolUId } = req.query;
    if (!schoolUId) {
      return res.status(400).json({ success: false, message: 'School ID is required' });
    }
    const existingUser = await User.findOne({ schoolUId });
    const existingAdmin = await Admin.findOne({ schoolUId });
    res.json({ success: true, available: !existingUser && !existingAdmin });
  } catch (error) {
    console.error('❌ Check School ID error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/users
 * Create a new user or admin (same flow as Treasury registration)
 */
router.post('/users', async (req, res) => {
  try {
    const {
      schoolUId,
      rfidUId,
      firstName,
      lastName,
      middleName,
      email,
      pin,
      role
    } = req.body;

    // Check if this is an admin role
    const adminRoles = ['sysad', 'treasury', 'accounting', 'motorpool', 'merchant'];
    const isAdminRole = adminRoles.includes(role);

    // Validate required fields
    if (!schoolUId || !firstName || !lastName || !email || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: schoolUId, firstName, lastName, email, and pin are required'
      });
    }

    // For regular users, RFID is required
    if (!isAdminRole && !rfidUId) {
      return res.status(400).json({
        success: false,
        message: 'RFID is required for student/employee accounts'
      });
    }

    // Check if email already exists in both User and Admin collections
    const existingUserEmail = await User.findOne({ email: email.toLowerCase() });
    const existingAdminEmail = await Admin.findOne({ email: email.toLowerCase() });
    if (existingUserEmail || existingAdminEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if School ID already exists in both collections
    const existingUserSchoolId = await User.findOne({ schoolUId });
    const existingAdminSchoolId = await Admin.findOne({ schoolUId });
    if (existingUserSchoolId || existingAdminSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID already registered'
      });
    }

    if (isAdminRole) {
      // CREATE ADMIN ACCOUNT
      // Generate adminId (auto-increment)
      const lastAdmin = await Admin.findOne().sort({ adminId: -1 });
      const adminId = lastAdmin ? lastAdmin.adminId + 1 : 1000;

      const admin = new Admin({
        adminId,
        schoolUId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName ? middleName.trim() : '',
        email: email.trim().toLowerCase(),
        pin,
        role,
        isActive: false
      });

      await admin.save();

      // Log action
      await SystemLog.create({
        eventType: 'admin_created',
        description: `New admin created by SysAd: ${firstName} ${lastName} (${role})`,
        severity: 'info',
        metadata: { adminId: admin._id, schoolUId, role, adminAction: true }
      });
      logAdminAction({
        adminId: req.adminId || 'sysad',
        adminRole: 'sysad',
        department: 'system',
        action: 'Admin Created',
        description: `created admin: ${firstName} ${lastName} (${role})`,
        targetEntity: 'user',
        targetId: admin._id?.toString(),
        crudOperation: 'crud_create',
        changes: { schoolUId, firstName, lastName, email, role },
        ipAddress: req.ip
      }).catch(() => {});

      // Send email with temporary PIN
      let emailSent = false;
      try {
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const formattedSchoolId = schoolUId.length === 10
          ? `${schoolUId.slice(0, 4)}-${schoolUId.slice(4)}`
          : schoolUId;
        console.log(`📧 Sending temporary PIN email to admin ${email}...`);
        emailSent = await sendTemporaryPIN(email.trim().toLowerCase(), pin, fullName, formattedSchoolId);
        console.log(`📧 Temporary PIN email ${emailSent ? 'sent successfully' : 'failed'} for ${email}`);
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError.message || emailError);
        emailSent = false;
      }

      res.status(201).json({
        success: true,
        message: 'Admin account created successfully',
        emailSent,
        user: {
          adminId: admin.adminId,
          schoolUId: admin.schoolUId,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role,
          isActive: admin.isActive
        }
      });
    } else {
      // CREATE USER ACCOUNT
      // Check if RFID already exists
      const existingRFID = await User.findOne({ rfidUId });
      if (existingRFID) {
        return res.status(400).json({
          success: false,
          message: 'RFID already registered to another user'
        });
      }

      // Generate userId (auto-increment)
      const lastUser = await User.findOne().sort({ userId: -1 });
      const userId = lastUser ? lastUser.userId + 1 : 100000;

      // Create user - isActive: false until they change PIN
      const user = new User({
        userId,
        schoolUId,
        rfidUId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName ? middleName.trim() : '',
        email: email.trim().toLowerCase(),
        pin,
        role: role || 'student',
        balance: 0,
        isActive: false,
        isDeactivated: false
      });

      await user.save();

      // Log action
      await SystemLog.create({
        eventType: 'user_created',
        description: `New user created by SysAd: ${firstName} ${lastName} (${schoolUId})`,
        severity: 'info',
        metadata: { userId: user._id, schoolUId, adminAction: true }
      });
      logAdminAction({
        adminId: req.adminId || 'sysad',
        adminRole: 'sysad',
        department: 'system',
        action: 'User Created',
        description: `created user: ${firstName} ${lastName} (${schoolUId})`,
        targetEntity: 'user',
        targetId: user._id?.toString(),
        crudOperation: 'crud_create',
        changes: { schoolUId, rfidUId, firstName, lastName, email, role: role || 'student' },
        ipAddress: req.ip
      }).catch(() => {});

      // Send email with temporary PIN
      let emailSent = false;
      try {
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const formattedSchoolId = schoolUId.length === 10
          ? `${schoolUId.slice(0, 4)}-${schoolUId.slice(4)}`
          : schoolUId;
        console.log(`📧 Sending temporary PIN email to ${email}...`);
        emailSent = await sendTemporaryPIN(email.trim().toLowerCase(), pin, fullName, formattedSchoolId);
        console.log(`📧 Temporary PIN email ${emailSent ? 'sent successfully' : 'failed'} for ${email}`);
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError.message || emailError);
        emailSent = false;
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        emailSent,
        user: {
          userId: user.userId,
          schoolUId: user.schoolUId,
          rfidUId: user.rfidUId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          balance: user.balance,
          role: user.role,
          isActive: user.isActive
        }
      });
    }
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
    logAdminAction({
      adminId: req.adminId || 'sysad',
      adminRole: 'sysad',
      department: 'system',
      action: 'User Updated',
      description: `updated user: ${user.firstName} ${user.lastName}`,
      targetEntity: 'user',
      targetId: user._id?.toString(),
      crudOperation: 'crud_update',
      changes: { firstName, lastName, email, role, status },
      ipAddress: req.ip
    }).catch(() => {});

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
 * Permanently delete a user or admin from the database
 */
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Try to find in User collection first
    let user = await User.findById(userId);
    let isAdmin = false;
    
    if (!user) {
      // If not found in User collection, try Admin collection
      const Admin = (await import('../models/Admin.js')).default;
      user = await Admin.findById(userId);
      isAdmin = true;
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Store user info for logging before deletion
    const userInfo = {
      id: user._id,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email,
      schoolUId: user.schoolUId,
      role: user.role || (isAdmin ? 'admin' : 'user')
    };

    // Permanently delete the user from appropriate collection
    if (isAdmin) {
      const Admin = (await import('../models/Admin.js')).default;
      await Admin.findByIdAndDelete(userId);
    } else {
      await User.findByIdAndDelete(userId);
    }

    // Log action
    await SystemLog.create({
      eventType: 'user_deleted',
      description: `${isAdmin ? 'Admin' : 'User'} permanently deleted: ${userInfo.name} (${userInfo.email})`,
      severity: 'warning',
      metadata: {
        userId: userInfo.id,
        schoolUId: userInfo.schoolUId,
        role: userInfo.role,
        adminAction: true
      }
    });
    logAdminAction({
      adminId: req.adminId || 'sysad',
      adminRole: 'sysad',
      department: 'system',
      action: `${isAdmin ? 'Admin' : 'User'} Deleted`,
      description: `permanently deleted ${isAdmin ? 'admin' : 'user'}: ${userInfo.name} (${userInfo.email})`,
      targetEntity: 'user',
      targetId: userInfo.id?.toString(),
      crudOperation: 'crud_delete',
      severity: 'warning',
      changes: { deleted: userInfo },
      ipAddress: req.ip
    }).catch(() => {});

    res.json({ 
      success: true, 
      message: `${isAdmin ? 'Admin' : 'User'} permanently deleted` 
    });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/sysad/users/:userId/toggle-status
 * Toggle user or admin active/inactive status (uses isActive boolean, not status string)
 */
router.patch('/users/:userId/toggle-status', async (req, res) => {
  try {
    const { userId } = req.params;

    // Try to find in User collection first
    let user = await User.findById(userId);
    let isAdmin = false;
    
    if (!user) {
      // If not found in User collection, try Admin collection
      const Admin = (await import('../models/Admin.js')).default;
      user = await Admin.findById(userId);
      isAdmin = true;
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Toggle isDeactivated for Users, isActive for Admins
    if (!isAdmin) {
      // For users: toggle isDeactivated
      user.isDeactivated = !user.isDeactivated;
      if (user.isDeactivated) {
        // Deactivating: also set isActive to false
        user.isActive = false;
        user.deactivatedAt = new Date();
      } else {
        // Un-deactivating: clear deactivatedAt, keep isActive as-is
        // User may need to go through activation flow if isActive was false
        user.deactivatedAt = null;
      }
    } else {
      // For admins: toggle isActive directly (admins don't have isDeactivated)
      user.isActive = !user.isActive;
    }

    await user.save();

    const statusText = (!isAdmin ? user.isDeactivated : !user.isActive) ? 'deactivated' : 'undeactivated';
    const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim();

    // Log action
    await SystemLog.create({
      eventType: 'user_status_changed',
      description: `${isAdmin ? 'Admin' : 'User'} ${statusText}: ${userName}`,
      severity: 'info',
      metadata: {
        userId: user._id,
        isActive: user.isActive,
        isDeactivated: user.isDeactivated,
        role: user.role || (isAdmin ? 'admin' : 'user'),
        adminAction: true
      }
    });
    logAdminAction({
      adminId: req.adminId || 'sysad',
      adminRole: 'sysad',
      department: 'system',
      action: `${isAdmin ? 'Admin' : 'User'} ${statusText}`,
      description: `${statusText} ${isAdmin ? 'admin' : 'user'}: ${userName}`,
      targetEntity: 'user',
      targetId: user._id?.toString(),
      crudOperation: 'crud_update',
      changes: { isActive: user.isActive, isDeactivated: user.isDeactivated, statusText },
      ipAddress: req.ip
    }).catch(() => {});

    res.json({
      success: true,
      message: `${isAdmin ? 'Admin' : 'User'} ${statusText} successfully`,
      user: { ...user.toObject(), password: undefined, pin: undefined }
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
 * Sets account to inactive and sends new OTP for reactivation
 */
router.post('/transfer-card', async (req, res) => {
  try {
    const { oldCardUid, newCardUid, adminId } = req.body;

    // Find user with old RFID - check both User and Admin models
    let user = await User.findOne({ rfidUId: oldCardUid });
    let isAdmin = false;
    
    if (!user) {
      user = await Admin.findOne({ rfidUId: oldCardUid });
      isAdmin = true;
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user found with old RFID' });
    }

    // Check if new RFID is already in use (check both models)
    const existingUser = await User.findOne({ rfidUId: newCardUid });
    const existingAdmin = await Admin.findOne({ rfidUId: newCardUid });
    
    if (existingUser || existingAdmin) {
      return res.status(400).json({ success: false, message: 'New RFID is already assigned to another user' });
    }

    // Store old RFID for logging
    const oldRfid = user.rfidUId;

    // Generate OTP for reactivation
    const crypto = await import('crypto');
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Update RFID, set inactive, clear PIN, and set OTP in PIN field
    user.rfidUId = newCardUid;
    user.isActive = false;
    user.pin = otp; // Put OTP in PIN field like new user activation
    user.resetOtp = ''; // Clear reset OTP field
    user.resetOtpExpireAt = null; // Clear reset OTP expiry
    await user.save();

    // Send activation OTP email
    const { sendActivationOTP } = await import('../services/emailService.js');
    await sendActivationOTP(
      user.email, 
      otp, 
      user.fullName || `${user.firstName} ${user.lastName}`
    );

    // Log action
    await SystemLog.create({
      eventType: 'card_transferred',
      description: `RFID transferred for ${user.firstName} ${user.lastName}: ${oldRfid} -> ${newCardUid}. Account set to inactive, new OTP sent.`,
      severity: 'info',
      metadata: {
        userId: user._id,
        userType: isAdmin ? 'admin' : 'user',
        oldRfidUId: oldRfid,
        newRfidUId: newCardUid,
        adminId,
        adminAction: true,
        otpSent: true
      }
    });
    logAdminAction({
      adminId: adminId || 'sysad',
      adminRole: 'sysad',
      department: 'system',
      action: 'Card Transferred',
      description: `transferred RFID for ${user.firstName} ${user.lastName}: ${oldRfid} → ${newCardUid}`,
      targetEntity: 'user',
      targetId: user._id?.toString(),
      crudOperation: 'admin_action',
      changes: { oldRfidUId: oldRfid, newRfidUId: newCardUid, accountDeactivated: true },
      ipAddress: req.ip
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Card transferred successfully. Account has been set to inactive and a new activation OTP has been sent to the user\'s email.',
      user: { ...user.toObject(), password: undefined, resetOtp: undefined }
    });
  } catch (error) {
    console.error('❌ Transfer card error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// CONFIGURATION ENDPOINTS
// ============================================================

// In-memory config store (hydrated from DB on startup)
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

// Hydrate deactivation scheduler from DB on startup so it survives PM2 restarts
(async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    const waitForConnection = () => new Promise((resolve) => {
      if (mongoose.connection.readyState === 1) return resolve();
      mongoose.connection.once('connected', resolve);
    });
    await waitForConnection();

    const doc = await mongoose.connection.db.collection('system_settings').findOne({ _id: 'deactivationScheduler' });
    if (doc) {
      systemConfig.deactivationScheduler = {
        enabled: doc.enabled || false,
        date: doc.date || null,
        time: doc.time || null,
        executed: doc.executed || false
      };
      console.log('[SysAd] Restored deactivation scheduler from DB:', systemConfig.deactivationScheduler);
    }
  } catch (err) {
    console.error('[SysAd] Failed to restore deactivation scheduler from DB:', err.message);
  }
})();

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
    logAdminAction({
      adminId: req.adminId || 'sysad',
      adminRole: 'sysad',
      department: 'system',
      action: 'Config Updated',
      description: `updated system configuration: ${Object.keys(updates).join(', ')}`,
      targetEntity: 'config',
      targetId: 'system-config',
      crudOperation: 'config_updated',
      changes: updates,
      ipAddress: req.ip
    }).catch(() => {});

    res.json({ success: true, message: 'Configuration updated', config: systemConfig });
  } catch (error) {
    console.error('❌ Update config error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/sysad/maintenance-mode
 * Toggle maintenance mode and force logout non-sysadmin users
 */
router.post('/maintenance-mode', async (req, res) => {
  try {
    const { enabled, message } = req.body;

    // Update both system config and middleware maintenance mode
    systemConfig.maintenanceMode = enabled;
    if (message) systemConfig.maintenanceMessage = message;

    // Update middleware maintenance mode state
    setMaintenanceMode(enabled, message || 'System is under maintenance. Please try again later.');

    // Log maintenance mode change with proper department tracking
    await logMaintenanceMode({
      adminId: req.adminInfo?.adminId || 'sysad',
      adminName: req.adminInfo?.adminName || 'System Admin',
      enabled: enabled,
      reason: message || 'System maintenance',
      estimatedDuration: null,
      timestamp: new Date()
    });

    console.log(`🔧 Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'} by SysAd`);

    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}. ${enabled ? 'All non-sysadmin users will be logged out.' : ''}`,
      maintenanceMode: systemConfig.maintenanceMode,
      forceLogoutTriggered: enabled
    });
  } catch (error) {
    console.error('❌ Maintenance mode error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/sysad/maintenance-status
 * Get current maintenance mode status
 */
router.get('/maintenance-status', async (req, res) => {
  try {
    const status = getMaintenanceStatus();
    res.json({
      success: true,
      maintenanceMode: status.enabled,
      message: status.message
    });
  } catch (error) {
    console.error('❌ Maintenance status error:', error);
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
    logAdminAction({
      adminId: req.adminId || 'sysad',
      adminRole: 'sysad',
      department: 'system',
      action: 'Auto Export Configured',
      description: `${systemConfig.autoExport.enabled ? 'enabled' : 'disabled'} auto export`,
      targetEntity: 'config',
      targetId: 'auto-export',
      crudOperation: 'config_updated',
      changes: systemConfig.autoExport,
      ipAddress: req.ip
    }).catch(() => {});

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
      logAdminAction({
        adminId: req.adminId || 'sysad',
        adminRole: 'sysad',
        department: 'system',
        action: 'Manual Export',
        description: `exported ${type} data (${data.length} records) from ${startDate} to ${endDate}`,
        targetEntity: 'config',
        targetId: 'manual-export',
        crudOperation: 'export_manual',
        changes: { type, startDate, endDate, recordCount: data.length },
        ipAddress: req.ip
      }).catch(() => {});

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
      logAdminAction({
        adminId: req.adminId || 'sysad',
        adminRole: 'sysad',
        department: 'system',
        action: 'Manual Export',
        description: `exported ${type} data (${data.length} records) from ${startDate} to ${endDate}`,
        targetEntity: 'config',
        targetId: 'manual-export',
        crudOperation: 'export_manual',
        changes: { type, startDate, endDate, recordCount: data.length },
        ipAddress: req.ip
      }).catch(() => {});

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
      time: time || systemConfig.deactivationScheduler.time,
      executed: false  // Reset executed flag when schedule is updated
    };

    // Persist to MongoDB so it survives PM2 restarts
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.connection.db.collection('system_settings').updateOne(
        { _id: 'deactivationScheduler' },
        { $set: { ...systemConfig.deactivationScheduler, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log('[SysAd] Deactivation scheduler persisted to DB');
    } catch (dbErr) {
      console.error('[SysAd] Failed to persist scheduler to DB:', dbErr.message);
    }

    // Log student deactivation scheduler change with proper department tracking
    await logStudentDeactivation({
      adminId: req.adminInfo?.adminId || 'sysad',
      adminName: req.adminInfo?.adminName || 'System Admin',
      enabled: systemConfig.deactivationScheduler.enabled,
      reason: `Scheduled for ${date} ${time}`,
      affectedStudents: enabled ? 'All students' : null,
      timestamp: new Date()
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

    // Only show concerns sent to sysad (reportTo: 'sysad')
    const filter = {
      reportTo: { $regex: /sysad/i }
    };

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

    // Get stats - only sysad concerns
    const sysadFilter = { reportTo: { $regex: /sysad/i } };
    const [pending, inProgress, resolved, totalAll] = await Promise.all([
      UserConcern.countDocuments({ ...sysadFilter, status: 'pending' }),
      UserConcern.countDocuments({ ...sysadFilter, status: 'in_progress' }),
      UserConcern.countDocuments({ ...sysadFilter, status: 'resolved' }),
      UserConcern.countDocuments(sysadFilter)
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
    logAdminAction({
      adminId: req.adminId || 'sysad',
      adminName: adminName || 'System Admin',
      adminRole: 'sysad',
      department: 'system',
      action: 'Concern Status Updated',
      description: `updated concern ${concern.concernId} status to ${status}`,
      targetEntity: 'concern',
      targetId: concern.concernId,
      crudOperation: status === 'resolved' ? 'concern_resolved' : 'crud_update',
      changes: { status, reply },
      ipAddress: req.ip
    }).catch(() => {});

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
    logAdminAction({
      adminId: req.adminId || 'sysad',
      adminName: adminName || 'System Admin',
      adminRole: 'sysad',
      department: 'system',
      action: 'Concern Note Added',
      description: `added note to concern ${concern.concernId}`,
      targetEntity: 'concern',
      targetId: concern.concernId,
      crudOperation: 'note_added',
      changes: { note: note.trim(), adminName: adminName || 'System Admin' },
      ipAddress: req.ip
    }).catch(() => {});

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
    logAdminAction({
      adminId: adminId || 'sysad',
      adminName: adminName || 'System Admin',
      adminRole: 'sysad',
      department: 'system',
      action: 'Concern Resolved',
      description: `resolved concern ${concern.concernId}`,
      targetEntity: 'concern',
      targetId: concern.concernId,
      crudOperation: 'concern_resolved',
      changes: { resolution },
      ipAddress: req.ip
    }).catch(() => {});

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

// Export systemConfig accessors for deactivation cron job
export function getSystemConfig() {
  return systemConfig;
}

export async function setSchedulerExecuted() {
  systemConfig.deactivationScheduler.enabled = false;
  systemConfig.deactivationScheduler.executed = true;

  // Persist to MongoDB
  try {
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.db.collection('system_settings').updateOne(
      { _id: 'deactivationScheduler' },
      { $set: { enabled: false, executed: true, updatedAt: new Date() } },
      { upsert: true }
    );
    console.log('[SysAd] Scheduler executed status persisted to DB');
  } catch (err) {
    console.error('[SysAd] Failed to persist scheduler executed status:', err.message);
  }
}

export default router;
