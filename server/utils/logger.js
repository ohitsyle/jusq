// nucash-server/utils/logger.js
// Centralized logging utility for comprehensive event tracking

import EventLog from '../models/EventLog.js';
import { nanoid } from 'nanoid';

/**
 * Log an event to the database
 * @param {Object} eventData - Event data to log
 * @returns {Promise<Object>} - Created event log
 */
export async function logEvent(eventData) {
  try {
    const event = await EventLog.create({
      eventId: `EVT-${nanoid(10)}`,
      timestamp: new Date(),
      ...eventData
    });
    return event;
  } catch (error) {
    console.error('Failed to create event log:', error);
    return null;
  }
}

/**
 * Log a payment transaction
 */
export async function logPayment(data) {
  return await logEvent({
    eventType: 'payment',
    title: data.success ? 'Payment Successful' : 'Payment Failed',
    description: `${data.userName || 'User'} ${data.success ? 'paid' : 'attempted to pay'} ₱${data.amount} ${data.shuttleId ? `on shuttle ${data.shuttleId}` : ''}`,
    severity: data.success ? 'info' : 'warning',
    userId: data.userId,
    shuttleId: data.shuttleId,
    driverId: data.driverId,
    metadata: {
      amount: data.amount,
      balance: data.balance,
      transactionId: data.transactionId,
      success: data.success,
      errorMessage: data.errorMessage
    }
  });
}

/**
 * Log a login event
 */
export async function logLogin(data) {
  return await logEvent({
    eventType: 'login',
    title: `${data.userType || 'User'} Login`,
    description: `${data.userName || data.userId} logged in successfully`,
    severity: 'info',
    userId: data.userId,
    driverId: data.driverId,
    adminId: data.adminId,
    adminName: data.userName || data.adminName,
    ipAddress: data.ipAddress,
    department: data.department || (data.userType?.includes('Admin') ? data.userType?.match(/\(([^)]+)\)/)?.[1] : null),
    targetEntity: data.adminId ? 'admin' : (data.driverId ? 'driver' : 'user'),
    metadata: {
      userType: data.userType,
      deviceInfo: data.deviceInfo,
      adminRole: data.adminRole || (data.userType?.includes('Admin') ? data.userType?.match(/\(([^)]+)\)/)?.[1] : null)
    }
  });
}

/**
 * Log a logout event
 */
export async function logLogout(data) {
  return await logEvent({
    eventType: 'logout',
    title: `${data.userType || 'User'} Logout`,
    description: `${data.userName || data.userId} logged out`,
    severity: 'info',
    userId: data.userId,
    driverId: data.driverId,
    adminId: data.adminId,
    adminName: data.userName || data.adminName,
    department: data.department || (data.userType?.includes('Admin') ? data.userType?.match(/\(([^)]+)\)/)?.[1] : null),
    targetEntity: data.adminId ? 'admin' : (data.driverId ? 'driver' : 'user'),
    metadata: {
      userType: data.userType,
      sessionDuration: data.sessionDuration,
      adminRole: data.adminRole || (data.userType?.includes('Admin') ? data.userType?.match(/\(([^)]+)\)/)?.[1] : null)
    }
  });
}

/**
 * Log a trip start
 */
export async function logTripStart(data) {
  return await logEvent({
    eventType: 'route_start',
    title: 'Trip Started',
    description: `Driver ${data.driverId} started trip on shuttle ${data.shuttleId} for route ${data.routeId}`,
    severity: 'info',
    driverId: data.driverId,
    shuttleId: data.shuttleId,
    routeId: data.routeId,
    tripId: data.tripId,
    location: {
      latitude: data.startLatitude,
      longitude: data.startLongitude
    },
    metadata: {
      startLocationName: data.startLocationName,
      endLocationName: data.endLocationName,
      departureTime: data.departureTime
    }
  });
}

/**
 * Log a trip end
 */
export async function logTripEnd(data) {
  return await logEvent({
    eventType: 'route_end',
    title: 'Trip Completed',
    description: `Trip ${data.tripId} completed - ${data.passengerCount} passengers, ₱${data.totalCollections} collected`,
    severity: 'info',
    driverId: data.driverId,
    shuttleId: data.shuttleId,
    routeId: data.routeId,
    tripId: data.tripId,
    metadata: {
      passengerCount: data.passengerCount,
      totalCollections: data.totalCollections,
      distanceTraveledKm: data.distanceTraveledKm,
      durationMinutes: data.durationMinutes,
      arrivalTime: data.arrivalTime
    }
  });
}

/**
 * Log a driver assignment
 */
export async function logDriverAssignment(data) {
  return await logEvent({
    eventType: 'driver_assignment',
    title: 'Driver Assigned to Shuttle',
    description: `Driver ${data.driverId} (${data.driverName}) assigned to shuttle ${data.shuttleId}`,
    severity: 'info',
    driverId: data.driverId,
    shuttleId: data.shuttleId,
    metadata: {
      driverName: data.driverName,
      assignedBy: data.assignedBy,
      previousShuttle: data.previousShuttle
    }
  });
}

