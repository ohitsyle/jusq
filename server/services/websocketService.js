// server/services/websocketService.js
// Real-time WebSocket service for instant mobile app updates

import { Server } from 'socket.io';
import http from 'http';

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map(); // Track connected mobile clients
    this.motorpoolClients = new Set(); // Track motorpool dashboard clients
  }

  // Initialize WebSocket server
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://18.166.29.239:3000',
          'http://172.20.10.2:3000'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupEventHandlers();
    console.log('🔌 WebSocket server initialized for real-time updates');
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`📱 Client connected: ${socket.id}`);

      // Handle client registration
      socket.on('register', (data) => {
        const { clientType, userId, deviceId } = data;
        
        socket.clientType = clientType;
        socket.userId = userId;
        socket.deviceId = deviceId;

        if (clientType === 'mobile') {
          this.connectedClients.set(socket.id, {
            socket,
            userId,
            deviceId,
            connectedAt: new Date()
          });
          console.log(`📱 Mobile client registered: ${deviceId} (User: ${userId})`);
        } else if (clientType === 'motorpool') {
          this.motorpoolClients.add(socket.id);
          console.log(`🚌 Motorpool client registered: ${socket.id}`);
        }

        // Send initial connection confirmation
        socket.emit('connected', {
          status: 'connected',
          clientType,
          timestamp: new Date()
        });
      });

      // Handle mobile app location updates
      socket.on('location_update', (data) => {
        const { shuttleId, location, heading, speed } = data;
        
        // Broadcast location to all motorpool clients
        this.broadcastToMotorpool('shuttle_location', {
          shuttleId,
          location,
          heading,
          speed,
          timestamp: new Date()
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`📱 Client disconnected: ${socket.id}`);
        
        if (socket.clientType === 'mobile') {
          this.connectedClients.delete(socket.id);
        } else if (socket.clientType === 'motorpool') {
          this.motorpoolClients.delete(socket.id);
        }
      });

      // Handle mobile app requests for immediate sync
      socket.on('request_sync', (data) => {
        const { dataType } = data;
        socket.emit('sync_trigger', {
          dataType,
          timestamp: new Date()
        });
      });
    });
  }

  // Broadcast to all motorpool dashboard clients
  broadcastToMotorpool(event, data) {
    if (this.motorpoolClients.size === 0) return;

    console.log(`📡 Broadcasting ${event} to ${this.motorpoolClients.size} motorpool clients`);
    
    this.motorpoolClients.forEach(clientId => {
      this.io.to(clientId).emit(event, data);
    });
  }

  // Broadcast to all mobile clients
  broadcastToMobile(event, data) {
    if (this.connectedClients.size === 0) return;

    console.log(`📡 Broadcasting ${event} to ${this.connectedClients.size} mobile clients`);
    
    this.connectedClients.forEach((client, socketId) => {
      this.io.to(socketId).emit(event, data);
    });
  }

  // Notify mobile clients of route changes
  notifyRouteChange(routeData) {
    this.broadcastToMobile('route_updated', {
      ...routeData,
      timestamp: new Date()
    });
  }

  // Notify mobile clients of shuttle changes
  notifyShuttleChange(shuttleData) {
    this.broadcastToMobile('shuttle_updated', {
      ...shuttleData,
      timestamp: new Date()
    });
  }

  // Notify motorpool of driver status changes
  notifyDriverStatusChange(driverData) {
    this.broadcastToMotorpool('driver_status_changed', {
      ...driverData,
      timestamp: new Date()
    });
  }

  // Notify mobile clients of trip updates
  notifyTripUpdate(tripData) {
    this.broadcastToMobile('trip_updated', {
      ...tripData,
      timestamp: new Date()
    });
  }

  // Get connection statistics
  getStats() {
    return {
      connectedMobileClients: this.connectedClients.size,
      connectedMotorpoolClients: this.motorpoolClients.size,
      totalConnections: this.io?.engine.clientsCount || 0,
      lastUpdate: new Date() // Add timestamp for polling detection
    };
  }

  // Force refresh all mobile clients
  forceMobileRefresh(dataType = 'all') {
    this.broadcastToMobile('force_refresh', {
      dataType,
      timestamp: new Date()
    });
  }

  // Force refresh motorpool dashboard
  forceMotorpoolRefresh(dataType = 'all') {
    this.broadcastToMotorpool('force_refresh', {
      dataType,
      timestamp: new Date()
    });
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
