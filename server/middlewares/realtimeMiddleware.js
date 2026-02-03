// server/middlewares/realtimeMiddleware.js
// Middleware to automatically broadcast changes via WebSocket when data is modified

import websocketService from '../services/websocketService.js';

// Middleware factory to broadcast changes for specific entity types
export const broadcastChanges = (entityType) => {
  return (req, res, next) => {
    // Store original res.json method
    const originalJson = res.json;
    
    // Override res.json to intercept response
    res.json = function(data) {
      // Call original json method
      originalJson.call(this, data);
      
      // Only broadcast on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Determine the operation type based on HTTP method
        const operation = getOperationType(req.method);
        
        // Broadcast the change
        setTimeout(() => {
          broadcastEntityChange(entityType, operation, req, data);
        }, 100); // Small delay to ensure data is saved
      }
      
      return this;
    };
    
    next();
  };
};

// Helper function to determine operation type
function getOperationType(method) {
  switch (method) {
    case 'POST':
      return 'created';
    case 'PUT':
    case 'PATCH':
      return 'updated';
    case 'DELETE':
      return 'deleted';
    default:
      return 'modified';
  }
}

// Broadcast entity changes to appropriate clients
function broadcastEntityChange(entityType, operation, req, responseData) {
  try {
    const changeData = {
      entityType,
      operation,
      timestamp: new Date(),
      data: responseData,
      triggeredBy: req.user?.id || req.adminId || req.merchantId || 'system'
    };

    console.log(`📡 Broadcasting ${entityType} ${operation} via WebSocket`);

    switch (entityType) {
      case 'shuttle':
        // Broadcast to mobile apps (for shuttle selection)
        // and motorpool dashboard
        websocketService.broadcastToMobile('shuttle_updated', changeData);
        websocketService.broadcastToMotorpool('shuttle_updated', changeData);
        break;
        
      case 'route':
        // Broadcast to mobile apps (for route selection)
        // and motorpool dashboard
        websocketService.broadcastToMobile('route_updated', changeData);
        websocketService.broadcastToMotorpool('route_updated', changeData);
        break;
        
      case 'driver':
        // Broadcast to motorpool dashboard
        websocketService.broadcastToMotorpool('driver_updated', changeData);
        break;
        
      case 'trip':
        // Broadcast to mobile apps and motorpool dashboard
        websocketService.broadcastToMobile('trip_updated', changeData);
        websocketService.broadcastToMotorpool('trip_updated', changeData);
        break;
        
      case 'geofence':
        // Broadcast to mobile apps (for location tracking)
        websocketService.broadcastToMobile('geofence_updated', changeData);
        break;
        
      default:
        // Generic broadcast to all clients
        websocketService.broadcastToMobile('data_updated', changeData);
        websocketService.broadcastToMotorpool('data_updated', changeData);
    }
  } catch (error) {
    console.error('❌ Error broadcasting changes:', error);
  }
}

// Middleware to force mobile refresh on specific operations
export const forceMobileRefresh = (dataType = 'all') => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      originalJson.call(this, data);
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setTimeout(() => {
          websocketService.forceMobileRefresh(dataType);
          console.log(`🔄 Forced mobile refresh for: ${dataType}`);
        }, 200);
      }
      
      return this;
    };
    
    next();
  };
};

// Middleware to force motorpool refresh on specific operations
export const forceMotorpoolRefresh = (dataType = 'all') => {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      originalJson.call(this, data);
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setTimeout(() => {
          websocketService.forceMotorpoolRefresh(dataType);
          console.log(`🔄 Forced motorpool refresh for: ${dataType}`);
        }, 200);
      }
      
      return this;
    };
    
    next();
  };
};

// Utility function to manually trigger broadcasts
export const manualBroadcast = {
  shuttleUpdated: (data) => websocketService.notifyShuttleChange(data),
  routeUpdated: (data) => websocketService.notifyRouteChange(data),
  driverStatusChanged: (data) => websocketService.notifyDriverStatusChange(data),
  tripUpdated: (data) => websocketService.notifyTripUpdate(data),
  forceMobileRefresh: (dataType) => websocketService.forceMobileRefresh(dataType),
  forceMotorpoolRefresh: (dataType) => websocketService.forceMotorpoolRefresh(dataType)
};

export default {
  broadcastChanges,
  forceMobileRefresh,
  forceMotorpoolRefresh,
  manualBroadcast
};
