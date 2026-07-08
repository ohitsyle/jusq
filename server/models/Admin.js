// nucash-server/models/Admin.js
// Schema v3.0 - Admin model for motorpool and system administrators

import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  // Identity
  adminId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  schoolUId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Name
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  middleName: {
    type: String,
    default: '',
    trim: true
  },

  // Role & Permissions
  role: {
    type: String,
    enum: {
      values: ["motorpool", "merchant", "treasury", "accounting", "sysad", "marketing"],
      message: '{VALUE} is not a valid admin role'
    },
    required: true
  },

  // Contact & Authentication
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email address`
    }
  },

  // Security
  pin: {
    type: String,
    required: [true, 'PIN is required']
  },

  // Account Status
  // isActive: true when admin changes password from system-generated
  isActive: {
    type: Boolean,
    default: false
  },

  // Password Reset
  resetOtp: {
    type: String,
    default: ''
  },

  resetOtpExpireAt: {
    type: Number,
    default: 0
  },

  // Audit Trail
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Virtual field for full name
AdminSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.middleName ? this.middleName + ' ' : ''}${this.lastName}`.trim();
});

// Ensure virtuals are included in JSON
AdminSchema.set('toJSON', { virtuals: true });
AdminSchema.set('toObject', { virtuals: true });

// Indexes for efficient queries
// Note: email already has unique index from schema
AdminSchema.index({ role: 1 });
AdminSchema.index({ isActive: 1 });

// ============================================================
// ROOT ACCOUNT PROTECTION
// The primary sysad can never be deleted (or deactivated), so the
// system can never be locked out of administration. Enforced at the
// model level so EVERY code path is covered, not just the routes.
// ============================================================
export const PROTECTED_SYSAD_EMAIL = 'sysad@nu.edu.ph';

const PROTECTED_ERROR = 'This system administrator account is protected and cannot be deleted or deactivated.';

// NOTE: async query middleware must THROW (not call next(err)) in mongoose 8 —
// the resolved promise otherwise wins and the operation proceeds.
async function blockIfProtected() {
  const doc = await this.model.findOne(this.getFilter()).select('email role').lean();
  if (doc && doc.email?.toLowerCase() === PROTECTED_SYSAD_EMAIL) {
    throw new Error(PROTECTED_ERROR);
  }
}

AdminSchema.pre('findOneAndDelete', blockIfProtected);
AdminSchema.pre('deleteOne', { document: false, query: true }, blockIfProtected);

AdminSchema.pre('deleteMany', async function () {
  const wouldHit = await this.model.findOne({
    ...this.getFilter(),
    email: PROTECTED_SYSAD_EMAIL
  }).select('_id').lean();
  if (wouldHit) throw new Error(PROTECTED_ERROR);
});

// Block deactivation/role-change of the protected account on save/update paths.
AdminSchema.pre('save', function (next) {
  if (!this.isNew && this.email?.toLowerCase() === PROTECTED_SYSAD_EMAIL) {
    if (this.isModified('isDeactivated') && this.isDeactivated) return next(new Error(PROTECTED_ERROR));
    if (this.isModified('role') && this.role !== 'sysad') return next(new Error(PROTECTED_ERROR));
  }
  next();
});

async function blockProtectedUpdate() {
  const update = this.getUpdate() || {};
  // Changed fields can live at the top level AND in $set (timestamps plugin
  // always adds $set.updatedAt) — merge both before inspecting.
  const set = { ...update, ...(update.$set || {}) };
  const deactivating = set.isDeactivated === true;
  const demoting = set.role && set.role !== 'sysad';
  if (!deactivating && !demoting) return;
  const doc = await this.model.findOne(this.getFilter()).select('email').lean();
  if (doc && doc.email?.toLowerCase() === PROTECTED_SYSAD_EMAIL) {
    throw new Error(PROTECTED_ERROR);
  }
}

AdminSchema.pre('findOneAndUpdate', blockProtectedUpdate);
AdminSchema.pre('updateOne', { document: false, query: true }, blockProtectedUpdate);
AdminSchema.pre('updateMany', blockProtectedUpdate);

export default mongoose.model('Admin', AdminSchema);