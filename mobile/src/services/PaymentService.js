// src/services/PaymentService.js
// FIXED:
// 1. Now accepts fareAmount parameter from route instead of hardcoding 15
// 2. Passes fareAmount to backend API
// 3. OFFLINE MODE: Now looks up user names from cached card data

import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OfflineStorageService from './OfflineStorageService';
import NetworkService from './NetworkService';

const DEVICE_ID = 'SHUTTLE_01';
const DEFAULT_FARE = 15; // Fallback if no fare specified

const PaymentService = {
  // Check network connectivity - improved version
  async isOnline() {
    try {
      // Try multiple endpoints for better reliability
      const endpoints = ['/system/config', '/health', '/api/health'];
      
      for (const endpoint of endpoints) {
        try {
          const response = await api.get(endpoint, { 
            timeout: 3000,
            validateStatus: (status) => status < 500
          });
          
          if (response.status < 500) {
            return true;
          }
        } catch (err) {
          continue; // Try next endpoint
        }
      }
      
      return false;
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

    // Validate student status first
    const statusValidation = await this.validateStudentStatus(rfidUId);
    
    // Ensure we always have a validation result
    if (!statusValidation) {
      return {
        success: false,
        error: {
          message: 'Student validation failed',
          code: 'VALIDATION_ERROR'
        },
        transactionType: 'refund'
      };
    }
    
    if (!statusValidation.valid) {
      return {
        success: false,
        error: {
          message: statusValidation.reason,
          code: statusValidation.code
        },
        transactionType: 'refund'
      };
    }

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
        },
        transactionType: 'refund'
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
      if (res.data) {
        // Handle different response structures
        let userData;
        
        if (res.data.user) {
          // Refund API response structure
          userData = {
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
            isActive: res.data.user?.isActive,
            isDeactivated: res.data.user?.isDeactivated,
            cachedAt: new Date().toISOString()
          };
        } else {
          // Balance API response structure
          userData = {
            rfidUId,
            fullName: res.data.name || 'Unknown Student',
            balance: res.data.balance || 0,
            isActive: res.data.isActive,
            isDeactivated: !res.data.isActive,
            cachedAt: new Date().toISOString()
          };
        }

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
  // STUDENT STATUS VALIDATION
  // ============================================================
  async validateStudentStatus(rfidUId) {
    try {
      // Try to get user data from server first (online)
      const res = await api.get(`/user/balance/${rfidUId}`);
      
      if (res.data) {
        // Handle the actual API response structure
        const user = {
          fullName: res.data.name || 'Unknown Student',
          balance: res.data.balance || 0,
          isActive: res.data.isActive,
          isDeactivated: !res.data.isActive, // If not active, consider deactivated
          rfidUId: rfidUId
        };
        
        // Check if student is active and not deactivated
        if (!user.isActive) {
          return {
            valid: false,
            reason: 'Student account is not active',
            code: 'INACTIVE_ACCOUNT'
          };
        }
        
        if (user.isDeactivated) {
          return {
            valid: false,
            reason: 'Student account is deactivated',
            code: 'DEACTIVATED_ACCOUNT'
          };
        }
        
        return {
          valid: true,
          user: user
        };
      }
      
      // No user data found - card not recognized
      return {
        valid: false,
        reason: 'Card not recognized',
        code: 'CARD_NOT_RECOGNIZED'
      };
    } catch (error) {
      console.log('🔄 Student status validation error:', error.message);
      
      // If it's a 404 or similar error, card is not recognized
      if (error.response && (error.response.status === 404 || error.response.status === 400)) {
        return {
          valid: false,
          reason: 'Card not recognized',
          code: 'CARD_NOT_RECOGNIZED'
        };
      }
      
      // If we can't reach server, check cached data for offline validation
      console.log('🔄 Server unreachable, checking cached student status...');
      const cachedCard = await OfflineStorageService.lookupCard(rfidUId);
      
      if (cachedCard) {
        // Only allow offline payments for cached, verified users
        if (cachedCard.isActive === false) {
          return {
            valid: false,
            reason: 'Student account is not active (cached)',
            code: 'INACTIVE_ACCOUNT'
          };
        }
        
        if (cachedCard.isDeactivated === true) {
          return {
            valid: false,
            reason: 'Student account is deactivated (cached)',
            code: 'DEACTIVATED_ACCOUNT'
          };
        }
        
        // Only allow if we have reliable cached user data (verified student)
        if (cachedCard.fullName && cachedCard.fullName !== 'Unknown Student') {
          console.log('✅ Cached student data found:', cachedCard.fullName);
          return {
            valid: true,
            offlineMode: true,
            user: cachedCard
          };
        } else {
          return {
            valid: false,
            reason: 'Invalid cached student data',
            code: 'INVALID_CACHE_DATA'
          };
        }
      }
      
      // No cached data available - reject unknown cards for security
      console.log('❌ No cached data for card - rejecting offline payment');
      return {
        valid: false,
        reason: 'Student not recognized. Please connect to internet to verify this card.',
        code: 'CARD_NOT_CACHED'
      };
    }
  },

  // ============================================================
  // USER DATA MANAGEMENT
  // ============================================================
  
  // Cache all active users for offline mode
  async cacheAllActiveUsers() {
    try {
      console.log('🔄 Caching all active users for offline mode...');
      const res = await api.get('/shuttle/cards'); // Use existing endpoint
      
      if (res.data && res.data.cards && Array.isArray(res.data.cards)) {
        const cachePromises = res.data.cards.map(user => {
          const userData = {
            rfidUId: user.rfidUId,
            fullName: user.fullName,
            balance: user.balance || 0,
            isActive: user.isActive,
            isDeactivated: !user.isActive,
            schoolUId: user.schoolUId,
            userType: user.userType,
            cachedAt: new Date().toISOString()
          };
          return OfflineStorageService.cacheCardData(userData);
        });
        
        await Promise.all(cachePromises);
        console.log(`✅ Cached ${res.data.cards.length} active users for offline mode`);
        return res.data.cards.length;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Failed to cache active users:', error.message);
      return 0;
    }
  },

  async fetchAndCacheUserData(rfidUId) {
    try {
      // Try to get user data from server
      const res = await api.get(`/user/balance/${rfidUId}`);
      
      if (res.data) {
        // Handle the actual API response structure
        const userData = {
          rfidUId,
          fullName: res.data.name || 'Unknown Student',
          balance: res.data.balance || 0,
          isActive: res.data.isActive,
          isDeactivated: !res.data.isActive, // If not active, consider deactivated
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
    // Use NetworkService for faster offline detection
    const isOnline = NetworkService.isConnected;
    const fare = fareAmount || DEFAULT_FARE;

    console.log('💳 Processing fare:', fare, 'for route:', routeId, 'network:', isOnline ? 'online' : 'offline');

    // Validate student status first
    const statusValidation = await this.validateStudentStatus(rfidUId);
    
    // Ensure we always have a validation result
    if (!statusValidation) {
      return {
        success: false,
        error: {
          message: 'Student validation failed',
          code: 'VALIDATION_ERROR'
        }
      };
    }
    
    if (!statusValidation.valid) {
      return {
        success: false,
        error: {
          message: statusValidation.reason,
          code: statusValidation.code
        }
      };
    }

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
        // Handle different response structures
        let userData;
        
        if (res.data.user) {
          // Payment API response structure
          userData = {
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
            isActive: res.data.user?.isActive,
            isDeactivated: res.data.user?.isDeactivated,
            cachedAt: new Date().toISOString()
          };
        } else {
          // Balance API response structure
          userData = {
            rfidUId,
            fullName: res.data.name || 'Unknown Student',
            balance: res.data.balance || 0,
            isActive: res.data.isActive,
            isDeactivated: !res.data.isActive,
            cachedAt: new Date().toISOString()
          };
        }

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
    // Prevent multiple simultaneous syncs
    if (this._syncInProgress) {
      console.log('⏭️ Sync already in progress, skipping duplicate call');
      return { success: false, processed: 0, failed: 0, remaining: 0, skipped: true };
    }

    this._syncInProgress = true;
    
    try {
      const queue = await this.getOfflineQueue();
      
      if (queue.length === 0) {
        console.log('✅ No offline transactions to sync');
        this._syncInProgress = false;
        return { success: true, processed: 0, failed: 0, remaining: 0 };
      }

      console.log(`🔄 Syncing ${queue.length} offline transactions...`);
      
      let processed = 0;
      let failed = 0;
      const failedTransactions = [];

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
              reason: transaction.reason || 'Refund requested',
              deviceTimestamp: transaction.timestamp,
              offlineMode: true
            });
          } else {
            // Process payment
            console.log('🔍 Transaction data being sent:', JSON.stringify(transaction, null, 2));
            res = await api.post('/shuttle/pay', {
              rfidUId: transaction.rfidUId,
              driverId: transaction.driverId,
              shuttleId: transaction.shuttleId,
              routeId: transaction.routeId,
              tripId: transaction.tripId,
              fareAmount: transaction.fareAmount,
              deviceTimestamp: transaction.timestamp,
              offlineMode: true
            });
          }

          console.log('🔍 Server response:', JSON.stringify(res, null, 2));
          
          // Handle axios response structure (res.data contains actual response)
          const responseData = res.data || res;
          
          if (responseData.success) {
            processed++;
            console.log(`✅ Synced transaction for ${transaction.studentName || transaction.rfidUId}`);
            
            // Mark this transaction as synced to prevent duplicate processing
            transaction.synced = true;
            transaction.syncedAt = Date.now();
            
            // Track offline transaction for duplicate detection
            await OfflineStorageService.addOfflineTransaction({
              rfidUId: transaction.rfidUId,
              studentName: transaction.studentName,
              timestamp: transaction.timestamp,
              syncedAt: Date.now()
            });
          } else {
            failed++;
            failedTransactions.push(transaction);
            console.error(`❌ Failed to sync transaction for ${transaction.studentName || transaction.rfidUId}:`, responseData?.error || responseData?.message || 'Unknown error');
          }
        } catch (error) {
          failed++;
          failedTransactions.push(transaction);
          console.error(`❌ Error syncing transaction for ${transaction.studentName || transaction.rfidUId}:`, error.message);
          
          // If it's a network error, stop trying and wait for next sync
          if (error.message.includes('Network') || error.message.includes('timeout')) {
            console.log('⚠️ Network error during sync, will retry later');
            break;
          }
        }
      }

      // Update queue: remove successful transactions, keep failed ones for retry
      if (processed > 0) {
        if (failedTransactions.length > 0) {
          // Keep only failed transactions for next retry
          await AsyncStorage.setItem('offlineQueue', JSON.stringify(failedTransactions));
          console.log(`🔄 Kept ${failedTransactions.length} failed transactions for retry`);
        } else {
          // All transactions succeeded, clear the queue
          await this.clearOfflineQueue();
          console.log(`🗑️ Cleared offline queue after syncing all ${processed} transactions`);
        }
      }

      console.log(`✅ Sync completed: ${processed} processed, ${failed} failed`);
      
      return {
        success: processed > 0,
        processed,
        failed,
        remaining: failedTransactions.length
      };
    } catch (error) {
      console.error('❌ Error syncing offline transactions:', error);
      return {
        success: false,
        processed: 0,
        failed: queue.length,
        remaining: queue.length,
        error: error.message
      };
    } finally {
      // Always reset the sync flag
      this._syncInProgress = false;
    }
  },

  // Legacy alias (some code might use syncOfflinePayments)
  async syncOfflinePayments() {
    return this.syncOfflineQueue();
  }
};

export default PaymentService;