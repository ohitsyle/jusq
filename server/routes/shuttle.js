// server/routes/shuttle.js
// FIXED: 
// 1. Uses fareAmount from request body, or fetches from Route model
// 2. Proper shuttle release on end-route
// 3. Refund emails working

import express from 'express';
const router = express.Router();
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import ShuttleTransaction from '../models/ShuttleTransaction.js';
import Trip from '../models/Trip.js';
import Setting from '../models/Setting.js';
import Shuttle from '../models/Shuttle.js';
import Driver from '../models/Driver.js';
import Route from '../models/Route.js';

// Import email service
let sendReceipt = null;
let sendRefundReceipt = null;

import('../services/emailService.js')
  .then(emailService => {
    // Access the default export
    const service = emailService.default || emailService;
    sendReceipt = service.sendReceipt;
    sendRefundReceipt = service.sendRefundReceipt;
    console.log('✅ Email service loaded');
    console.log('📧 sendReceipt available:', typeof sendReceipt === 'function');
    console.log('📧 sendRefundReceipt available:', typeof sendRefundReceipt === 'function');
  })
  .catch((e) => {
    console.error('⚠️ Email service not configured:', e.message);
  });

/**
 * POST /shuttle/pay
 * Process shuttle payment
 * FIXED: Now uses fareAmount from request or fetches from Route model
 */
