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

    if (!isOnline) {
      // Look up user from cached card data
      const cachedCard = await OfflineStorageService.lookupCard(rfidUId);
      const studentName = cachedCard?.fullName || 'Unknown Student';
      const cachedBalance = cachedCard?.balance ?? 0;

      // Buffer transaction for later sync
      await this.bufferOfflineTransaction({
        rfidUId,
        driverId,
        shuttleId: shuttleId || DEVICE_ID,
        routeId,
        tripId,
        fareAmount: fare,
        studentName: studentName, // Store name for reference
        timestamp: new Date().toISOString()
      });

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
      return { success: true, processed: 0, count: 0 };
    }

    console.log('🔄 Syncing', queue.length, 'offline transactions...');

    try {
      const res = await api.post('/shuttle/sync', {
        deviceId: DEVICE_ID,
        transactions: queue
      });

      if (res.data) {
        await this.clearOfflineQueue();
        console.log('✅ Sync complete:', res.data);
        return { 
          success: true, 
          processed: res.data.processed || queue.length,
          rejected: res.data.rejected || [],
          count: res.data.processed || queue.length
        };
      }
      
      return { success: false, error: 'No response from server' };
    } catch (e) {
      console.error('❌ Sync failed:', e);
      return {
        success: false,
        error: e.response?.data || e.message
      };
    }
  },

  // Legacy alias (some code might use syncOfflinePayments)
  async syncOfflinePayments() {
    return this.syncOfflineQueue();
  }
};

export default PaymentService;