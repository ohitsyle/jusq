// server/routes/shuttle.js
// FIXED: 
// 1. Fare is always set by the server from the Route model (device amount ignored)
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
import { requireDeviceAuth } from '../middlewares/requireDeviceAuth.js';

// Every endpoint here moves money or shuttle state, so it needs a signed-in
// driver phone (the card list is also used by merchant phones).
const driverOnly = requireDeviceAuth(['driver']);
const driverOrMerchant = requireDeviceAuth(['driver', 'merchant']);

// The server decides the fare: route fare, else the system fare, else ₱15.
// Never trust an amount sent by the device.
async function resolveFare(routeId) {
  const routeDoc = routeId ? await Route.findOne({ routeId }).select('fare').lean() : null;
  if (routeDoc?.fare > 0) return routeDoc.fare;
  const setting = await Setting.findOne().select('currentFare').lean();
  return setting?.currentFare > 0 ? setting.currentFare : 15;
}

// A queued offline tap must carry the time it happened, and that time can't be in the future.
const isRealOfflineTap = (body) => {
  if (body.offlineMode !== true || !body.deviceTimestamp) return false;
  const t = Date.parse(body.deviceTimestamp);
  return Number.isFinite(t) && t <= Date.now() + 5 * 60 * 1000;
};

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
router.post('/pay', driverOnly, async (req, res) => {
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

    // Find user by rfidUId
    const user = await User.findOne({ rfidUId });
    if (!user) {
      console.log('❌ Card not found:', rfidUId);
      return res.status(404).json({ error: 'Card not recognized' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Fare is set by the server from the route — the device's fareAmount is ignored
    const fare = await resolveFare(routeId);
    if (fareAmount && Number(fareAmount) !== fare) {
      console.warn(`⚠️ Device sent fare ₱${fareAmount}, charging route fare ₱${fare}`);
    }

    const negativeLimit = (await Setting.findOne())?.negativeLimit || -14;

    // Atomic debit: the balance guard lives in the query itself, so two
    // concurrent taps can never race past the negative limit or lose an
    // update. A real queued offline tap (signed-in driver, past timestamp) was
    // accepted on the phone while offline, so it applies even below the limit
    // — but only ever for one server-set fare.
    const isOfflineMode = isRealOfflineTap(req.body);
    const debitQuery = isOfflineMode
      ? { _id: user._id }
      : { _id: user._id, balance: { $gte: negativeLimit + fare } };
    const debited = await User.findOneAndUpdate(debitQuery, { $inc: { balance: -fare } }, { new: true });

    if (!debited) {
      return res.status(400).json({
        error: 'Insufficient balance. Please recharge your card.',
        requiresRecharge: true,
        currentBalance: user.balance,
        fare: fare,
        negativeLimit: negativeLimit
      });
    }

    const balanceAfter = debited.balance;
    const balanceBefore = balanceAfter + fare;

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

    // Always create detailed shuttle transaction for passenger tracking
    try {
      await ShuttleTransaction.create({
        tripId: tripId || null,
        shuttleId: shuttleId,
        driverId: driverId,
        routeId: routeId,
        userId: user._id,
        cardUid: user.rfidUId || '',
        userName: user.fullName,
        userEmail: user.email,
        fareCharged: fare,
        balanceBefore: balanceBefore,
        status: 'completed',
        timestamp: new Date()
      });
    } catch (stErr) {
      console.warn('⚠️ ShuttleTransaction creation failed:', stErr.message);
    }

    console.log(`✅ Payment processed: ₱${fare} (${transactionId})`);

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
router.post('/refund', driverOnly, async (req, res) => {
  try {
    const { transactionIds, reason, rfidUId, driverId, shuttleId, routeId, tripId, fareAmount, deviceTimestamp, offlineMode } = req.body;

    console.log('💸 Refund request received:', { 
      offlineMode, 
      rfidUId, 
      fareAmount, 
      transactionIds: transactionIds?.length || 0,
      reason 
    });

    // Handle direct refunds by RFID (from mobile app or offline mode).
    // Refunds exactly one real fare: the latest un-refunded shuttle payment on
    // this card from the last 24h. The device's fareAmount is ignored.
    if (rfidUId) {
      console.log('💸 Processing direct refund for:', rfidUId);

      // Find user by RFID
      const user = await User.findOne({ rfidUId });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      // A queued offline refund may be retried after a lost response — don't pay it twice
      if (deviceTimestamp) {
        const already = await Transaction.findOne({ userId: user._id, transactionType: 'credit', status: 'Refunded', deviceTimestamp });
        if (already) {
          return res.json({ success: true, duplicate: true, studentName: user.fullName, refundAmount: already.amount,
            previousBalance: already.balance - already.amount, newBalance: already.balance, rfidUId: user.rfidUId,
            transactionId: already.transactionId, reason: reason || 'Refund processed' });
        }
      }

      // Claim the original fare atomically so it can only be refunded once
      const original = await Transaction.findOneAndUpdate(
        { userId: user._id, transactionType: 'debit', status: 'Completed', shuttleId: { $ne: null },
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { $set: { status: 'Refunded' } },
        { sort: { createdAt: -1 }, new: true }
      );
      if (!original) {
        return res.status(400).json({ error: 'No recent shuttle fare on this card to refund' });
      }
      const fareAmount = original.amount;

      // Atomic credit — refunds can race with taps on the same card
      const credited = await User.findByIdAndUpdate(user._id, { $inc: { balance: fareAmount } }, { new: true });
      const balanceAfter = credited.balance;
      const balanceBefore = balanceAfter - fareAmount;

      // Create refund transaction record
      const transactionId = Transaction.generateTransactionId();
      const transaction = new Transaction({
        transactionId,
        userId: user._id,
        schoolUId: user.schoolUId,
        email: user.email,
        amount: fareAmount,
        transactionType: 'credit',
        status: 'Refunded',
        balance: balanceAfter,
        driverId: driverId || req.device.driverId,
        shuttleId: shuttleId || original.shuttleId,
        routeId: routeId || original.routeId,
        deviceTimestamp: deviceTimestamp || new Date().toISOString(),
        viewFor: 'treasury'
      });

      await transaction.save();

      console.log(`✅ Refund processed: +₱${fareAmount} (${transactionId})`);

      // Log the refund
      const { logEvent } = await import('../utils/logger.js');
      logEvent({
        eventType: 'refund',
        title: offlineMode ? 'Shuttle Refund (Offline)' : 'Shuttle Refund',
        description: `Refund of ₱${fareAmount} to ${user.fullName} (${user.schoolUId})`,
        severity: 'info',
        userId: user._id?.toString(),
        driverId,
        shuttleId,
        department: 'motorpool',
        targetEntity: 'transaction',
        metadata: {
          refundAmount: fareAmount,
          reason: reason || 'Offline refund processed',
          balanceBefore,
          balanceAfter,
          transactionId,
          offlineMode: true
        }
      }).catch(() => {});

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

        if (transaction.transactionType !== 'debit' || !transaction.shuttleId) {
          errors.push({ transactionId: txId, error: 'Only shuttle fares can be refunded here' });
          continue;
        }

        // Claim it atomically so two requests can't both refund it
        const claimed = await Transaction.findOneAndUpdate(
          { _id: transaction._id, status: 'Completed' },
          { $set: { status: 'Refunded' } },
          { new: true }
        );
        if (!claimed) {
          errors.push({ transactionId: txId, error: 'Already refunded' });
          continue;
        }

        // Find the user
        const user = await User.findById(transaction.userId);
        
        if (!user) {
          errors.push({ transactionId: txId, error: 'User not found' });
          continue;
        }

        // Atomic credit — refunds can race with taps on the same card
        const refundAmount = transaction.amount;
        const credited = await User.findByIdAndUpdate(user._id, { $inc: { balance: refundAmount } }, { new: true });
        const balanceAfter = credited.balance;
        const balanceBefore = balanceAfter - refundAmount;

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

    // Log bulk refund event
    if (refundResults.length > 0) {
      const { logEvent } = await import('../utils/logger.js');
      logEvent({
        eventType: 'refund',
        title: 'Shuttle Refund (Online)',
        description: `Refunded ${refundResults.length} transaction(s). Reason: ${reason || 'Route cancelled'}`,
        severity: 'info',
        department: 'motorpool',
        targetEntity: 'transaction',
        metadata: {
          refundedCount: refundResults.length,
          failedCount: errors.length,
          reason: reason || 'Route cancelled by driver',
          refundResults
        }
      }).catch(() => {});
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
router.post('/end-route', driverOnly, async (req, res) => {
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

    // Log route end
    const { logEvent } = await import('../utils/logger.js');
    logEvent({
      eventType: 'route_end',
      title: 'Route Ended',
      description: `Driver ${driverId} ended route on shuttle ${shuttleId}`,
      severity: 'info',
      driverId,
      shuttleId,
      tripId,
      department: 'motorpool',
      targetEntity: 'trip',
      metadata: {
        summary,
        shuttleReleased: true
      }
    }).catch(() => {});

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
router.post('/sync', driverOnly, async (req, res) => {
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

        // Fare is set by the server from the route, never by the device
        const fare = await resolveFare(tx.routeId);

        // Atomic debit with the negative-limit guard in the query itself
        const setting = await Setting.findOne();
        const negativeLimit = setting?.negativeLimit ?? -(fare - 1);

        const debited = await User.findOneAndUpdate(
          { _id: user._id, balance: { $gte: negativeLimit + fare } },
          { $inc: { balance: -fare } },
          { new: true }
        );

        if (!debited) {
          rejected.push({ rfidUId: tx.rfidUId, error: 'Insufficient balance' });
          continue;
        }

        const balanceAfter = debited.balance;

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
router.post('/updateLocation', driverOnly, async (req, res) => {
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
router.post('/geofenceEvent', driverOnly, async (req, res) => {
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
router.get('/cards', driverOrMerchant, async (req, res) => {
  try {
    console.log('📥 Downloading card data for offline cache...');

    // Get all active users with RFID cards - only essential fields
    const users = await User.find(
      {
        rfidUId: { $exists: true, $ne: null, $ne: '' },
        isActive: true
      },
      { rfidUId: 1, firstName: 1, lastName: 1, middleName: 1, balance: 1, isActive: 1, _id: 0 }
    ).lean();

    // Only what the phone uses to accept taps offline: card, name, balance, active
    const usersWithFullName = users.map(user => ({
      rfidUId: user.rfidUId,
      fullName: `${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}`.trim(),
      balance: user.balance,
      isActive: user.isActive
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
router.get('/cards/updated', driverOrMerchant, async (req, res) => {
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
      { rfidUId: 1, firstName: 1, lastName: 1, middleName: 1, balance: 1, isActive: 1, _id: 0 }
    ).lean();

    console.log(`✅ Sending ${users.length} updated card records`);

    res.json({
      success: true,
      count: users.length,
      cards: users.map(user => ({
        rfidUId: user.rfidUId,
        fullName: `${user.firstName} ${user.middleName ? user.middleName + ' ' : ''}${user.lastName}`.trim(),
        balance: user.balance,
        isActive: user.isActive
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Updated cards download error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;