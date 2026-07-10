// nucash-server/models/SystemAlert.js
// System-wide alerts/announcements posted by sysad and shown to end-users.

import mongoose from 'mongoose';

const systemAlertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  // Visual severity
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical', 'success'],
    default: 'info'
  },
  active: {
    type: Boolean,
    default: true
  },
  // Optional auto-hide: alert stops showing to end-users after this time.
  // null = never expires.
  expiresAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: String,
    default: 'System Administrator'
  }
}, { timestamps: true });

const SystemAlert = mongoose.models.SystemAlert || mongoose.model('SystemAlert', systemAlertSchema);
export default SystemAlert;