/**
 * Log an admin action
 */
export async function logAdminAction(data) {
  const actorName = data.adminName && data.adminName !== 'undefined undefined' ? data.adminName : (data.adminId || 'Unknown');
  return await logEvent({
    eventType: data.crudOperation || 'admin_action',
    title: data.action,
    description: `${actorName} ${data.description}`,
    severity: data.severity || 'info',
    adminId: data.adminId,
    adminName: actorName,
    department: data.department || data.adminRole,
    targetEntity: data.targetEntity || 'admin',
    metadata: {
      adminId: data.adminId,
      adminName: data.adminName,
      adminRole: data.adminRole,
      action: data.action,
      targetEntity: data.targetEntity,
      targetId: data.targetId,
      changes: data.changes,
      ipAddress: data.ipAddress,
      crudOperation: data.crudOperation
    }
  });
}

/**
 * Log a user action
 */
export async function logUserAction(data) {
  return await logEvent({
    eventType: 'user_action',
    title: data.action,
    description: `User ${data.userName || data.userId} ${data.description}`,
    severity: 'info',
    userId: data.userId,
    metadata: {
      action: data.action,
      details: data.details
    }
  });
}

/**
 * Log a system error
 */
export async function logError(data) {
  return await logEvent({
    eventType: 'error',
    title: data.title || 'System Error',
    description: data.description || data.error?.message || 'An error occurred',
    severity: data.severity || 'error',
    userId: data.userId,
    driverId: data.driverId,
    shuttleId: data.shuttleId,
    metadata: {
      errorType: data.errorType,
      errorMessage: data.error?.message,
      errorStack: data.error?.stack,
      context: data.context,
      endpoint: data.endpoint,
      method: data.method
    }
  });
}

/**
 * Log a security event
 */
export async function logSecurity(data) {
  return await logEvent({
    eventType: 'security',
    title: data.title,
    description: data.description,
    severity: data.severity || 'warning',
    userId: data.userId,
    ipAddress: data.ipAddress,
    metadata: {
      action: data.action,
      reason: data.reason,
      blocked: data.blocked,
      attempts: data.attempts
    }
  });
}

/**
 * Log a system event
 */
export async function logSystem(data) {
  return await logEvent({
    eventType: 'system',
    title: data.title,
    description: data.description,
    severity: data.severity || 'info',
    metadata: {
      component: data.component,
      status: data.status,
      details: data.details
    }
  });
}

/**
 * Log driver mobile app login
 */
export async function logDriverLogin(data) {
  return await logEvent({
    eventType: 'driver_login',
    title: 'Driver Mobile App Login',
    description: `Driver ${data.driverName || data.driverId} logged into mobile app`,
    severity: 'info',
    driverId: data.driverId,
    metadata: {
      driverName: data.driverName,
      deviceInfo: data.deviceInfo,
      ipAddress: data.ipAddress,
      loginTime: data.timestamp
    }
  });
}

/**
 * Log driver mobile app logout
 */
export async function logDriverLogout(data) {
  return await logEvent({
    eventType: 'driver_logout',
    title: 'Driver Mobile App Logout',
    description: `Driver ${data.driverName || data.driverId} logged out of mobile app`,
    severity: 'info',
    driverId: data.driverId,
    metadata: {
      driverName: data.driverName,
      sessionDuration: data.sessionDuration,
      logoutTime: data.timestamp
    }
  });
}

/**
 * Log driver shuttle and route selection
 */
export async function logDriverShuttleSelection(data) {
  return await logEvent({
    eventType: 'shuttle_selection',
    title: 'Driver Selected Shuttle and Route',
    description: `Driver ${data.driverName || data.driverId} selected shuttle ${data.shuttleId} for route ${data.routeId}`,
    severity: 'info',
    driverId: data.driverId,
    shuttleId: data.shuttleId,
    routeId: data.routeId,
    metadata: {
      driverName: data.driverName,
      shuttlePlateNumber: data.shuttlePlateNumber,
      routeName: data.routeName,
      selectionTime: data.timestamp
    }
  });
}

/**
 * Log driver route change and refund
 */
export async function logDriverRouteChange(data) {
  return await logEvent({
    eventType: 'route_change',
    title: 'Driver Changed Route',
    description: `Driver ${data.driverName || data.driverId} changed from route ${data.oldRouteId} to ${data.newRouteId}`,
    severity: 'info',
    driverId: data.driverId,
    shuttleId: data.shuttleId,
    metadata: {
      driverName: data.driverName,
      oldRouteId: data.oldRouteId,
      newRouteId: data.newRouteId,
      refundAmount: data.refundAmount,
      refundReason: data.refundReason,
      changeTime: data.timestamp
    }
  });
}

/**
 * Log merchant mobile app login
 */
