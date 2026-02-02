// nucash-server/models/Configuration.js
// Model for system configurations (auto-exports, excuse slips, etc.)

import mongoose from 'mongoose';

const configurationSchema = new mongoose.Schema({
  configType: {
    type: String,
    enum: ['autoExport', 'excuseSlips', 'tabVisibility'],
    required: true
  },

  // Admin role (for role-specific configurations)
  // Combined with configType to create unique configurations per role
  adminRole: {
    type: String,
    enum: ['motorpool', 'merchant', 'treasury', 'sysad', 'global'],
    default: 'global'
  },

  // Auto Export Configuration
  autoExport: {
    enabled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom'],
      default: 'daily'
    },
    exportTypes: {
      type: [String],
      // Supports all admin export types: motorpool, merchant, treasury
      // Motorpool: Drivers, Routes, Trips, Shuttles, Phones, Logs, Concerns
      // Merchant: Merchants, Phones, Logs, Concerns
      // Treasury: Transactions, Cash-Ins, Users, Balances, Logs, Concerns
      default: []
    },
    time: {
      type: String,
      default: '00:00'
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      default: 0
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
      default: 1
    },
    emailRecipients: {
      type: [String],
      default: []
    }
  },

  // Excuse Slip Configuration
  excuseSlips: {
    enabled: {
      type: Boolean,
      default: true
    },
    validityHours: {
      type: Number,
      default: 24,
      min: 1
    },
    requireDriverApproval: {
      type: Boolean,
      default: true
    },
    template: {
      type: String,
      default: 'This is to certify that {studentName} ({schoolId}) was delayed due to shuttle service delay on {date}. Delay duration: {delayMinutes} minutes. Route: {routeName}.'
    }
  },

  // Tab Visibility Configuration
  tabVisibility: {
    home: { type: Boolean, default: true },
    drivers: { type: Boolean, default: true },
    shuttles: { type: Boolean, default: true },
    routes: { type: Boolean, default: true },
    phones: { type: Boolean, default: true },
    trips: { type: Boolean, default: true },
    concerns: { type: Boolean, default: true },
    promotions: { type: Boolean, default: true },
    configurations: { type: Boolean, default: true },
    logs: { type: Boolean, default: true }
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for unique configType + adminRole combinations
configurationSchema.index({ configType: 1, adminRole: 1 }, { unique: true });

// Update timestamp on save
configurationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Configuration = mongoose.model('Configuration', configurationSchema);

// Migration: Drop old unique index on configType and clean up legacy data
(async () => {
  try {
    // Drop old unique index on configType if it exists
    await Configuration.collection.dropIndex('configType_1').catch(() => {
      // Index doesn't exist, ignore error
    });

    // Also try to drop index without the _1 suffix
    await Configuration.collection.dropIndex('configType').catch(() => {
      // Index doesn't exist, ignore error
    });

    // Update any existing configurations that don't have adminRole set
    // Set them to 'global' so they don't interfere with role-specific queries
    await Configuration.updateMany(
      { adminRole: { $exists: false } },
      { $set: { adminRole: 'global' } }
    );

    await Configuration.updateMany(
      { adminRole: null },
      { $set: { adminRole: 'global' } }
    );

    console.log('Configuration model migration completed');
  } catch (error) {
    // Silently handle migration errors
  }
})();

export default Configuration;
