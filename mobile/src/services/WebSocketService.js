// mobile/src/services/WebSocketService.js
// Real-time WebSocket client for instant updates from motorpool dashboard

import io from 'socket.io-client';
import { getStoredServerURL } from '../config/api.config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.listeners = new Map();
    this.connectionPromise = null;
  }

  // Initialize WebSocket connection
  async initialize() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  async _connect() {
    try {
      // Get the server URL
      const serverURL = await getStoredServerURL();
      if (!serverURL) {
        console.warn('⚠️ No server URL configured for WebSocket');
        return false;
      }

      // Extract base URL (remove /api)
      const baseURL = serverURL.replace('/api', '');
      const wsURL = baseURL.startsWith('http') ? baseURL : `http://${baseURL}`;

      console.log(`🔌 Connecting to WebSocket: ${wsURL}`);

      // Create socket connection
      this.socket = io(wsURL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Wait for connection
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.socket.once('connected', () => {
          clearTimeout(timeout);
          resolve(true);
        });

        this.socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      return false;
    }
  }

  setupEventHandlers() {
    // Connection established
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Register as mobile client
      this.registerClient();
    });

    // Connection confirmation from server
    this.socket.on('connected', (data) => {
      console.log('📱 WebSocket registration confirmed:', data);
      this.notifyListeners('connected', data);
    });

    // Disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.isConnected = false;
      this.notifyListeners('disconnected', { reason });
    });

    // Connection error
    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.reconnectAttempts++;
      this.notifyListeners('error', { error, attempt: this.reconnectAttempts });
    });

    // Real-time data updates
    this.socket.on('shuttle_updated', (data) => {
      console.log('🚌 Shuttle update received:', data);
      this.notifyListeners('shuttle_updated', data);
      this.triggerDataRefresh('shuttles');
    });

    this.socket.on('route_updated', (data) => {
      console.log('🛣️ Route update received:', data);
      this.notifyListeners('route_updated', data);
      this.triggerDataRefresh('routes');
    });

    this.socket.on('trip_updated', (data) => {
      console.log('🚗 Trip update received:', data);
      this.notifyListeners('trip_updated', data);
      this.triggerDataRefresh('trips');
    });

    this.socket.on('geofence_updated', (data) => {
      console.log('📍 Geofence update received:', data);
      this.notifyListeners('geofence_updated', data);
      this.triggerDataRefresh('geofences');
    });

    this.socket.on('data_updated', (data) => {
      console.log('📊 Generic data update received:', data);
      this.notifyListeners('data_updated', data);
    });

    // Force refresh commands
    this.socket.on('force_refresh', (data) => {
      console.log('🔄 Force refresh command received:', data);
      this.notifyListeners('force_refresh', data);
      this.triggerDataRefresh(data.dataType);
    });

    // Sync trigger
    this.socket.on('sync_trigger', (data) => {
      console.log('🔄 Sync trigger received:', data);
      this.notifyListeners('sync_trigger', data);
    });
  }

  // Register as mobile client
  registerClient() {
    if (!this.socket || !this.isConnected) return;

    // Get device info
    const deviceInfo = {
      clientType: 'mobile',
      deviceId: this.getDeviceId(),
      userId: this.getCurrentUserId(),
      platform: this.getPlatform(),
      appVersion: this.getAppVersion()
    };

    this.socket.emit('register', deviceInfo);
    console.log('📱 Registered as mobile client:', deviceInfo);
  }

  // Send location updates (for driver tracking)
  sendLocationUpdate(locationData) {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ WebSocket not connected - cannot send location update');
      return;
    }

    this.socket.emit('location_update', locationData);
  }

  // Request immediate sync
  requestSync(dataType) {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ WebSocket not connected - cannot request sync');
      return;
    }

    this.socket.emit('request_sync', { dataType });
  }

  // Add event listener
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  // Remove event listener
  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  // Notify all listeners for an event
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ WebSocket listener error for ${event}:`, error);
        }
      });
    }
  }

  // Trigger data refresh in SyncManager
  triggerDataRefresh(dataType) {
    // Import SyncManager dynamically to avoid circular dependency
    import('./SyncManager.js').then(({ default: syncManager }) => {
      if (dataType === 'all') {
        syncManager.syncAll();
      } else {
        switch (dataType) {
          case 'shuttles':
            syncManager.syncShuttles();
            break;
          case 'routes':
            syncManager.syncRoutes();
            break;
          case 'trips':
            // Add trip sync if available
            syncManager.syncAll();
            break;
          default:
            syncManager.syncAll();
        }
      }
    }).catch(error => {
      console.error('❌ Failed to trigger data refresh:', error);
    });
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id
    };
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.connectionPromise = null;
  }

  // Utility methods
  getDeviceId() {
    // Generate or retrieve device ID
    return 'mobile_' + Math.random().toString(36).substr(2, 9);
  }

  getCurrentUserId() {
    // Get current user ID from storage (implement as needed)
    return null; // To be implemented based on auth system
  }

  getPlatform() {
    // Get platform info
    return 'mobile'; // Could be more specific
  }

  getAppVersion() {
    return '1.0.0'; // Could be from app config
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;
