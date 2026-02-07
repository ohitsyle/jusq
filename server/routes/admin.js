// nucash-server/routes/admin.js
// FIXED: Added analytics dashboard endpoint and shuttle positions

import express from 'express';
const router = express.Router();
import Driver from '../models/Driver.js';
import Shuttle from '../models/Shuttle.js';
import Phone from '../models/Phone.js';
import Route from '../models/Route.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import EventLog from '../models/EventLog.js';
import UserConcern from '../models/UserConcern.js';
import Trip from '../models/Trip.js';
import { logAdminAction, logError } from '../utils/logger.js';
import { extractAdminInfo } from '../middlewares/extractAdminInfo.js';
import { broadcastChanges, forceMobileRefresh } from '../middlewares/realtimeMiddleware.js';

// Apply admin info extraction middleware to all admin routes
router.use(extractAdminInfo);

// Try to import ShuttlePosition (may not exist)
let ShuttlePosition = null;
import('../models/ShuttlePosition.js')
  .then(module => {
    ShuttlePosition = module.default;
    console.log('✅ ShuttlePosition model loaded');
  })
  .catch(() => {
    console.log('⚠️ ShuttlePosition model not found');
  });

// ============================================================
// ANALYTICS ENDPOINTS
// ============================================================

/**
 * GET /admin/analytics/dashboard
 * Dashboard statistics
 */
