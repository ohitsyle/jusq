// src/services/OfflineStorageService.js
// Enhanced offline storage service with automatic data caching and sync
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ROUTES: 'cached_routes',
  SHUTTLES: 'cached_shuttles',
  USER_SESSION: 'user_session',
  OFFLINE_QUEUE: 'offlineQueue',
  LAST_SYNC: 'last_sync_timestamp',
  SHUTTLE_POSITIONS: 'cached_shuttle_positions',
  TRIP_DATA: 'active_trip_data',
  MERCHANT_DATA: 'merchant_session_data',
  SETTINGS: 'system_settings',
  CACHED_CARDS: 'cached_cards', // Cache user card data for offline use
  OFFLINE_TRANSACTIONS: 'offline_transactions' // Track offline transactions for duplicate detection
};

const OfflineStorageService = {
  // ============================================================
  // ROUTES CACHING
  // ============================================================
  async cacheRoutes(routes) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify({
        data: routes,
        timestamp: Date.now()
      }));
      console.log('✅ Cached', routes.length, 'routes');
    } catch (error) {
      console.error('❌ Failed to cache routes:', error);
    }
  },

  async getCachedRoutes() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.ROUTES);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        console.log('📦 Retrieved', data.length, 'cached routes from', new Date(timestamp).toLocaleString());
        return data;
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to get cached routes:', error);
      return [];
    }
  },

  // ============================================================
  // SHUTTLES CACHING
  // ============================================================
  async cacheShuttles(shuttles) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHUTTLES, JSON.stringify({
        data: shuttles,
        timestamp: Date.now()
      }));
      console.log('✅ Cached', shuttles.length, 'shuttles');
    } catch (error) {
      console.error('❌ Failed to cache shuttles:', error);
    }
  },

  async getCachedShuttles() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.SHUTTLES);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        console.log('📦 Retrieved', data.length, 'cached shuttles from', new Date(timestamp).toLocaleString());
        return data;
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to get cached shuttles:', error);
      return [];
    }
  },

  // ============================================================
  // USERS CACHING
  // ============================================================
  async cacheUsers(users) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_CARDS, JSON.stringify({
        data: users,
        timestamp: Date.now()
      }));
      console.log('✅ Cached', users.length, 'active users for offline payments');
    } catch (error) {
      console.error('❌ Failed to cache users:', error);
    }
  },

  async getCachedUsers() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_CARDS);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        console.log('📦 Retrieved', data.length, 'cached users from', new Date(timestamp).toLocaleString());
        return data;
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to get cached users:', error);
      return [];
    }
  },

  // ============================================================
  // USER SESSION MANAGEMENT
  // ============================================================
  async saveUserSession(userData) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify({
        ...userData,
        savedAt: Date.now()
      }));
      console.log('✅ User session saved');
    } catch (error) {
      console.error('❌ Failed to save user session:', error);
    }
  },

  async getUserSession() {
    try {
      const session = await AsyncStorage.getItem(STORAGE_KEYS.USER_SESSION);
      if (session) {
        return JSON.parse(session);
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get user session:', error);
      return null;
    }
  },

  async clearUserSession() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION);
      console.log('🗑️ User session cleared');
    } catch (error) {
      console.error('❌ Failed to clear user session:', error);
    }
  },

  // ============================================================
  // TRIP DATA PERSISTENCE (for driver sessions)
  // ============================================================
  async saveTripData(tripData) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TRIP_DATA, JSON.stringify({
        ...tripData,
        savedAt: Date.now()
      }));
      console.log('✅ Trip data saved');
    } catch (error) {
      console.error('❌ Failed to save trip data:', error);
    }
  },

  async getTripData() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TRIP_DATA);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get trip data:', error);
      return null;
    }
  },

  async clearTripData() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TRIP_DATA);
      console.log('🗑️ Trip data cleared');
    } catch (error) {
      console.error('❌ Failed to clear trip data:', error);
    }
  },

  // ============================================================
  // MERCHANT SESSION DATA
  // ============================================================
  async saveMerchantData(merchantData) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MERCHANT_DATA, JSON.stringify({
        ...merchantData,
        savedAt: Date.now()
      }));
      console.log('✅ Merchant data saved');
    } catch (error) {
      console.error('❌ Failed to save merchant data:', error);
    }
  },

  async getMerchantData() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.MERCHANT_DATA);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get merchant data:', error);
      return null;
    }
  },

  // ============================================================
  // SYSTEM SETTINGS CACHE
  // ============================================================
  async cacheSettings(settings) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
        data: settings,
        timestamp: Date.now()
      }));
      console.log('✅ Settings cached');
    } catch (error) {
      console.error('❌ Failed to cache settings:', error);
    }
  },

  async getCachedSettings() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (cached) {
        const { data } = JSON.parse(cached);
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get cached settings:', error);
      return null;
    }
  },

  // ============================================================
  // SHUTTLE POSITIONS CACHE (for offline map viewing)
  // ============================================================
  async cacheShuttlePositions(positions) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHUTTLE_POSITIONS, JSON.stringify({
        data: positions,
        timestamp: Date.now()
      }));
      console.log('✅ Cached shuttle positions');
    } catch (error) {
      console.error('❌ Failed to cache shuttle positions:', error);
    }
  },

  async getCachedShuttlePositions() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.SHUTTLE_POSITIONS);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        console.log('📦 Retrieved cached shuttle positions from', new Date(timestamp).toLocaleString());
        return data;
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to get cached shuttle positions:', error);
      return [];
    }
  },

  // ============================================================
  // SYNC TIMESTAMP TRACKING
  // ============================================================
  async updateLastSyncTime() {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error('❌ Failed to update last sync time:', error);
    }
  },

  async getLastSyncTime() {
    try {
      const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      if (timestamp) {
        return parseInt(timestamp, 10);
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get last sync time:', error);
      return null;
    }
  },

  async getTimeSinceLastSync() {
    const lastSync = await this.getLastSyncTime();
    if (!lastSync) return null;

    const secondsAgo = Math.floor((Date.now() - lastSync) / 1000);

    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    return `${Math.floor(secondsAgo / 86400)}d ago`;
  },

  // ============================================================
  // CLEAR ALL CACHE (useful for logout)
  // ============================================================
  async clearAllCache() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ROUTES,
        STORAGE_KEYS.SHUTTLES,
        STORAGE_KEYS.USER_SESSION,
        STORAGE_KEYS.SHUTTLE_POSITIONS,
        STORAGE_KEYS.TRIP_DATA,
        STORAGE_KEYS.MERCHANT_DATA,
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.LAST_SYNC
      ]);
      console.log('🗑️ All cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear all cache:', error);
    }
  },

  // ============================================================
  // GET STORAGE STATISTICS
  // ============================================================
  async getStorageStats() {
    try {
      const keys = [
        STORAGE_KEYS.ROUTES,
        STORAGE_KEYS.SHUTTLES,
        STORAGE_KEYS.USER_SESSION,
        STORAGE_KEYS.OFFLINE_QUEUE,
        STORAGE_KEYS.CACHED_CARDS,
        STORAGE_KEYS.OFFLINE_TRANSACTIONS
      ];

      const stats = {};
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        stats[key] = value ? JSON.parse(value).length || 0 : 0;
      }

      return stats;
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return {};
    }
  },

  // ============================================================
  // CARD CACHING (for offline duplicate detection)
  // ============================================================
  async cacheCardData(cardData) {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_CARDS);
      const cards = cached ? JSON.parse(cached) : {};
      
      // Update or add card data
      cards[cardData.rfidUId] = {
        ...cardData,
        cachedAt: new Date().toISOString()
      };

      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_CARDS, JSON.stringify(cards));
      console.log('✅ Cached card data for:', cardData.fullName || cardData.rfidUId);
    } catch (error) {
      console.error('❌ Failed to cache card data:', error);
    }
  },

  async lookupCard(rfidUId) {
    try {
      // Try the new users cache first
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_CARDS);
      if (cached) {
        const { data } = JSON.parse(cached);
        if (Array.isArray(data)) {
          const user = data.find(u => u.rfidUId === rfidUId);
          if (user) {
            console.log('✅ Found user in cache:', user);
            console.log('👤 User data:', JSON.stringify(user, null, 2));
            return user;
          }
        }
      }
      
      // Fallback to old format (if exists)
      const oldCached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_CARDS);
      const cards = oldCached ? JSON.parse(oldCached) : {};
      
      return cards[rfidUId] || null;
    } catch (error) {
      console.error('❌ Failed to lookup card:', error);
      return null;
    }
  },

  // ============================================================
  // OFFLINE TRANSACTION TRACKING (for duplicate detection)
  // ============================================================
  async hasRecentTransaction(rfidUId, timeWindowMinutes = 5) {
    try {
      const transactions = await this.getOfflineTransactions();
      const now = Date.now();
      const windowStart = now - (timeWindowMinutes * 60 * 1000);

      // Check if there's a recent transaction for this RFID
      const recentTransaction = transactions.find(tx => 
        tx.rfidUId === rfidUId && 
        new Date(tx.timestamp).getTime() > windowStart
      );

      if (recentTransaction) {
        console.log('🚫 Recent transaction found for:', rfidUId, 'at:', recentTransaction.timestamp);
        return {
          hasRecent: true,
          transaction: recentTransaction,
          timeAgo: Math.floor((now - new Date(recentTransaction.timestamp).getTime()) / 1000)
        };
      }

      return { hasRecent: false };
    } catch (error) {
      console.error('❌ Failed to check recent transactions:', error);
      return { hasRecent: false };
    }
  },

  async addOfflineTransaction(transaction) {
    try {
      const transactions = await this.getOfflineTransactions();
      
      // Add the new transaction
      transactions.push({
        ...transaction,
        id: Date.now().toString(), // Unique ID for this transaction
        addedAt: new Date().toISOString()
      });

      // Keep only last 100 transactions to prevent storage bloat
      if (transactions.length > 100) {
        transactions.splice(0, transactions.length - 100);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS, JSON.stringify(transactions));
      console.log('📦 Added offline transaction for:', transaction.studentName || transaction.rfidUId);
    } catch (error) {
      console.error('❌ Failed to add offline transaction:', error);
    }
  },

  async getOfflineTransactions() {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('❌ Failed to get offline transactions:', error);
      return [];
    }
  },

  async clearOfflineTransactions() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_TRANSACTIONS);
      console.log('🗑️ Offline transactions cleared');
    } catch (error) {
      console.error('❌ Failed to clear offline transactions:', error);
    }
  },

  // ============================================================
  // CLEAR ALL CACHE (useful for logout)
  // ============================================================
  async clearAllCache() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ROUTES,
        STORAGE_KEYS.SHUTTLES,
        STORAGE_KEYS.USER_SESSION,
        STORAGE_KEYS.SHUTTLE_POSITIONS,
        STORAGE_KEYS.TRIP_DATA,
        STORAGE_KEYS.MERCHANT_DATA,
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.LAST_SYNC,
        STORAGE_KEYS.CACHED_CARDS,
        STORAGE_KEYS.OFFLINE_TRANSACTIONS
      ]);
      console.log('🗑️ All cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear all cache:', error);
    }
  }
};

export default OfflineStorageService;
