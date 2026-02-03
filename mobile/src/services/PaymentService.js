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
  // PROCESS REFUND - Handle refunds (online and offline)
  // ============================================================
  async processRefund(rfidUId, driverId, shuttleId, routeId, tripId, fareAmount, reason = 'Refund requested') {
    const isOnline = await this.isOnline();
    
    console.log('💸 Processing refund: ₱', fareAmount, 'for:', rfidUId);

    // Check for recent offline transactions (duplicate detection)
    const recentCheck = await OfflineStorageService.hasRecentTransaction(rfidUId, 5);
    if (recentCheck.hasRecent) {
      const studentName = recentCheck.transaction.studentName || 'Student';
      return {
        success: false,
        error: {
          message: `${studentName} already has a recent transaction. Refund not processed.`,
          code: 'RECENT_TRANSACTION',
          studentName: studentName,
          timeAgo: recentCheck.timeAgo
        }
      };
    }

    if (!isOnline) {
      // Look up user from cached card data
      let cachedCard = await OfflineStorageService.lookupCard(rfidUId);
      let studentName = cachedCard?.fullName || 'Unknown Student';
      let cachedBalance = cachedCard?.balance ?? 0;

      // If we don't have cached data, try to fetch it
      if (!cachedCard && studentName === 'Unknown Student') {
        console.log('🔄 No cached data for refund, attempting to fetch user data...');
        const userData = await this.fetchAndCacheUserData(rfidUId);
        if (userData) {
          studentName = userData.fullName;
          cachedBalance = userData.balance;
          cachedCard = userData;
        }
      }

      // Create offline refund record
      const offlineRefund = {
        rfidUId,
        driverId,
        shuttleId: shuttleId || DEVICE_ID,
        routeId,
        tripId,
        fareAmount: fareAmount,
        studentName: studentName,
        timestamp: new Date().toISOString(),
        mode: 'offline',
        type: 'refund',
        reason: reason,
        previousBalance: cachedBalance,
        estimatedNewBalance: cachedBalance + fareAmount
      };

      // Add to offline transactions for duplicate detection
      await OfflineStorageService.addOfflineTransaction(offlineRefund);

      // Buffer refund for later sync
      await this.bufferOfflineTransaction(offlineRefund);

      console.log('📦 Offline refund for:', studentName, '+ ₱', fareAmount);

      return {
        success: true,
        mode: 'offline',
        offlineMode: true,
        data: {
          studentName: studentName,
          fareAmount: fareAmount,
          previousBalance: cachedBalance,
          newBalance: cachedBalance + fareAmount,
          isEstimated: true,
          transactionType: 'refund',
          reason: reason
        }
      };
    }

    try {
      // Process refund online
      const res = await api.post('/shuttle/refund', {
        rfidUId,
        driverId,
        shuttleId: shuttleId || DEVICE_ID,
        routeId,
        tripId,
        fareAmount: fareAmount,
        deviceId: DEVICE_ID,
        timestamp: new Date().toISOString(),
        reason: reason
      });

      // Cache user data if returned
      if (res.data && res.data.user) {
        const userData = {
          rfidUId,
          fullName: res.data.user?.fullName || 
                   (res.data.user?.firstName && res.data.user?.lastName ? 
                    `${res.data.user.firstName} ${res.data.user.lastName}` : 'Unknown Student'),
          firstName: res.data.user?.firstName,
          lastName: res.data.user?.lastName,
          balance: res.data.newBalance || res.data.balance || 0,
          schoolUId: res.data.user?.schoolUId,
          email: res.data.user?.email,
          studentId: res.data.user?.studentId,
          cachedAt: new Date().toISOString()
        };

        await OfflineStorageService.cacheCardData(userData);
        console.log('✅ Cached user data after refund:', userData.fullName);
      }

      return { 
        success: true, 
        mode: 'online',
        offlineMode: false,
        data: res.data,
        transactionId: res.data?.transactionId,
        transactionType: 'refund'
      };
    } catch (e) {
      console.error('💥 Refund API error:', e.message);

      if (e.response && e.response.data) {
        return {
          success: false,
          error: e.response.data,
          transactionType: 'refund'
        };
      }
      
      return {
        success: false,
        error: { message: 'Network error during refund' },
        transactionType: 'refund'
      };
    }
  },

  // ============================================================
  // USER DATA MANAGEMENT
  // ============================================================
  async fetchAndCacheUserData(rfidUId) {
    try {
      // Try to get user data from server
      const res = await api.get(`/user/balance/${rfidUId}`);
      
      if (res.data && res.data.user) {
        const userData = {
          rfidUId,
          fullName: res.data.user?.fullName || 
                   (res.data.user?.firstName && res.data.user?.lastName ? 
                    `${res.data.user.firstName} ${res.data.user.lastName}` : 'Unknown Student'),
          firstName: res.data.user?.firstName,
          lastName: res.data.user?.lastName,
          balance: res.data.balance || 0,
          schoolUId: res.data.user?.schoolUId,
          email: res.data.user?.email,
          studentId: res.data.user?.studentId,
          cachedAt: new Date().toISOString()
        };

        await OfflineStorageService.cacheCardData(userData);
        console.log('✅ Fetched and cached user data:', userData.fullName);
        return userData;
      }
    } catch (error) {
      console.error('❌ Failed to fetch user data:', error.message);
    }
    
    return null;
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
      let cachedCard = await OfflineStorageService.lookupCard(rfidUId);
      let studentName = cachedCard?.fullName || 'Unknown Student';
      let cachedBalance = cachedCard?.balance ?? 0;

      // If we don't have cached data and we're actually online (network detection failed), try to fetch it
      if (!cachedCard && studentName === 'Unknown Student') {
        console.log('🔄 No cached data, attempting to fetch user data...');
        const userData = await this.fetchAndCacheUserData(rfidUId);
        if (userData) {
          studentName = userData.fullName;
          cachedBalance = userData.balance;
          cachedCard = userData;
        }
      }

      // Check if user has sufficient balance (allow negative for offline but warn)
      const hasSufficientBalance = cachedBalance >= fare;
      
      if (!hasSufficientBalance && cachedBalance > -1000) { // Allow some negative but not too much
        console.warn(`⚠️ Low balance warning: ₱${cachedBalance} (fare: ₱${fare})`);
      }

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
        mode: 'offline',
        previousBalance: cachedBalance,
        estimatedNewBalance: cachedBalance - fare
      };

      // Add to offline transactions for duplicate detection
      await OfflineStorageService.addOfflineTransaction(offlineTransaction);

      // Buffer transaction for later sync
      await this.bufferOfflineTransaction(offlineTransaction);

      console.log('📦 Offline payment for:', studentName, '- ₱', fare, '(Balance: ₱' + cachedBalance + ')');

      return {
        success: true,
        mode: 'offline',
        offlineMode: true,
        data: {
          studentName: studentName,
          fareAmount: fare,
          previousBalance: cachedBalance,
          newBalance: cachedBalance - fare, // Estimated balance
          isEstimated: true, // Flag to indicate this is estimated
          balanceWarning: !hasSufficientBalance
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

      // Cache user card data for offline use (more comprehensive)
      if (res.data) {
        const userData = {
          rfidUId,
          fullName: res.data.user?.fullName || 
                   (res.data.user?.firstName && res.data.user?.lastName ? 
                    `${res.data.user.firstName} ${res.data.user.lastName}` : 'Unknown Student'),
          firstName: res.data.user?.firstName,
          lastName: res.data.user?.lastName,
          balance: res.data.newBalance || res.data.balance || 0,
          schoolUId: res.data.user?.schoolUId,
          email: res.data.user?.email,
          studentId: res.data.user?.studentId,
          cachedAt: new Date().toISOString()
        };

        await OfflineStorageService.cacheCardData(userData);
        console.log('✅ Cached user data for offline use:', userData.fullName);
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
        
        let res;
        
        // Handle different transaction types
        if (transaction.type === 'refund') {
          // Process refund
          res = await api.post('/shuttle/refund', {
            rfidUId: transaction.rfidUId,
            driverId: transaction.driverId,
            shuttleId: transaction.shuttleId,
            routeId: transaction.routeId,
            tripId: transaction.tripId,
            fareAmount: transaction.fareAmount,
            deviceId: DEVICE_ID,
            timestamp: transaction.timestamp,
            reason: transaction.reason || 'Offline refund',
            isOfflineSync: true
          });
        } else {
          // Process payment
          res = await api.post('/shuttle/pay', {
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
        }

        // Cache user data if returned
        if (res.data && res.data.user) {
          await OfflineStorageService.cacheCardData({
            rfidUId: transaction.rfidUId,
            fullName: res.data.user?.fullName || 
                     (res.data.user?.firstName && res.data.user?.lastName ? 
                      `${res.data.user.firstName} ${res.data.user.lastName}` : 'Unknown Student'),
            balance: res.data.newBalance || res.data.balance,
            schoolUId: res.data.user?.schoolUId,
            email: res.data.user?.email
          });
        }

        processed++;
        console.log(`✅ Synced ${transaction.type || 'payment'} for ${transaction.studentName || transaction.rfidUId}`);
        
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