// nucash-server/models/EventLog.js
// Model for comprehensive system event logging

import mongoose from 'mongoose';

const EventLogSchema = new mongoose.Schema({
  // Event identity
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Event type and category
  eventType: {
    type: String,
    required: true,
    enum: [
      'payment',
      'login',
      'logout',
      'route_start',
      'route_end',
      'driver_assignment',
      'shuttle_assignment',
      'error',
      'system',
      'security',
      'admin_action',
      'user_action',
      'crud_create',
      'crud_read',
      'crud_update',
      'crud_delete',
      'export_manual',
      'export_auto',
      'maintenance_mode',
      'student_deactivation',
      'note_added',
      'note_updated',
      'concern_resolved',
      'cash_in',
      'registration',
      'merchant_login',
      'merchant_logout',
      'driver_login',
      'driver_logout',
      'trip_start',
      'trip_end',
      'route_change',
      'refund',
      'phone_assigned',
      'phone_unassigned',
      'config_updated',
      'shuttle_selection',
      'auto_export_config_change',
      'manual_export'
    ],
    index: true
  },
  
  // Event details
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  
  // Severity level
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
    index: true
  },
  
  // Related entities
  userId: {
    type: String,
    default: null,
    index: true
  },
  driverId: {
    type: String,
    default: null,
    index: true
  },
  driverName: {
    type: String,
    default: null
  },
  adminId: {
    type: String,
    default: null,
    index: true
  },
  adminName: {
    type: String,
    default: null
  },
  shuttleId: {
    type: String,
    default: null,
    index: true
  },
  routeId: {
    type: String,
    default: null
  },
  tripId: {
    type: String,
    default: null
  },
  
  // Department and entity classification
  department: {
    type: String,
    enum: ['motorpool', 'merchant', 'treasury', 'accounting', 'system', 'sysad'],
    default: null,
    index: true
  },
  targetEntity: {
    type: String,
    enum: ['driver', 'shuttle', 'route', 'trip', 'phone', 'user', 'transaction', 'merchant', 'admin', 'concern', 'config'],
    default: null,
    index: true
  },
  
  // IP and location
  ipAddress: {
    type: String,
    default: null
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  
  // Additional data (flexible JSON)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'resolved', 'archived'],
    default: 'active'
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
EventLogSchema.index({ eventType: 1, timestamp: -1 });
EventLogSchema.index({ severity: 1, timestamp: -1 });
EventLogSchema.index({ userId: 1, timestamp: -1 });
EventLogSchema.index({ driverId: 1, timestamp: -1 });
EventLogSchema.index({ shuttleId: 1, timestamp: -1 });
EventLogSchema.index({ department: 1, timestamp: -1 });
EventLogSchema.index({ targetEntity: 1, timestamp: -1 });
EventLogSchema.index({ adminId: 1, timestamp: -1 });

// Auto-archive old logs (older than 90 days)
EventLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export default mongoose.model('EventLog', EventLogSchema);