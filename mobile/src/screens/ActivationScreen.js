// src/screens/ActivationScreen.js
// Account activation flow for new users (isActive: false, isDeactivated: false)
// Steps: 1. Terms & Conditions → 2. Set New PIN → 3. Verify OTP → 4. Success

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Vibration,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';

const PIN_LENGTH = 6;

export default function ActivationScreen({ navigation, route }) {
  const { accountId, accountType, email, fullName } = route.params || {};

  const [step, setStep] = useState('terms'); // 'terms', 'pin', 'otp', 'success'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [otp, setOtp] = useState('');
  const [shakeAnim] = useState(new Animated.Value(0));

  const shakeError = useCallback(() => {
    if (Platform.OS !== 'web') {
      try { Vibration.vibrate(100); } catch (e) {}
    }
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Step 1: Accept Terms
  const handleAcceptTerms = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/activation/accept-terms', { accountId, accountType });
      if (res.data?.success) {
        setStep('pin');
      } else {
        throw new Error(res.data?.error || 'Failed to accept terms');
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Failed to accept terms';
      setError(msg);
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Set New PIN
  const handleSetPin = async () => {
    if (newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) {
      setError(`PIN must be exactly ${PIN_LENGTH} digits`);
      shakeError();
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setError('PIN must contain only numbers');
      shakeError();
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      shakeError();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/activation/set-new-pin', { accountId, accountType, newPin });
      if (res.data?.success) {
        setStep('otp');
      } else {
        throw new Error(res.data?.error || 'Failed to set PIN');
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Failed to set PIN';
      setError(msg);
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify OTP
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter the 6-digit code');
      shakeError();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/activation/verify-otp', { accountId, accountType, otp });
      if (res.data?.success) {
        setStep('success');
      } else {
        throw new Error(res.data?.error || 'Invalid OTP');
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Invalid OTP';
      setError(msg);
      shakeError();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/activation/resend-otp', { accountId, accountType });
      if (res.data?.success) {
        Alert.alert('OTP Sent', 'A new verification code has been sent to your email.');
      } else {
        throw new Error(res.data?.error || 'Failed to resend OTP');
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Failed to resend OTP';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Back to login
  const handleBackToLogin = () => {
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>
                {step === 'success' ? '✅' : '🔐'}
              </Text>
            </View>
            <Text style={styles.title}>
              {step === 'terms' ? 'Account Activation' :
               step === 'pin' ? 'Set Your PIN' :
               step === 'otp' ? 'Verify Email' :
               'Activation Complete!'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'success' ? '' : `Hello, ${fullName || 'User'}`}
            </Text>
          </View>

          {/* Error */}
          {error ? (
            <Animated.View style={[styles.errorBox, { transform: [{ translateX: shakeAnim }] }]}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          {/* ====== STEP: TERMS ====== */}
          {step === 'terms' && (
            <View style={styles.section}>
              <View style={styles.termsBox}>
                <Text style={styles.termsTitle}>Terms & Conditions</Text>
                <ScrollView style={styles.termsScroll} nestedScrollEnabled>
                  <Text style={styles.termsText}>
                    By activating your NUCash account, you agree to the following:{'\n\n'}
                    1. Your account is for personal use only and must not be shared.{'\n\n'}
                    2. You are responsible for all transactions made with your account.{'\n\n'}
                    3. You must keep your PIN confidential and secure.{'\n\n'}
                    4. Lost or stolen cards must be reported immediately to ITSO.{'\n\n'}
                    5. NUCash reserves the right to deactivate accounts that violate university policies.{'\n\n'}
                    6. Refunds are processed according to the university's refund policy.{'\n\n'}
                    7. Your transaction data may be used for university administrative purposes.
                  </Text>
                </ScrollView>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleAcceptTerms}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Processing...' : 'I Accept & Continue'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={handleBackToLogin}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ====== STEP: SET PIN ====== */}
          {step === 'pin' && (
            <View style={styles.section}>
              <Text style={styles.sectionInfo}>
                Create a new 6-digit PIN for your account. This will replace the temporary PIN.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={newPin}
                  onChangeText={(t) => { setNewPin(t.replace(/[^0-9]/g, '')); setError(''); }}
                  maxLength={PIN_LENGTH}
                  keyboardType="numeric"
                  secureTextEntry
                  placeholder="Enter 6-digit PIN"
                  placeholderTextColor="rgba(251,251,251,0.4)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={confirmPin}
                  onChangeText={(t) => { setConfirmPin(t.replace(/[^0-9]/g, '')); setError(''); }}
                  maxLength={PIN_LENGTH}
                  keyboardType="numeric"
                  secureTextEntry
                  placeholder="Re-enter PIN"
                  placeholderTextColor="rgba(251,251,251,0.4)"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSetPin}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Setting PIN...' : 'Set PIN & Send OTP'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ====== STEP: VERIFY OTP ====== */}
          {step === 'otp' && (
            <View style={styles.section}>
              <Text style={styles.sectionInfo}>
                A 6-digit verification code has been sent to {email}. Enter it below to activate your account.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                  maxLength={6}
                  keyboardType="numeric"
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="rgba(251,251,251,0.4)"
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Verifying...' : 'Verify & Activate'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleResendOtp}
                disabled={loading}
              >
                <Text style={styles.secondaryButtonText}>Resend Code</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ====== STEP: SUCCESS ====== */}
          {step === 'success' && (
            <View style={styles.section}>
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>🎉</Text>
                <Text style={styles.successTitle}>Account Activated!</Text>
                <Text style={styles.successText}>
                  Your account has been successfully activated. You can now log in with your new PIN.
                </Text>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleBackToLogin}>
                <Text style={styles.primaryButtonText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#181D40' },
  scrollContent: { flexGrow: 1 },
  container: { flex: 1, paddingHorizontal: 30, paddingTop: 30 },
  header: { alignItems: 'center', marginBottom: 30 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#35408E',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 3, borderColor: '#FFD41C',
  },
  logoIcon: { fontSize: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#FFD41C', marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(251,251,251,0.6)' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderLeftWidth: 4, borderLeftColor: '#EF4444',
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: '#EF4444', fontSize: 14, fontWeight: '500' },
  section: { marginBottom: 30 },
  sectionInfo: { color: 'rgba(251,251,251,0.7)', fontSize: 14, lineHeight: 20, marginBottom: 20, textAlign: 'center' },
  termsBox: {
    backgroundColor: '#1E1E1E', borderRadius: 16, borderWidth: 2, borderColor: '#35408E',
    padding: 16, marginBottom: 20, maxHeight: 300,
  },
  termsTitle: { fontSize: 16, fontWeight: '700', color: '#FFD41C', marginBottom: 12 },
  termsScroll: { maxHeight: 240 },
  termsText: { color: 'rgba(251,251,251,0.7)', fontSize: 13, lineHeight: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(251,251,251,0.8)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  pinInput: {
    backgroundColor: '#1E1E1E', borderRadius: 12, borderWidth: 2, borderColor: '#35408E',
    paddingHorizontal: 16, paddingVertical: 16, fontSize: 20, color: '#FBFBFB',
    textAlign: 'center', letterSpacing: 8,
  },
  otpInput: {
    backgroundColor: '#1E1E1E', borderRadius: 12, borderWidth: 2, borderColor: '#35408E',
    paddingHorizontal: 16, paddingVertical: 16, fontSize: 24, color: '#FBFBFB',
    textAlign: 'center', letterSpacing: 10,
  },
  primaryButton: {
    backgroundColor: '#FFD41C', paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: '#FFD41C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  buttonDisabled: { backgroundColor: '#B89A15', opacity: 0.7 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#181D40' },
  secondaryButton: { alignItems: 'center', paddingVertical: 16 },
  secondaryButtonText: { fontSize: 15, color: '#FFD41C', fontWeight: '600' },
  successBox: { alignItems: 'center', paddingVertical: 30 },
  successIcon: { fontSize: 60, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#10B981', marginBottom: 12 },
  successText: { fontSize: 15, color: 'rgba(251,251,251,0.7)', textAlign: 'center', lineHeight: 22 },
});
