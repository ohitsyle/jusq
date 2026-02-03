// mobile/src/services/WebSocketService.js
// Real-time WebSocket client for instant updates from motorpool dashboard
// Using HTTP polling fallback for React Native compatibility

import { getStoredServerURL } from '../config/api.config';

class WebSocketService {
  constructor() {
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.listeners = new Map();
    this.connectionPromise = null;
    this.pollingInterval = null;
    this.pollingIntervalMs = 1000; // 1 second polling for near real-time
  }

  // Initialize WebSocket connection (HTTP polling fallback)
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

      console.log(`🔌 Initializing HTTP polling for real-time updates: ${serverURL}`);

      // Start HTTP polling for real-time updates
      this.startPolling(serverURL);
      
      // Simulate connection success
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Notify listeners of connection
      this.notifyListeners('connected', {
        status: 'connected',
        clientType: 'mobile',
        timestamp: new Date(),
        method: 'http-polling'
      });

      return true;

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      return false;
    }
  }

  startPolling(serverURL) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    let lastUpdate = Date.now();
    
    this.pollingInterval = setInterval(async () => {
      try {
        // Check for updates via HTTP
        const response = await fetch(`${serverURL.replace('/api', '')}/api/websocket/stats`);
        const data = await response.json();
        
        if (data.success && data.timestamp) {
          const updateTime = new Date(data.timestamp).getTime();
          
          // If server has new updates, trigger refresh
          if (updateTime > lastUpdate) {
            lastUpdate = updateTime;
            this.notifyListeners('server_update', {
              timestamp: data.timestamp,
              stats: data.stats
            });
            
            // Trigger data refresh for mobile app
            this.triggerDataRefresh('all');
          }
        }
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    }, this.pollingIntervalMs);
  }

  // Send location updates (for driver tracking)
  sendLocationUpdate(locationData) {
    // For HTTP polling, we can send location updates via regular API
    console.log('📍 Location update (HTTP):', locationData);
    // This would be implemented via regular API calls
  }

  // Request immediate sync
  requestSync(dataType) {
    console.log(`🔄 Requesting sync for: ${dataType}`);
    this.triggerDataRefresh(dataType);
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
      method: 'http-polling',
      pollingInterval: this.pollingIntervalMs
    };
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isConnected = false;
    this.connectionPromise = null;
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;