router.get('/analytics/dashboard', async (req, res) => {
  try {
    // Get total PASSENGERS (each payment = one passenger)
    const totalPassengers = await Transaction.countDocuments({
      transactionType: 'debit',
      shuttleId: { $ne: null },
      status: { $nin: ['Refunded', 'Failed'] }
    });

    // Get total TRIPS COMPLETED (from Trip model)
    const totalTripsCompleted = await Trip.countDocuments({
      status: 'completed'
    });

    // Get total collections (sum of NON-REFUNDED debits only)
    // We don't need to subtract refunds because refunded transactions are already excluded
    const debitsAgg = await Transaction.aggregate([
      {
        $match: {
          transactionType: 'debit',
          shuttleId: { $ne: null },
          status: { $nin: ['Refunded', 'Failed'] } // Exclude refunded and failed
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalCollections = debitsAgg.length > 0 ? debitsAgg[0].total : 0;

    // Get total refunds (for reporting purposes)
    const creditsAgg = await Transaction.aggregate([
      {
        $match: {
          transactionType: 'credit',
          shuttleId: { $ne: null },
          transactionId: { $regex: /^RFD/ }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRefunds = creditsAgg.length > 0 ? creditsAgg[0].total : 0;

    // Get active shuttles count
    const activeShuttles = await Shuttle.countDocuments({ isActive: true });
    const shuttlesInUse = await Shuttle.countDocuments({ status: 'taken' });

    // Get today's statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's PASSENGERS (transaction count)
    const todayPassengers = await Transaction.countDocuments({
      transactionType: 'debit',
      shuttleId: { $ne: null },
      status: { $nin: ['Refunded', 'Failed'] },
      createdAt: { $gte: today }
    });

    // Today's TRIPS COMPLETED
    const todayTripsCompleted = await Trip.countDocuments({
      status: 'completed',
      arrivalTime: { $gte: today }
    });

    // Today's revenue (sum of NON-REFUNDED debits only)
    const todayRevenueAgg = await Transaction.aggregate([
      {
        $match: {
          transactionType: 'debit',
          shuttleId: { $ne: null },
          status: { $nin: ['Refunded', 'Failed'] },
          createdAt: { $gte: today }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const todayRevenue = todayRevenueAgg.length > 0 ? todayRevenueAgg[0].total : 0;

    // Today's refunds (for reporting)
    const todayRefundsAgg = await Transaction.aggregate([
      {
        $match: {
          transactionType: 'credit',
          shuttleId: { $ne: null },
          transactionId: { $regex: /^RFD/ },
          createdAt: { $gte: today }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const todayRefunds = todayRefundsAgg.length > 0 ? todayRefundsAgg[0].total : 0;

    // Get active drivers count
    const activeDrivers = await Driver.countDocuments({ isActive: true });

    // Get total users
    const totalUsers = await User.countDocuments({ isActive: true });

    res.json({
      totalPassengers,          // Total passengers (transaction count)
      totalTripsCompleted,      // Total trips completed (from Trip model)
      totalRides: totalTripsCompleted, // Alias for backward compatibility
      totalCollections,         // Net revenue (debits - refunds)
      activeShuttles,
      shuttlesInUse,
      activeDrivers,
      totalUsers,
      today: {
        rides: todayTripsCompleted,    // Today's completed trips
        passengers: todayPassengers,   // Today's passengers
        revenue: todayRevenue          // Net revenue for today
      },
      refunds: {
        total: totalRefunds,
        today: todayRefunds
      }
    });
  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /admin/shuttle-positions
 * Get current positions of all shuttles actually in transit (not just reserved)
 */
router.get('/shuttle-positions', async (req, res) => {
  try {
    // Get shuttles that are currently taken (actually in transit, not just reserved)
    const shuttlesInTransit = await Shuttle.find({ status: 'taken' });
    console.log(`📍 Found ${shuttlesInTransit.length} shuttles with status 'taken' (actually in transit)`);

    const positions = [];

    for (const shuttle of shuttlesInTransit) {
      // Get position from ShuttlePosition model
      let position = null;
      if (ShuttlePosition) {
        position = await ShuttlePosition.findOne({ shuttleId: shuttle.shuttleId })
          .sort({ updatedAt: -1 });
      }

      console.log(`🚐 ${shuttle.shuttleId}: GPS data = ${position ? `${position.latitude}, ${position.longitude}` : 'NONE'}`);

      // Skip shuttles without real GPS data
      if (!position || !position.latitude || !position.longitude) {
        console.log(`   ⚠️ Skipping ${shuttle.shuttleId} - no GPS data`);
        continue;
      }

      console.log(`   ✅ Including ${shuttle.shuttleId} in positions`);

      // Get active trip for this shuttle
      let activeTrip = null;
      try {
        activeTrip = await Trip.findOne({ 
          shuttleId: shuttle.shuttleId, 
          status: 'active',
          endTime: null 
        }).sort({ startTime: -1 });
      } catch (error) {
        console.log(`   ℹ️ No active trip found for ${shuttle.shuttleId}`);
      }

      positions.push({
        shuttleId: shuttle.shuttleId,
        vehicleType: shuttle.vehicleType,
        vehicleModel: shuttle.vehicleModel,
        plateNumber: shuttle.plateNumber,
        driverName: shuttle.currentDriver,
        driverId: shuttle.currentDriverId,
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: position.timestamp,
        updatedAt: position.updatedAt,
        status: shuttle.status,
        // Include trip info if available
        tripId: activeTrip?._id,
        routeId: activeTrip?.routeId,
        startTime: activeTrip?.startTime,
        currentPassengers: activeTrip?.passengers?.length || 0,
        estimatedReturn: activeTrip?.estimatedReturn
      });
    }

    console.log(`📍 Returning ${positions.length} shuttle positions with GPS data`);
    res.json(positions);
  } catch (error) {
    console.error('❌ Error fetching shuttle positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DRIVERS CRUD
// ============================================================

router.get('/drivers', async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/drivers/:id', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/drivers', async (req, res) => {
  try {
    const driver = new Driver(req.body);
    await driver.save();

    // Log admin action
    await logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Driver Created',
      description: `created driver ${driver.driverId} (${driver.firstName} ${driver.lastName})`,
      targetEntity: 'driver',
      targetId: driver.driverId,
      crudOperation: 'crud_create',
      changes: req.body,
      ipAddress: req.ip
    });

    res.status(201).json(driver);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/drivers/:id', async (req, res) => {
  try {
    const oldDriver = await Driver.findById(req.params.id);
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    // Log admin action
    await logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Driver Updated',
      description: `updated driver ${driver.driverId} (${driver.firstName} ${driver.lastName})`,
      targetEntity: 'driver',
      targetId: driver.driverId,
      crudOperation: 'crud_update',
      changes: { old: oldDriver, new: driver },
      ipAddress: req.ip
    });

    res.json(driver);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/drivers/:id', async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    // Log admin action
    await logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Driver Deleted',
      description: `deleted driver ${driver.driverId} (${driver.firstName} ${driver.lastName})`,
      targetEntity: 'driver',
      targetId: driver.driverId,
      crudOperation: 'crud_delete',
      severity: 'warning',
      ipAddress: req.ip
    });

    res.json({ message: 'Driver deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SHUTTLES CRUD
// ============================================================

router.get('/shuttles', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const shuttles = await Shuttle.find(filter).sort({ createdAt: -1 });
    res.json(shuttles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/shuttles/:id', async (req, res) => {
  try {
    const shuttle = await Shuttle.findById(req.params.id);
    if (!shuttle) return res.status(404).json({ error: 'Shuttle not found' });
    res.json(shuttle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/shuttles', broadcastChanges('shuttle'), async (req, res) => {
  try {
    const shuttle = new Shuttle(req.body);
    await shuttle.save();

    // Log admin action
    await logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Shuttle Created',
      description: `created shuttle ${shuttle.plateNumber}`,
      targetEntity: 'shuttle',
      targetId: shuttle._id,
      crudOperation: 'crud_create',
      changes: req.body,
      ipAddress: req.ip
    });

    res.status(201).json(shuttle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/shuttles/:id', broadcastChanges('shuttle'), async (req, res) => {
  try {
    const oldShuttle = await Shuttle.findById(req.params.id);
    const shuttle = await Shuttle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!shuttle) return res.status(404).json({ error: 'Shuttle not found' });

    // Log admin action
    await logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Shuttle Updated',
      description: `updated shuttle ${shuttle.plateNumber}`,
      targetEntity: 'shuttle',
      targetId: shuttle._id,
      crudOperation: 'crud_update',
      changes: { old: oldShuttle, new: shuttle },
      ipAddress: req.ip
    });

    res.json(shuttle);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/shuttles/:id', async (req, res) => {
  try {
    const shuttle = await Shuttle.findByIdAndDelete(req.params.id);
    if (!shuttle) return res.status(404).json({ error: 'Shuttle not found' });

    // Log admin action
    await logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Shuttle Deleted',
      description: `deleted shuttle ${shuttle.plateNumber}`,
      targetEntity: 'shuttle',
      targetId: shuttle._id,
      crudOperation: 'crud_delete',
      severity: 'warning',
      ipAddress: req.ip
    });

    res.json({ message: 'Shuttle deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PHONES CRUD
// ============================================================

router.get('/phones', async (req, res) => {
  try {
    // Motorpool admin only sees phones that are either:
    // 1. Not assigned to anyone (available)
    // 2. Assigned to drivers (has assignedDriverId)
    // 3. NOT assigned to merchants
    const phones = await Phone.find({
      $or: [
        { assignedDriverId: { $ne: null } }, // Assigned to a driver
        { $and: [ // Available (not assigned to anyone)
          { assignedDriverId: null },
          { assignedMerchantId: null }
        ]}
      ]
    }).sort({ createdAt: -1 });
    res.json(phones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/phones/:id', async (req, res) => {
  try {
    const phone = await Phone.findById(req.params.id);
    if (!phone) return res.status(404).json({ error: 'Phone not found' });
    res.json(phone);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/phones/:id', async (req, res) => {
  try {
    // Motorpool admin: If assigning to driver, clear merchant assignment
    const updateData = { ...req.body };
    if (updateData.assignedDriverId) {
      updateData.assignedMerchantId = null;
      updateData.assignedBusinessName = null;
      updateData.assignedMerchantDate = null;
    }

    const phone = await Phone.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!phone) return res.status(404).json({ error: 'Phone not found' });

    // Log phone update
    logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Phone Updated',
      description: `updated phone ${phone.phoneId}`,
      targetEntity: 'phone',
      targetId: phone.phoneId,
      crudOperation: 'crud_update',
      changes: { updates: req.body },
      ipAddress: req.ip
    }).catch(() => {});

    res.json(phone);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/phones/:id', async (req, res) => {
  try {
    const phone = await Phone.findByIdAndDelete(req.params.id);
    if (!phone) return res.status(404).json({ error: 'Phone not found' });

    // Log phone deletion
    logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Phone Deleted',
      description: `deleted phone ${phone.phoneId}`,
      targetEntity: 'phone',
      targetId: phone.phoneId,
      crudOperation: 'crud_delete',
      severity: 'warning',
      ipAddress: req.ip
    }).catch(() => {});

    res.json({ message: 'Phone deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ROUTES CRUD
// ============================================================

router.get('/routes', async (req, res) => {
  try {
    const { active } = req.query;
    const filter = active === 'true' ? { isActive: true } : {};
    const routes = await Route.find(filter).sort({ createdAt: -1 });
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/routes/:id', async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/routes', broadcastChanges('route'), async (req, res) => {
  try {
    const route = new Route(req.body);
    await route.save();

    // Log route creation
    logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Route Created',
      description: `created route ${route.routeId || route._id}`,
      targetEntity: 'route',
      targetId: route._id,
      crudOperation: 'crud_create',
      changes: req.body,
      ipAddress: req.ip
    }).catch(() => {});

    res.status(201).json(route);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/routes/:id', broadcastChanges('route'), async (req, res) => {
  try {
    const oldRoute = await Route.findById(req.params.id).lean();
    const route = await Route.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!route) return res.status(404).json({ error: 'Route not found' });

    // Log route update
    logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Route Updated',
      description: `updated route ${route.routeId || route._id}`,
      targetEntity: 'route',
      targetId: route._id,
      crudOperation: 'crud_update',
      changes: { old: oldRoute, new: req.body },
      ipAddress: req.ip
    }).catch(() => {});

    res.json(route);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/routes/:id', async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    // Log route deletion
    logAdminAction({
      adminId: req.adminInfo?.adminId || 'system',
      adminName: req.adminInfo?.adminName || 'Unknown Admin',
      adminRole: req.adminInfo?.adminRole || 'unknown',
      department: req.adminInfo?.department,
      action: 'Route Deleted',
      description: `deleted route ${route.routeId || route._id}`,
      targetEntity: 'route',
      targetId: route._id,
      crudOperation: 'crud_delete',
      severity: 'warning',
      ipAddress: req.ip
    }).catch(() => {});

    res.json({ message: 'Route deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// EVENT LOGS
// ============================================================

router.get('/event-logs', async (req, res) => {
  try {
    const { department } = req.query;
    
    // Build query based on department/role - works with both old and new formats
    let query = {};
    
    if (!department || department === 'sysad') {
      // System admin sees everything
      query = {};
    } else if (department === 'motorpool') {
      // Motorpool admin sees motorpool-related logs (works with old and new formats)
      query = {
        $or: [
          // New format: motorpool admin authentication
          { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'motorpool' },
          // New format: department field
          { department: 'motorpool' },
          // New format: targetEntity
          { targetEntity: { $in: ['driver', 'shuttle', 'route', 'trip', 'phone'] } },
          // Driver-related event types
          { eventType: { $in: [
            'driver_login', 'driver_logout', 'trip_start', 'trip_end', 
            'route_change', 'refund', 'phone_assigned', 'phone_unassigned'
          ]}},
          // Old format: admin actions by motorpool
          { eventType: 'admin_action', 'metadata.adminId': 'motorpool' },
          // Any logs with driverId (motorpool related)
          { driverId: { $exists: true, $ne: null } },
          // New format: CRUD operations by motorpool admins
          { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'motorpool' }
        ]
      };
    } else if (department === 'treasury') {
      // Treasury admin sees treasury-related logs (works with old and new formats)
      query = {
        $or: [
          // New format: treasury admin authentication
          { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'treasury' },
          // New format: department field
          { department: 'treasury' },
          // New format: targetEntity
          { targetEntity: { $in: ['user', 'transaction'] } },
          // Treasury-specific event types
          { eventType: { $in: ['cash_in', 'registration'] } },
          // Old format: admin actions by treasury
          { eventType: 'admin_action', 'metadata.adminId': 'treasury' },
          // Old format: cash-in processed by treasury
          { eventType: 'admin_action', title: /Cash-In/i },
          // New format: CRUD operations by treasury admins
          { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'treasury' }
        ]
      };
    } else if (department === 'merchant') {
      // Merchant admin sees merchant-related logs
      query = {
        $or: [
          // New format: merchant admin authentication
          { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'merchant' },
          // New format: department field
          { department: 'merchant' },
          // New format: targetEntity
          { targetEntity: 'merchant' },
          // Merchant-specific event types
          { eventType: { $in: ['merchant_login', 'merchant_logout'] } },
          // Old format: admin actions by merchant
          { eventType: 'admin_action', 'metadata.adminId': 'merchant' },
          // New format: CRUD operations by merchant admins
          { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'merchant' }
        ]
      };
    } else if (department === 'accounting') {
      // Accounting admin sees accounting-related logs
      query = {
        $or: [
          // New format: accounting admin authentication
          { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'accounting' },
          // New format: department field
          { department: 'accounting' },
          // Old format: admin actions by accounting
          { eventType: 'admin_action', 'metadata.adminId': 'accounting' },
          // New format: CRUD operations by accounting admins
          { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'accounting' }
        ]
      };
    }
    
    const logs = await EventLog.find(query)
      .sort({ timestamp: -1 })
      .limit(200);
    
    res.json(logs);
  } catch (error) {
    console.error('❌ Error getting event logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/event-logs
 * Create a new event log
 */
router.post('/event-logs', async (req, res) => {
  try {
    const log = await EventLog.create(req.body);
    console.log(`✅ Event log created: ${log.eventType} - ${log.title}`);
    res.json({ success: true, log });
  } catch (error) {
    console.error('❌ Error creating event log:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// USER CONCERNS
// ============================================================

router.get('/user-concerns', async (req, res) => {
  try {
    const concerns = await UserConcern.find().sort({ submittedAt: -1 });
    res.json({ success: true, concerns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single concern by concernId or _id
router.get('/user-concerns/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by concernId first, then by _id
    let concern = await UserConcern.findOne({ concernId: id });

    if (!concern) {
      concern = await UserConcern.findById(id);
    }

    if (!concern) {
      return res.status(404).json({ success: false, error: 'Concern not found' });
    }

    res.json({ success: true, concern });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/user-concerns/:id/status', async (req, res) => {
  try {
    const { status, resolution, adminName } = req.body;
    const { id } = req.params;

    // Require resolution when resolving
    if (status === 'resolved' && (!resolution || !resolution.trim())) {
      return res.status(400).json({
        success: false,
        error: 'A resolution message is required when resolving a concern'
      });
    }

    // Build update object
    const updateData = { status, updatedAt: new Date() };

    // If resolving, add resolution details
    if (status === 'resolved') {
      updateData.resolution = resolution;
      updateData.adminResponse = resolution;
      updateData.resolvedDate = new Date();
      updateData.resolvedBy = adminName || req.adminId || 'Admin';
      updateData.respondedDate = new Date();
    }

    // If marking as in_progress, record the timestamp
    if (status === 'in_progress') {
      updateData.inProgressDate = new Date();
    }

    // Try to find by concernId first, then by _id
    let concern = await UserConcern.findOneAndUpdate(
      { concernId: id },
      updateData,
      { new: true }
    );

    // If not found by concernId, try by _id
    if (!concern) {
      concern = await UserConcern.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
    }
    if (!concern) return res.status(404).json({ error: 'Concern not found' });

    // Log admin action
    await logAdminAction({
      action: 'Concern Status Updated',
      description: `updated concern ${concern.concernId} status to ${status}`,
      adminId: req.adminId || 'system',
      targetEntity: 'concern',
      targetId: concern.concernId,
      changes: { status, resolution }
    });

    // Send email notification when concern status changes
    if (status === 'in_progress' && concern.userEmail) {
      try {
        const { sendConcernInProgressEmail } = await import('../services/emailService.js');

        await sendConcernInProgressEmail(concern.userEmail, concern.userName || 'Valued User', {
          concernId: concern.concernId,
          subject: concern.subject || concern.selectedConcerns?.join(', ') || 'Your Concern',
          reportTo: concern.reportTo || 'NUCash Support'
        });

        console.log(`✉️ In-progress notification email sent to ${concern.userEmail}`);
      } catch (emailError) {
        console.error('Failed to send in-progress email:', emailError);
        // Don't fail the request if email fails
      }
    }

    if (status === 'resolved' && concern.userEmail) {
      try {
        const { sendConcernResolvedEmail } = await import('../services/emailService.js');

        await sendConcernResolvedEmail(concern.userEmail, concern.userName || 'Valued User', {
          concernId: concern.concernId,
          subject: concern.subject || concern.selectedConcerns?.join(', ') || 'Your Concern',
          reportTo: concern.reportTo || 'NUCash Support',
          adminReply: resolution,
          resolvedBy: adminName || 'Support Team'
        });

        console.log(`✉️ Resolution email sent to ${concern.userEmail}`);
      } catch (emailError) {
        console.error('Failed to send resolution email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({ success: true, concern, emailSent: status === 'resolved' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// TRIPS
// ============================================================

router.get('/trips', async (req, res) => {
  try {
    const trips = await Trip.find().sort({ departureTime: -1 }).limit(500);
    res.json(trips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trips/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /admin/trips/:id/notes
 * Add a note/comment to a trip
 */
router.post('/trips/:id/notes', async (req, res) => {
  try {
    const { content, adminId, adminName } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Add note to trip
    trip.notes = trip.notes || [];
    trip.notes.push({
      adminId: adminId || 'unknown',
      adminName: adminName || 'Admin',
      content: content.trim(),
      timestamp: new Date()
    });

    await trip.save();

    // Log admin action
    await logAdminAction({
      adminId: adminId || 'unknown',
      action: 'add_trip_note',
      entityType: 'trip',
      entityId: trip._id.toString(),
      details: { content: content.trim() }
    });

    console.log(`✅ Note added to trip ${trip._id} by ${adminName}`);

    res.json({
      success: true,
      trip: trip
    });
  } catch (error) {
    console.error('❌ Error adding trip note:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SETTINGS ENDPOINTS
// ============================================================

/**
 * GET /admin/settings
 * Get all system settings
 */
router.get('/settings', async (req, res) => {
  try {
    // Return settings from local storage or default values
    // In a real system, these would be stored in the database
    const settings = {
      general: {
        systemName: 'NUCash Motorpool System',
        supportEmail: 'support@nucash.com',
        maintenanceMode: false
      },
      fare: {
        baseFare: 15,
        perKmRate: 5,
        currency: 'PHP'
      },
      shuttle: {
        maxCapacity: 20,
        autoAssignment: true,
        maintenanceAlertThreshold: 30
      },
      notifications: {
        emailNotifications: true,
        smsNotifications: false,
        driverAlerts: true
      }
    };

    res.json(settings);
  } catch (error) {
    console.error('❌ Error loading settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /admin/settings
 * Update a system setting
 */
router.put('/settings', async (req, res) => {
  try {
    const { section, key, value, adminId, adminName } = req.body;

    console.log(`⚙️ Setting updated: ${section}.${key} = ${value} by ${adminName}`);

    // Log the settings change
    await logAdminAction({
      adminId: adminId || 'unknown',
      action: 'update_setting',
      entityType: 'settings',
      entityId: `${section}.${key}`,
      details: { section, key, value, previousValue: null }
    });

    res.json({
      success: true,
      message: 'Setting updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating setting:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;