export async function logMerchantLogin(data) {
  return await logEvent({
    eventType: 'merchant_login',
    title: 'Merchant Mobile App Login',
    description: `Merchant ${data.merchantName || data.merchantId} logged into mobile app`,
    severity: 'info',
    metadata: {
      merchantId: data.merchantId,
      merchantName: data.merchantName,
      deviceInfo: data.deviceInfo,
      ipAddress: data.ipAddress,
      loginTime: data.timestamp
    }
  });
}

/**
 * Log merchant mobile app logout
 */
export async function logMerchantLogout(data) {
  return await logEvent({
    eventType: 'merchant_logout',
    title: 'Merchant Mobile App Logout',
    description: `Merchant ${data.merchantName || data.merchantId} logged out of mobile app`,
    severity: 'info',
    metadata: {
      merchantId: data.merchantId,
      merchantName: data.merchantName,
      sessionDuration: data.sessionDuration,
      logoutTime: data.timestamp
    }
  });
}

/**
 * Log cash-in transaction by treasury admin
 */
export async function logCashIn(data) {
  return await logEvent({
    eventType: 'cash_in',
    title: 'Cash-In Processed',
    description: `${data.adminName || data.adminId || 'Treasury Admin'} processed cash-in of ₱${data.amount} for user ${data.userName || data.userId}`,
    severity: 'info',
    adminId: data.adminId,
    adminName: data.adminName,
    department: 'treasury',
    userId: data.userId,
    metadata: {
      adminRole: 'treasury',
      amount: data.amount,
      userId: data.userId,
      userName: data.userName,
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      cashInTime: data.timestamp
    }
  });
}

/**
 * Log auto export configuration change
 */
export async function logAutoExportConfigChange(data) {
  const actorName = data.adminName && data.adminName !== 'undefined undefined' ? data.adminName : (data.adminId || 'Unknown');
  return await logEvent({
    eventType: 'auto_export_config_change',
    title: 'Auto Export Configuration Changed',
    description: `${actorName} (${data.adminRole || 'admin'}) changed auto export configuration for ${data.department} department`,
    severity: 'info',
    adminId: data.adminId,
    adminName: data.adminName,
    department: data.department,
    metadata: {
      adminRole: data.adminRole,
      configChanges: data.configChanges,
      oldConfig: data.oldConfig,
      newConfig: data.newConfig,
      changeTime: data.timestamp
    }
  });
}

/**
 * Log manual export by admin
 */
export async function logManualExport(data) {
  const actorName = data.adminName && data.adminName !== 'undefined undefined' ? data.adminName : (data.adminId || 'Unknown');
  return await logEvent({
    eventType: 'manual_export',
    title: 'Manual Export Performed',
    description: `${actorName} (${data.adminRole || 'admin'}) performed manual export for ${data.department} department`,
    severity: 'info',
    adminId: data.adminId,
    adminName: data.adminName,
    department: data.department,
    metadata: {
      adminRole: data.adminRole,
      exportType: data.exportType,
      dateRange: data.dateRange,
      recordCount: data.recordCount,
      exportTime: data.timestamp
    }
  });
}

/**
 * Log maintenance mode toggle by system admin
 */
export async function logMaintenanceMode(data) {
  return await logEvent({
    eventType: 'maintenance_mode',
    title: data.enabled ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled',
    description: `${data.adminName || data.adminId || 'System Admin'} ${data.enabled ? 'enabled' : 'disabled'} maintenance mode`,
    severity: 'warning',
    adminId: data.adminId,
    adminName: data.adminName,
    department: 'sysad',
    metadata: {
      adminRole: 'sysad',
      enabled: data.enabled,
      reason: data.reason,
      estimatedDuration: data.estimatedDuration,
      toggleTime: data.timestamp
    }
  });
}

/**
 * Log student deactivation changes by system admin
 */
export async function logStudentDeactivation(data) {
  return await logEvent({
    eventType: 'student_deactivation',
    title: data.enabled ? 'Student Deactivation Enabled' : 'Student Deactivation Disabled',
    description: `${data.adminName || data.adminId || 'System Admin'} ${data.enabled ? 'enabled' : 'disabled'} student deactivation feature`,
    severity: 'warning',
    adminId: data.adminId,
    adminName: data.adminName,
    department: 'sysad',
    metadata: {
      adminRole: 'sysad',
      enabled: data.enabled,
      reason: data.reason,
      affectedStudents: data.affectedStudents,
      changeTime: data.timestamp
    }
  });
}

export default {
  logEvent,
  logPayment,
  logLogin,
  logLogout,
  logTripStart,
  logTripEnd,
  logDriverAssignment,
  logAdminAction,
  logUserAction,
  logError,
  logSecurity,
  logSystem,
  logDriverLogin,
  logDriverLogout,
  logDriverShuttleSelection,
  logDriverRouteChange,
  logMerchantLogin,
  logMerchantLogout,
  logCashIn,
  logAutoExportConfigChange,
  logManualExport,
  logMaintenanceMode,
  logStudentDeactivation
};
