// src/services/NetworkService.js
// Network state monitoring service for automatic online/offline detection
import NetInfo from '@react-native-community/netinfo';
import api from './api';

class NetworkService {
  constructor() {
    this.isConnected = true;
    this.listeners = [];
    this.unsubscribe = null;
    this.lastCheckTime = null;
    this.checkInterval = null;
    this.isInitialized = false;
  }

  // ============================================================
  // INITIALIZE NETWORK MONITORING
  // ============================================================
  initialize() {
    console.log('🌐 Initializing network monitoring...');
    
    if (this.isInitialized) {
      console.log('🌐 NetworkService already initialized');
      return this;
    }

    // Subscribe to network state changes
    this.unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected && state.isInternetReachable;

      console.log('🌐 Network state:', {
        connected: this.isConnected,
        type: state.type,
        reachable: state.isInternetReachable
      });

      // Notify listeners if state changed
      if (wasConnected !== this.isConnected) {
        this.notifyListeners(this.isConnected, wasConnected);
      }
    });

    // Initial check
    this.checkConnection();

    // Periodic check every 30 seconds
    this.startPeriodicCheck(30000);
    
    this.isInitialized = true;
    console.log('🌐 NetworkService initialized successfully');

    return this;
  }

  // ============================================================
  // CHECK CONNECTION
  // ============================================================
  async checkConnection() {
    try {
      const state = await NetInfo.fetch();
      const deviceConnected = state.isConnected && state.isInternetReachable;
      this.lastCheckTime = Date.now();

      // Additional API ping to verify server reachability
      if (deviceConnected) {
        const canReachServer = await this.pingServer();
        this.isConnected = canReachServer;
        
        if (!canReachServer) {
          console.warn('⚠️ Device has internet but cannot reach server - marking as offline');
        } else {
          console.log('✅ Device online and server reachable');
        }
        return canReachServer;
      } else {
        this.isConnected = false;
        console.log('⚠️ Device offline - no internet connection');
        return false;
      }
    } catch (error) {
      console.error('❌ Connection check failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  // ============================================================
  // PING SERVER TO VERIFY REACHABILITY
  // ============================================================
  async pingServer(timeout = 5000) {
    try {
      // Try multiple endpoints for better reliability
      const endpoints = ['/system/config', '/health', '/api/health'];
      
      for (const endpoint of endpoints) {
        try {
          const response = await api.get(endpoint, { 
            timeout: timeout,
            validateStatus: (status) => status < 500 // Accept any response less than 500
          });
          
          if (response.status < 500) {
            console.log(`✅ Server reachable via ${endpoint}`);
            return true;
          }
        } catch (err) {
          console.log(`❌ Failed to reach ${endpoint}:`, err.message);
          continue; // Try next endpoint
        }
      }
      
      console.error('❌ All server endpoints unreachable');
      return false;
    } catch (error) {
      console.error('❌ Server ping failed:', error.message);
      return false;
    }
  }

  // ============================================================
  // PERIODIC CONNECTION CHECK
  // ============================================================
  startPeriodicCheck(intervalMs = 30000) {
    this.stopPeriodicCheck(); // Clear existing interval

    this.checkInterval = setInterval(() => {
      this.checkConnection();
    }, intervalMs);

    console.log(`✅ Started periodic connection check (every ${intervalMs / 1000}s)`);
  }

  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🛑 Stopped periodic connection check');
    }
  }

  // ============================================================
  // CONNECTION STATE LISTENERS
  // ============================================================
  addListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
      console.log(`➕ Added network listener (total: ${this.listeners.length})`);

      // Immediately notify with current state
      callback(this.isConnected, null);
    }
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
    console.log(`➖ Removed network listener (total: ${this.listeners.length})`);
  }

  notifyListeners(isConnected, wasConnected) {
    console.log(`📢 Notifying ${this.listeners.length} listeners: ${wasConnected ? 'online' : 'offline'} → ${isConnected ? 'online' : 'offline'}`);

    this.listeners.forEach(callback => {
      try {
        callback(isConnected, wasConnected);
      } catch (error) {
        console.error('❌ Listener error:', error);
      }
    });
  }

  // ============================================================
  // CLEANUP
  // ============================================================
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.stopPeriodicCheck();
    this.listeners = [];

    console.log('🧹 Network service cleaned up');
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      lastCheck: this.lastCheckTime ? new Date(this.lastCheckTime).toLocaleString() : 'Never',
      timeSinceCheck: this.lastCheckTime ? Date.now() - this.lastCheckTime : null
    };
  }

  async getDetailedConnectionInfo() {
    try {
      const state = await NetInfo.fetch();
      return {
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        details: state.details,
        isWiFi: state.type === 'wifi',
        isCellular: state.type === 'cellular'
      };
    } catch (error) {
      console.error('❌ Failed to get detailed connection info:', error);
      return null;
    }
  }
}

// Create singleton instance
const networkService = new NetworkService();

export default networkService;
