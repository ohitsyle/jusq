// server/utils/linkedAccounts.js
// An admin can have their own NUCash employee wallet (Admin.linkedUserId <->
// User.linkedAdminId). One login — the admin's email + PIN — opens both, so
// the two PINs are kept identical and a PIN change on either side signs out
// the other side's devices too. Deactivation stays separate on purpose.

import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import User from '../models/User.js';

const secret = () => process.env.JWT_SECRET;

// JWT iat is whole seconds; flooring lets a token issued right after the
// change (for the device that made it) stay valid.
export const sessionCutoff = () => new Date(Math.floor(Date.now() / 1000) * 1000);

export const walletOf = (admin) => (admin?.linkedUserId ? User.findById(admin.linkedUserId) : null);
export const adminOf = (user) => (user?.linkedAdminId ? Admin.findById(user.linkedAdminId) : null);

// Wallet usable right now? Returns a reason when it isn't.
export function walletUnavailable(user) {
  if (!user) return 'missing';
  if (user.isDeactivated) return 'deactivated';
  if (!user.isActive) return 'inactive';
  if (user.transferLockedUntil && user.transferLockedUntil > new Date()) return 'locked';
  return null;
}

// Wallet session opened through the admin login (or a switch). `viaAdmin`
// is what later allows switching back to the admin side without a PIN.
export function issueWalletSession(user, admin) {
  const token = jwt.sign(
    { id: user._id, role: user.role, userId: user.userId, viaAdmin: String(admin._id) },
    secret(),
    { expiresIn: '24h' }
  );
  const name = user.fullName || `${user.firstName} ${user.lastName}`.trim();
  return {
    token,
    user: {
      role: user.role,
      userId: user._id.toString(),
      name,
      firstName: user.firstName,
      lastName: user.lastName,
      accountType: user.role,
      email: user.email,
      linkedAdmin: { role: admin.role }
    }
  };
}

export function issueAdminSession(admin) {
  const token = jwt.sign(
    { id: admin._id, role: admin.role || 'admin', adminId: admin.adminId },
    secret(),
    { expiresIn: '24h' }
  );
  const name = `${admin.firstName} ${admin.lastName}`.trim() || admin.email || 'Admin';
  return {
    token,
    admin: {
      _id: admin._id.toString(),
      role: admin.role || 'admin',
      adminId: admin.adminId,
      name,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      linkedUserId: admin.linkedUserId ? String(admin.linkedUserId) : null
    }
  };
}

// Admin PIN changed -> same PIN on the wallet, wallet's other devices signed out.
export async function copyPinToWallet(admin) {
  if (!admin?.linkedUserId) return;
  await User.updateOne({ _id: admin.linkedUserId }, { $set: { pin: admin.pin, pinChangedAt: new Date(), sessionsValidAfter: sessionCutoff() } });
}

// Wallet PIN changed -> same PIN on the admin account, admin's other devices signed out.
export async function copyPinToAdmin(user) {
  if (!user?.linkedAdminId) return;
  await Admin.updateOne({ _id: user.linkedAdminId }, { $set: { pin: user.pin, sessionsValidAfter: sessionCutoff() } });
}

// First activation (or re-activation after a reset) of the admin also
// switches the wallet on with the admin's new PIN — unless ITSO deactivated it.
export async function activateWalletWithAdmin(admin) {
  if (!admin?.linkedUserId) return null;
  const wallet = await User.findById(admin.linkedUserId);
  if (!wallet) return null;
  const set = { pin: admin.pin, pinChangedAt: new Date(), sessionsValidAfter: sessionCutoff() };
  if (!wallet.isDeactivated) set.isActive = true;
  await User.updateOne({ _id: wallet._id }, { $set: set });
  return wallet;
}
