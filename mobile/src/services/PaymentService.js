// src/services/PaymentService.js
// FIXED:
// 1. Now accepts fareAmount parameter from route instead of hardcoding 15
// 2. Passes fareAmount to backend API
// 3. OFFLINE MODE: Now looks up user names from cached card data

import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineStorageService from './OfflineStorageService';

const DEVICE_ID = 'SHUTTLE_01';
const DEFAULT_FARE = 15; // Fallback if no fare specified

const PaymentService = {
  // Check network connectivity
  async isOnline() {
    try {
      const response = await api.get('/system/config', { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  // ============================================================
  // PROCESS FARE - Called by PaymentScreen.js handleScan()
  // FIXED: Now accepts fareAmount parameter
  // ============================================================
  async processFare(rfidUId, driverId, shuttleId, routeId, tripId, fareAmount = DEFAULT_FARE) {
    const isOnline = await this.isOnline();
    const fare = fareAmount || DEFAULT_FARE;

    console.log('💳 Processing fare:', fare, 'for route:', routeId);

    // Check for recent offline transactions (duplicate detection)
    const recentCheck = await OfflineStorageService.hasRecentTransaction(rfidUId, 5); // 5-minute window
    if (recentCheck.hasRecent) {
      const studentName = recentCheck.transaction.studentName || 'Student';
      return {
        success: false,
        error: {
          message: `${studentName} already scanned their ID ${recentCheck.timeAgo} seconds ago`,
          code: 'DUPLICATE_SCAN',
          studentName: studentName,
          timeAgo: recentCheck.timeAgo
        }
      };
    }

    if (!isOnline) {
      // Look up user from cached card data
      const cachedCard = await OfflineStorageService.lookupCard(rfidUId);
      const studentName = cachedCard?.fullName || 'Unknown Student';
      const cachedBalance = cachedCard?.balance ?? 0;

      // Create offline transaction record
      const offlineTransaction = {
        rfidUId,
        driverId,
        shuttleId: shuttleId || DEVICE_ID,
        routeId,
        tripId,
        fareAmount: fare,
        studentName: studentName,
        timestamp: new Date().toISOString(),
        mode: 'offline'
      };

      // Add to offline transactions for duplicate detection
      await OfflineStorageService.addOfflineTransaction(offlineTransaction);

      // Buffer transaction for later sync
      await this.bufferOfflineTransaction(offlineTransaction);

      console.log('📦 Offline payment for:', studentName, '- ₱', fare);

      return {
        success: true,
        mode: 'offline',
        offlineMode: true,
        data: {
          studentName: studentName,
          fareAmount: fare,
          previousBalance: cachedBalance,
          newBalance: cachedBalance - fare, // Estimated balance
          isEstimated: true // Flag to indicate this is estimated
        }
      };
    }

    try {
      // FIXED: Pass fareAmount to backend
      const res = await api.post('/shuttle/pay', {
        rfidUId,
        driverId,
        shuttleId: shuttleId || DEVICE_ID,
        routeId,
        tripId,
        fareAmount: fare,  // NEW: Pass fare amount
        deviceId: DEVICE_ID,
        timestamp: new Date().toISOString()
      });

      // Cache user card data for offline use
      if (res.data && res.data.user) {
        await OfflineStorageService.cacheCardData({
          rfidUId,
          fullName: res.data.user.fullName || res.data.user.firstName + ' ' + res.data.user.lastName,
          balance: res.data.newBalance || res.data.balance,
          schoolUId: res.data.user.schoolUId,
          email: res.data.user.email
        });
      }

      return { 
        success: true, 
        mode: 'online',
        offlineMode: false,
        data: res.data,
        transactionId: res.data?.transactionId
      };
    } catch (e) {
      console.error('💥 Payment API error:', e.message);

      // Check if it's a server error with response (400, 500, etc.)
      if (e.response && e.response.data) {
        const errorMessage = e.response.data.error || e.response.data.message || 'Payment failed';
        console.error('📛 Server error:', errorMessage);

        return {
          success: false,
          error: e.response.data,
          message: errorMessage
        };
      }

      // Network error - buffer for offline with cached user data
      const cachedCard = await OfflineStorageService.lookupCard(rfidUId);
      const studentName = cachedCard?.fullName || 'Unknown Student';
      const cachedBalance = cachedCard?.balance ?? 0;

      await this.bufferOfflineTransaction({
        rfidUId,
        driverId,
        shuttleId: shuttleId || DEVICE_ID,
        routeId,
        tripId,
        fareAmount: fare,
        studentName: studentName,
        timestamp: new Date().toISOString()
      });

      console.log('📦 Network error - Offline payment for:', studentName, '- ₱', fare);

      return {
        success: true,
        mode: 'offline',
        offlineMode: true,
        data: {
          studentName: studentName,
          fareAmount: fare,
          previousBalance: cachedBalance,
          newBalance: cachedBalance - fare,
          isEstimated: true
        }
      };
    }
  },

  // Legacy alias for processPayment (some code might still use this)
  async processPayment(params) {
    const { rfidUId, driverId, shuttleId, routeId, tripId, fareAmount } = params;
    return this.processFare(rfidUId, driverId, shuttleId, routeId, tripId, fareAmount);
  },

  // ============================================================
  // MERCHANT PAYMENT - For merchant mode
  // ============================================================
  async processMerchantPayment(rfidUId, amount, merchantId, pin) {
    try {
      const res = await api.post('/merchant/pay', {
        rfidUId,
        amount,
        merchantId,
        pin,
        deviceId: DEVICE_ID,
        timestamp: new Date().toISOString()
      });

      return { success: true, data: res.data };
    } catch (e) {
      if (e.response) {
        return { success: false, error: e.response.data };
      }
      return { success: false, error: { message: 'Network error' } };
    }
  },

  // ============================================================
  // OFFLINE QUEUE MANAGEMENT
  // ============================================================
  async bufferOfflineTransaction(transaction) {
    const raw = await AsyncStorage.getItem('offlineQueue');
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(transaction);
    await AsyncStorage.setItem('offlineQueue', JSON.stringify(queue));
    console.log('📦 Buffered offline transaction. Queue size:', queue.length);
  },

  async getOfflineQueue() {
    const raw = await AsyncStorage.getItem('offlineQueue');
    return raw ? JSON.parse(raw) : [];
  },

  async getOfflineQueueCount() {
    const queue = await this.getOfflineQueue();
    return queue.length;
  },

  async clearOfflineQueue() {
    await AsyncStorage.removeItem('offlineQueue');
    console.log('🗑️ Offline queue cleared');
  },

  // ============================================================
  // SYNC OFFLINE QUEUE - Called by PaymentScreen.js and BackgroundSync.js
  // This syncs all buffered offline transactions to the server
  // ============================================================
  async syncOfflineQueue() {
    const queue = await this.getOfflineQueue();
    
    if (!queue.length) {
      console.log('✅ No offline transactions to sync');
      return { success: true, processed: 0 };
    }

    console.log(`🔄 Syncing ${queue.length} offline transactions...`);

    let processed = 0;
    let failed = 0;

    for (const transaction of queue) {
      try {
        console.log(`📤 Syncing transaction for ${transaction.studentName || transaction.rfidUId}`);
        
        // Send transaction to server
        const res = await api.post('/shuttle/pay', {
          rfidUId: transaction.rfidUId,
          driverId: transaction.driverId,
          shuttleId: transaction.shuttleId,
          routeId: transaction.routeId,
          tripId: transaction.tripId,
          fareAmount: transaction.fareAmount,
          deviceId: DEVICE_ID,
          timestamp: transaction.timestamp,
          isOfflineSync: true // Flag to indicate this is an offline sync
        });

        // Cache user data if returned
        if (res.data && res.data.user) {
          await OfflineStorageService.cacheCardData({
            rfidUId: transaction.rfidUId,
            fullName: res.data.user.fullName || res.data.user.firstName + ' ' + res.data.user.lastName,
            balance: res.data.newBalance || res.data.balance,
            schoolUId: res.data.user.schoolUId,
            email: res.data.user.email
          });
        }

        processed++;
        console.log(`✅ Synced transaction for ${transaction.studentName || transaction.rfidUId}`);
        
      } catch (error) {
        failed++;
        console.error(`❌ Failed to sync transaction for ${transaction.studentName || transaction.rfidUId}:`, error.message);
        
        // If it's a server error (4xx), don't retry this transaction
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          console.log(`⚠️ Skipping failed transaction (server error): ${transaction.rfidUId}`);
        }
      }
    }

    // Clear the queue after processing
    if (processed > 0) {
      await this.clearOfflineQueue();
      console.log(`🗑️ Cleared offline queue after syncing ${processed} transactions`);
    }

    // Clear offline transaction records (for duplicate detection)
    await OfflineStorageService.clearOfflineTransactions();

    return {
      success: true,
      processed,
      failed,
      total: queue.length
    };
  },

  // Legacy alias (some code might use syncOfflinePayments)
  async syncOfflinePayments() {
    return this.syncOfflineQueue();
  }
};

export default PaymentService;