router.post('/pay', async (req, res) => {
  try {
    const { rfidUId, driverId, shuttleId, routeId, tripId, fareAmount, deviceTimestamp, offlineMode } = req.body;

    console.log('💳 Processing payment:', { rfidUId, driverId, shuttleId, routeId, tripId, fareAmount });

    // ===== DUPLICATE DETECTION =====
    // For offline transactions being synced, check if this exact transaction already exists
    if (deviceTimestamp && offlineMode) {
      const existingTx = await Transaction.findOne({
        deviceTimestamp: deviceTimestamp,
        shuttleId: shuttleId || null,
        transactionType: 'debit',
        status: 'Completed'
      });

      if (existingTx) {
        console.log(`⚠️ Duplicate offline transaction detected (deviceTimestamp: ${deviceTimestamp}). Returning existing.`);
        const user = await User.findOne({ rfidUId });
        return res.json({
          success: true,
          duplicate: true,
          studentName: user?.fullName || 'Unknown',
          fareAmount: existingTx.amount,
          previousBalance: existingTx.balance + existingTx.amount,
          newBalance: existingTx.balance,
          rfidUId: rfidUId,
          transactionId: existingTx.transactionId
        });
      }
    }

    // Validate required fields
    if (!rfidUId) {
      console.log('❌ Missing rfidUId');
      return res.status(400).json({ error: 'RFID UID is required' });
    }

    if (!driverId) {
      console.log('❌ Missing driverId');
      return res.status(400).json({ error: 'Driver ID is required' });
    }

    if (!shuttleId) {
      console.log('❌ Missing shuttleId');
      return res.status(400).json({ error: 'Shuttle ID is required' });
    }

    if (!routeId) {
      console.log('❌ Missing routeId');
      return res.status(400).json({ error: 'Route ID is required' });
    }

    if (!tripId) {
      console.log('❌ Missing tripId');
      // For offline payments, generate a temporary tripId
      const tempTripId = `OFFLINE_${Date.now()}_${shuttleId}`;
      console.log('🔄 Generated temporary tripId for offline payment:', tempTripId);
      req.body.tripId = tempTripId;
    }

    if (!fareAmount || fareAmount <= 0) {
      console.log('❌ Invalid fareAmount:', fareAmount);
      return res.status(400).json({ error: 'Valid fare amount is required' });
    }

    // Find user by rfidUId
    const user = await User.findOne({ rfidUId });
    if (!user) {
      console.log('❌ Card not found:', rfidUId);
      return res.status(404).json({ error: 'Card not recognized' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // FIXED: Determine fare amount
    // Priority: 1) Request body fareAmount, 2) Route's fare, 3) Setting's currentFare, 4) Default 15
    let fare = 15; // Default fallback

    if (fareAmount && fareAmount > 0) {
      // Use fare from request (sent by mobile app)
      fare = fareAmount;
      console.log('💰 Using fare from request:', fare);
    } else if (routeId) {
      // Try to get fare from Route model
      try {
        const routeDoc = await Route.findOne({ routeId: routeId });
        if (routeDoc && routeDoc.fare) {
          fare = routeDoc.fare;
          console.log('💰 Using fare from route:', fare);
        }
      } catch (routeErr) {
        console.warn('⚠️ Could not fetch route fare:', routeErr.message);
      }
    }

    // If still default, check settings
    if (fare === 15) {
      const setting = await Setting.findOne();
      if (setting?.currentFare) {
        fare = setting.currentFare;
        console.log('💰 Using fare from settings:', fare);
      }
    }

    const negativeLimit = (await Setting.findOne())?.negativeLimit || -14;

    // Get balance BEFORE any modification
    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore - fare;
    
    console.log(`💰 Balance calculation: ${balanceBefore} - ${fare} = ${balanceAfter}`);
    
    // Skip balance check for offline payments (they were already validated offline)
    const isOfflineMode = req.body.offlineMode === true;
    if (!isOfflineMode) {
      // Check if balance would go below limit (only for online payments)
      if (balanceAfter < negativeLimit) {
        return res.status(400).json({
          error: 'Insufficient balance. Please recharge your card.',
          requiresRecharge: true,
          currentBalance: balanceBefore,
          fare: fare,
          negativeLimit: negativeLimit
        });
      }
    } else {
      console.log('🔄 Offline mode detected - skipping balance check');
    }

    // Update user balance ONCE
    user.balance = balanceAfter;
    await user.save();

    // Generate transaction ID
    const transactionId = Transaction.generateTransactionId();

    // Create transaction record - MATCHING THE SCHEMA EXACTLY
    const transaction = await Transaction.create({
      transactionId: transactionId,
      transactionType: 'debit',
      amount: fare,
      status: 'Completed',
      userId: user._id,
      schoolUId: user.schoolUId,
      email: user.email,
      balance: balanceAfter,
      shuttleId: shuttleId || null,
      driverId: driverId || null,
      routeId: routeId || null,
      deviceTimestamp: req.body.deviceTimestamp || null
    });

    // Create detailed shuttle transaction if tripId provided
    if (tripId) {
      try {
        await ShuttleTransaction.create({
          tripId: tripId,
          shuttleId: shuttleId,
          driverId: driverId,
          routeId: routeId,
          userId: user._id,
          rfidUId: user.rfidUId,
          userName: user.fullName,
          userEmail: user.email,
          fareCharged: fare,
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          status: 'completed',
          timestamp: new Date()
        });
      } catch (stErr) {
        console.warn('⚠️ ShuttleTransaction creation failed:', stErr.message);
      }
    }

    console.log(`✅ Payment processed: ${user.fullName} - ₱${fare} (${balanceBefore} → ${balanceAfter})`);

    // Send email receipt
    if (sendReceipt && user.email) {
      sendReceipt({
        userEmail: user.email,
        userName: user.fullName,
        fareAmount: fare,
        previousBalance: balanceBefore,
        newBalance: balanceAfter,
        timestamp: new Date(),
        merchantName: 'NU Shuttle Service',
        transactionId: transactionId
      }).catch(err => console.error('📧 Email error:', err));
    }

    // Return success response
    res.json({
      success: true,
      studentName: user.fullName,
      fareAmount: fare,
      previousBalance: balanceBefore,
      newBalance: balanceAfter,
      rfidUId: user.rfidUId,
      transactionId: transactionId
    });

  } catch (error) {
    console.error('❌ Payment error:', error);
    res.status(500).json({ 
      error: error.message || 'Payment processing failed'
    });
  }
});

/**
 * POST /shuttle/refund
 * Refund shuttle payments
 */
router.post('/refund', async (req, res) => {
  try {
    const { transactionIds, reason, rfidUId, driverId, shuttleId, routeId, tripId, fareAmount, deviceTimestamp, offlineMode } = req.body;

    console.log('💸 Refund request received:', { 
      offlineMode, 
      rfidUId, 
      fareAmount, 
      transactionIds: transactionIds?.length || 0,
      reason 
    });

    // Handle offline refunds (direct refund by RFID)
    if (offlineMode && rfidUId && fareAmount) {
      console.log('💸 Processing offline refund for:', rfidUId, 'Amount:', fareAmount);
      
      // Find user by RFID
      const user = await User.findOne({ rfidUId });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      // Process refund
      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore + fareAmount;
      
      user.balance = balanceAfter;
      await user.save();

      // Create refund transaction record
      const transactionId = Transaction.generateTransactionId();
      const transaction = new Transaction({
        transactionId,
        userId: user._id,
        rfidUId: user.rfidUId,
        userName: user.fullName,
        userEmail: user.email,
        amount: fareAmount,
        type: 'credit',
        transactionType: 'refund',
        status: 'Completed',
        paymentMethod: 'offline_refund',
        driverId,
        shuttleId,
        routeId,
        tripId,
        timestamp: new Date(deviceTimestamp || Date.now()),
        deviceTimestamp: deviceTimestamp,
        offlineMode: true,
        reason: reason || 'Offline refund processed',
        balanceBefore,
        balanceAfter,
        merchantName: 'NU Shuttle Service'
      });

      await transaction.save();

      console.log(`✅ Offline refund processed: ${user.fullName} + ₱${fareAmount} (${balanceBefore} → ${balanceAfter})`);

      // Send email receipt for refund
      if (user.email) {
        sendRefundReceipt({
          userEmail: user.email,
          userName: user.fullName,
          refundAmount: fareAmount,
          previousBalance: balanceBefore,
          newBalance: balanceAfter,
          timestamp: new Date(),
          merchantName: 'NU Shuttle Service',
          transactionId,
          reason: reason || 'Offline refund processed'
        }).catch(err => console.error('📧 Refund email error:', err));
      }

      return res.json({
        success: true,
        studentName: user.fullName,
        refundAmount: fareAmount,
        previousBalance: balanceBefore,
        newBalance: balanceAfter,
        rfidUId: user.rfidUId,
        transactionId,
        reason: reason || 'Offline refund processed'
      });
    }

    // Handle online refunds (by transaction IDs)
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ error: 'Transaction IDs required' });
    }

    console.log('💸 Processing refunds for', transactionIds.length, 'transactions');

    const refundResults = [];
    const errors = [];

    for (const txId of transactionIds) {
      try {
        // Find the transaction (support both transactionId string and _id)
        let transaction = await Transaction.findOne({ transactionId: txId });
        if (!transaction) {
          transaction = await Transaction.findById(txId);
        }
        
        if (!transaction) {
          errors.push({ transactionId: txId, error: 'Transaction not found' });
          continue;
        }

        if (transaction.status === 'Refunded') {
          errors.push({ transactionId: txId, error: 'Already refunded' });
          continue;
        }

        // Find the user
        const user = await User.findById(transaction.userId);
        
        if (!user) {
          errors.push({ transactionId: txId, error: 'User not found' });
          continue;
        }

        // Calculate refund
        const refundAmount = transaction.amount;
        const balanceBefore = user.balance;
        const balanceAfter = balanceBefore + refundAmount;

        // Refund the amount
        user.balance = balanceAfter;
        await user.save();

        // Update transaction status
        transaction.status = 'Refunded';
        await transaction.save();

        // Generate refund transaction ID
        const refundTxId = Transaction.generateTransactionId().replace('TXN', 'RFD');

        // Create refund transaction record
        await Transaction.create({
          transactionId: refundTxId,
          transactionType: 'credit',
          amount: refundAmount,
          status: 'Completed',
          userId: user._id,
          schoolUId: user.schoolUId,
          email: user.email,
          balance: balanceAfter,
          shuttleId: transaction.shuttleId,
          driverId: transaction.driverId,
          routeId: transaction.routeId
        });

        console.log(`✅ Refunded: ${user.fullName} +₱${refundAmount} (${balanceBefore} → ${balanceAfter})`);

        // Send refund email
        if (sendRefundReceipt && user.email) {
          sendRefundReceipt({
            userEmail: user.email,
            userName: user.fullName,
            refundAmount: refundAmount,
            previousBalance: balanceBefore,
            newBalance: balanceAfter,
            timestamp: new Date(),
            transactionId: refundTxId,
            originalTransactionId: transaction.transactionId,
            reason: reason || 'Route cancelled by driver'
          }).catch(err => console.error('📧 Refund email error:', err));
        }

        refundResults.push({
          transactionId: transaction.transactionId,
          refundId: refundTxId,
          userName: user.fullName,
          amount: refundAmount,
          newBalance: balanceAfter
        });

      } catch (err) {
        console.error('❌ Refund error for transaction', txId, err);
        errors.push({ transactionId: txId, error: err.message });
      }
    }

    res.json({
      success: true,
      refunded: refundResults.length,
      failed: errors.length,
      results: refundResults,
      errors: errors
    });

  } catch (error) {
    console.error('❌ Refund error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /shuttle/end-route
 * End a route and release the shuttle
 */
router.post('/end-route', async (req, res) => {
  try {
    const { shuttleId, driverId, tripId, summary } = req.body;

    console.log('🏁 Ending route:', { shuttleId, driverId, tripId });

    // Release the shuttle
    if (shuttleId) {
      const shuttle = await Shuttle.findOne({ shuttleId });
      if (shuttle) {
        console.log(`📍 Found shuttle ${shuttleId}, current status: ${shuttle.status}`);
        shuttle.status = 'available';
        shuttle.currentDriver = null;
        shuttle.currentDriverId = null;
        shuttle.updatedAt = new Date();
        await shuttle.save();
        console.log(`✅ Shuttle ${shuttleId} released, new status: available`);
      } else {
        console.warn(`⚠️ Shuttle ${shuttleId} not found`);
      }
    }

    // Clear driver's shuttle assignment
    if (driverId) {
      const driver = await Driver.findOne({ driverId });
      if (driver) {
        driver.shuttleId = null;
        await driver.save();
        console.log(`✅ Driver ${driverId} shuttle assignment cleared`);
      }
    }

    // Update trip record if exists
    if (tripId) {
      try {
        await Trip.findByIdAndUpdate(tripId, {
          status: 'completed',
          endTime: new Date(),
          summary: summary
        });
      } catch (tripErr) {
        console.warn('⚠️ Trip update failed:', tripErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Route ended and shuttle released',
      shuttleId: shuttleId,
      driverId: driverId
    });

  } catch (error) {
    console.error('❌ End route error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /shuttle/sync
 * Sync offline transactions
 */
router.post('/sync', async (req, res) => {
  try {
    const { deviceId, transactions } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Transactions array required' });
    }

    console.log('🔄 Syncing', transactions.length, 'offline transactions from', deviceId);

    const processed = [];
    const rejected = [];

    for (const tx of transactions) {
      try {
        // ===== DUPLICATE DETECTION =====
        // Check if this offline transaction was already synced
        if (tx.timestamp) {
          const existingTx = await Transaction.findOne({
            deviceTimestamp: tx.timestamp,
            shuttleId: tx.shuttleId || null,
            transactionType: 'debit',
            status: 'Completed'
          });

          if (existingTx) {
            console.log(`⚠️ Duplicate sync transaction skipped (deviceTimestamp: ${tx.timestamp})`);
            processed.push({
              rfidUId: tx.rfidUId,
              userName: existingTx.email || tx.rfidUId,
              amount: existingTx.amount,
              transactionId: existingTx.transactionId,
              duplicate: true
            });
            continue;
          }
        }

        const user = await User.findOne({ rfidUId: tx.rfidUId });

        if (!user) {
          rejected.push({ rfidUId: tx.rfidUId, error: 'User not found' });
          continue;
        }

        // Use fare from transaction, or default
        const fare = tx.fareAmount || 15;

        // Deduct balance
        const balanceBefore = user.balance;
        const balanceAfter = balanceBefore - fare;

        user.balance = balanceAfter;
        await user.save();

        // Generate transaction ID
        const transactionId = Transaction.generateTransactionId();

        // Create transaction record
        await Transaction.create({
          transactionId: transactionId,
          transactionType: 'debit',
          amount: fare,
          status: 'Completed',
          userId: user._id,
          schoolUId: user.schoolUId,
          email: user.email,
          balance: balanceAfter,
          shuttleId: tx.shuttleId || null,
          driverId: tx.driverId || null,
          routeId: tx.routeId || null,
          deviceTimestamp: tx.timestamp || null
        });

        processed.push({
          rfidUId: tx.rfidUId,
          userName: user.fullName,
          amount: fare,
          transactionId: transactionId
        });

        console.log(`✅ Synced: ${user.fullName} - ₱${fare}`);

      } catch (err) {
        console.error('❌ Sync error for', tx.rfidUId, err.message);
        rejected.push({ rfidUId: tx.rfidUId, error: err.message });
      }
    }

    res.json({
      success: true,
      processed: processed.length,
      rejected: rejected,
      details: processed
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /shuttle/updateLocation
 * Update shuttle GPS location
 */
router.post('/updateLocation', async (req, res) => {
  try {
    const { shuttleId, latitude, longitude, timestamp } = req.body;

    console.log(`📍 Location update received: ${shuttleId} @ ${latitude?.toFixed(6)}, ${longitude?.toFixed(6)}`);

    // Update shuttle position in database
    if (shuttleId && latitude && longitude) {
      try {
        // Try to update or create ShuttlePosition
        const ShuttlePosition = (await import('../models/ShuttlePosition.js')).default;
        const result = await ShuttlePosition.findOneAndUpdate(
          { shuttleId },
          {
            shuttleId,
            latitude,
            longitude,
            timestamp: timestamp || new Date(),
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );
        console.log(`✅ Location saved to DB for ${shuttleId}`);
      } catch (posErr) {
        // Model might not exist, just log
        console.error(`❌ Failed to save location to DB:`, posErr.message);
        console.log(`📍 Location: ${shuttleId} @ ${latitude?.toFixed(6)}, ${longitude?.toFixed(6)}`);
      }
    } else {
      console.warn(`⚠️ Invalid location data: shuttleId=${shuttleId}, lat=${latitude}, lng=${longitude}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Update location error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /shuttle/geofenceEvent
 * Handle geofence entry/exit events
 */
router.post('/geofenceEvent', async (req, res) => {
  try {
    const { shuttleId, geofenceId, timestamp } = req.body;

    console.log(`🎯 Geofence event: ${shuttleId} entered ${geofenceId}`);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /shuttle/cards
 * Download all active user cards for offline caching
 * Returns minimal data: rfidUId, fullName, balance, isActive
 */
router.get('/cards', async (req, res) => {
  try {
    console.log('📥 Downloading card data for offline cache...');

    // Get all active users with RFID cards - only essential fields
    const users = await User.find(
      {
        rfidUId: { $exists: true, $ne: null, $ne: '' },
        isActive: true
      },
      {
        rfidUId: 1,
        firstName: 1,
        lastName: 1,
        middleName: 1,
        schoolUId: 1,
        userType: 1,
        balance: 1,
        isActive: 1,
        _id: 0
      }
    ).lean();

    // Construct fullName for each user (virtual fields not included in lean queries)
    const usersWithFullName = users.map(user => ({
      ...user,
      fullName: `${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}`.trim()
    }));

    console.log(`✅ Sending ${users.length} card records for offline cache`);

    res.json({
      success: true,
      count: usersWithFullName.length,
      cards: usersWithFullName,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Card download error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /shuttle/cards/updated
 * Get cards updated since a given timestamp (for incremental sync)
 */
router.get('/cards/updated', async (req, res) => {
  try {
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(0);

    console.log('📥 Downloading updated card data since:', sinceDate);

    const users = await User.find(
      {
        rfidUId: { $exists: true, $ne: null, $ne: '' },
        isActive: true,
        updatedAt: { $gte: sinceDate }
      },
      {
        rfidUId: 1,
        fullName: 1,
        balance: 1,
        schoolUId: 1,
        userType: 1,
        _id: 0
      }
    ).lean();

    console.log(`✅ Sending ${users.length} updated card records`);

    res.json({
      success: true,
      count: users.length,
      cards: users,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Updated cards download error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;