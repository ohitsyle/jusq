// src/services/session.js
// Saves a successful /login response and opens the right home screen for the
// role. Shared by the login screen and account activation (which signs the
// person in with the PIN they just set).

import AsyncStorage from '@react-native-async-storage/async-storage';

// Replaces the whole screen history, so Back can't return to sign-in or
// activation. Returns false for a role the app doesn't handle.
export async function startSession(navigation, data) {
  const { role } = data;
  const open = (name, params) => navigation.reset({ index: 0, routes: [{ name, params }] });
  if (!['driver', 'merchant', 'student', 'employee'].includes(role)) return false;

  await AsyncStorage.setItem('auth_token', data.token);
  await AsyncStorage.setItem('user_role', role);

  if (role === 'driver') {
    await AsyncStorage.setItem('driver_id', data.driverId || '');
    open('ShuttleSelection', { driverId: data.driverId, name: data.name || 'Driver' });
  } else if (role === 'merchant') {
    await AsyncStorage.setItem('merchant_id', data.merchantId || '');
    open('Merchant', {
      merchantId: data.merchantId,
      businessName: data.businessName || 'Merchant',
      contactPerson: data.contactPerson || ''
    });
  } else {
    await AsyncStorage.setItem('user_id', data.userId || '');
    open('UserDashboard', {
      userId: data.userId,
      userEmail: data.email,
      role,
      name: data.name || 'User'
    });
  }
  return true;
}
