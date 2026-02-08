// src/pages/user/UserProfile.jsx
// User Profile Page with Profile and Security tabs - Mobile Responsive
// UPDATED: Simplified deactivation - No reason required, immediate deactivation after OTP verification

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import { User, Shield, Eye, EyeOff, AlertTriangle, CheckCircle, X } from 'lucide-react';

export default function UserProfile() {
  const { theme, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // PIN change state with OTP
  const [pinStep, setPinStep] = useState(1); // 1: Enter PINs, 2: Enter OTP
  const [pinForm, setPinForm] = useState({
    currentPin: '',
    newPin: '',
    confirmPin: '',
    otp: ''
  });
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [showPinSuccess, setShowPinSuccess] = useState(false);

  // Deactivation state - Desktop: step-by-step in card, Mobile: modal
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateStep, setDeactivateStep] = useState(1); // 1: Initial/Send OTP, 2: Enter OTP
  const [deactivateOtp, setDeactivateOtp] = useState('');
  const [sendingDeactivationOtp, setSendingDeactivationOtp] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const storedData = localStorage.getItem('userData');
      if (storedData && storedData !== 'undefined' && storedData !== 'null') {
        const parsed = JSON.parse(storedData);
        setUserData(parsed);
      }

      const data = await api.get('/user/profile');
      if (data) {
        setUserData(data);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // PIN CHANGE HANDLERS
  // ============================================================

  const handleSendPinOtp = async () => {
    if (!pinForm.currentPin || pinForm.currentPin.length !== 6) {
      setPinError('Current PIN must be exactly 6 digits');
      return;
    }

    if (!pinForm.newPin || pinForm.newPin.length !== 6) {
      setPinError('New PIN must be exactly 6 digits');
      return;
    }

    if (!pinForm.confirmPin || pinForm.confirmPin.length !== 6) {
      setPinError('Please confirm your new PIN');
      return;
    }

    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinError('New PIN and Confirm PIN do not match');
      return;
    }

    if (pinForm.currentPin === pinForm.newPin) {
      setPinError('New PIN must be different from current PIN');
      return;
    }

    setSendingOtp(true);
    setPinError('');

    try {
      const data = await api.post('/user/send-pin-change-otp', {
        currentPin: pinForm.currentPin,
        newPin: pinForm.newPin
      });

      if (data?.success) {
        toast.success('Verification code sent to your email');
        setPinStep(2); // Move to OTP step
      }
    } catch (error) {
      setPinError(error.message || 'Failed to send verification code. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyPinOtp = async () => {
    if (!pinForm.otp || pinForm.otp.length !== 6) {
      setPinError('Please enter the 6-digit verification code');
      return;
    }

    setChangingPin(true);
    setPinError('');

    try {
      const data = await api.post('/user/change-pin', {
        otp: pinForm.otp
      });

      if (data?.success) {
        setShowPinSuccess(true);
        setPinError('');
      }
    } catch (error) {
      setPinError(error.message || 'Failed to change PIN. Please try again.');
    } finally {
      setChangingPin(false);
    }
  };

  const resetPinForm = () => {
    setPinStep(1);
    setPinForm({ currentPin: '', newPin: '', confirmPin: '', otp: '' });
    setPinError('');
    setShowPinSuccess(false);
    setShowCurrentPin(false);
    setShowNewPin(false);
    setShowConfirmPin(false);
  };

  const handleBackToPinStep1 = () => {
    setPinStep(1);
    setPinForm({ ...pinForm, otp: '' });
    setPinError('');
  };

  const handleResendPinOtp = async () => {
    // Resend using the same PINs
    setSendingOtp(true);
    setPinError('');

    try {
      const data = await api.post('/user/send-pin-change-otp', {
        currentPin: pinForm.currentPin,
        newPin: pinForm.newPin
      });

      if (data?.success) {
        toast.success('Verification code resent to your email');
      }
    } catch (error) {
      setPinError(error.message || 'Failed to resend verification code.');
    } finally {
      setSendingOtp(false);
    }
  };

  // ============================================================
  // DEACTIVATION HANDLERS - Desktop: step-by-step, Mobile: modal
  // ============================================================

  const handleRequestDeactivationDesktop = async () => {
    // Desktop: Send OTP and move to step 2 in the same card
    setSendingDeactivationOtp(true);
    setDeactivateError('');

    try {
      const data = await api.post('/user/send-deactivation-otp');

      if (data?.success) {
        toast.success('Verification code sent to your email');
        setDeactivateStep(2); // Move to OTP entry step
      }
    } catch (error) {
      console.error('Send deactivation OTP error:', error);
      toast.error(error.message || 'Failed to send verification code');
      setDeactivateError(error.message || 'Failed to send verification code');
    } finally {
      setSendingDeactivationOtp(false);
    }
  };

  const handleRequestDeactivationMobile = async () => {
    // Mobile: Send OTP and open modal
    setSendingDeactivationOtp(true);
    setDeactivateError('');

    try {
      const data = await api.post('/user/send-deactivation-otp');

      if (data?.success) {
        toast.success('Verification code sent to your email');
        setShowDeactivateModal(true); // Open modal
      }
    } catch (error) {
      console.error('Send deactivation OTP error:', error);
      toast.error(error.message || 'Failed to send verification code');
      setDeactivateError(error.message || 'Failed to send verification code');
    } finally {
      setSendingDeactivationOtp(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (!deactivateOtp || deactivateOtp.length !== 6) {
      setDeactivateError('Please enter the 6-digit verification code');
      return;
    }

    setDeactivating(true);
    setDeactivateError('');

    try {
      const data = await api.post('/user/deactivate-account', {
        otp: deactivateOtp
      });

      if (data?.success) {
        toast.success('Account deactivated successfully');
        
        // 🔥 FORCE LOGOUT - Clear all auth data
        setTimeout(() => {
          localStorage.removeItem('userToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminData');
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');

          // Redirect to login with deactivation message
          window.location.href = '/login?deactivated=true';
        }, 1500);
      }
    } catch (error) {
      console.error('Deactivation error:', error);
      setDeactivateError(error.message || 'Failed to deactivate account');
    } finally {
      setDeactivating(false);
    }
  };

  const handleCancelDeactivation = () => {
    setDeactivateStep(1);
    setDeactivateOtp('');
    setDeactivateError('');
    setShowDeactivateModal(false);
  };

  const handleBackToDeactivateStep1 = () => {
    setDeactivateStep(1);
    setDeactivateOtp('');
    setDeactivateError('');
  };

  const handleResendDeactivationOtp = async () => {
    setSendingDeactivationOtp(true);
    setDeactivateError('');

    try {
      const data = await api.post('/user/send-deactivation-otp');

      if (data?.success) {
        toast.success('Verification code resent to your email');
      }
    } catch (error) {
      setDeactivateError(error.message || 'Failed to resend verification code');
    } finally {
      setSendingDeactivationOtp(false);
    }
  };

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const getInitials = () => {
    if (!userData) return '?';
    const first = userData.firstName?.[0] || '';
    const last = userData.lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 20px',
        color: 'rgba(251, 251, 251, 0.6)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255, 212, 28, 0.2)',
          borderTopColor: '#FFD41C',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const renderPersonalInfo = () => (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '16px',
      border: '1px solid rgba(255,212,28,0.2)',
      overflow: 'hidden'
    }}>
      {/* Profile Header */}
      <div className="profile-header" style={{
        background: 'linear-gradient(135deg, rgba(255,212,28,0.2) 0%, rgba(255,212,28,0.05) 100%)',
        padding: '40px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        borderBottom: '1px solid rgba(255,212,28,0.2)'
      }}>
        {/* Avatar */}
        <div className="profile-avatar" style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FFD41C 0%, #F59E0B 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          fontWeight: 800,
          color: '#181D40',
          boxShadow: '0 0 0 6px rgba(255,212,28,0.2)',
          flexShrink: 0
        }}>
          {getInitials()}
        </div>

        {/* Name and Role */}
        <div style={{ minWidth: 0 }}>
          <h2 className="profile-name" style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#FBFBFB',
            margin: '0 0 8px 0',
            wordBreak: 'break-word'
          }}>
            {userData?.firstName} {userData?.lastName}
          </h2>
          <div style={{
            display: 'inline-block',
            padding: '6px 16px',
            background: 'rgba(255,212,28,0.2)',
            border: '1px solid rgba(255,212,28,0.4)',
            borderRadius: '20px',
            color: '#FFD41C',
            fontSize: '13px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {userData?.role || 'Student'}
          </div>
        </div>
      </div>

      {/* Personal Info Grid */}
      <div style={{ padding: '32px' }}>
        <div className="info-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '24px'
        }}>
          <InfoField label="First Name" value={userData?.firstName || 'N/A'} />
          <InfoField label="Last Name" value={userData?.lastName || 'N/A'} />
          <InfoField label="Email Address" value={userData?.email || 'N/A'} fullWidth />
          <InfoField label="School ID" value={userData?.schoolUId || 'N/A'} />
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '16px',
      border: '1px solid rgba(255,212,28,0.2)',
      overflow: 'hidden'
    }}>
      {/* Security Header */}
      <div style={{
        background: 'rgba(255,212,28,0.05)',
        padding: '24px 32px',
        borderBottom: '1px solid rgba(255,212,28,0.2)'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#FFD41C',
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>🔐</span> Security Settings
        </h3>
        <p style={{
          fontSize: '14px',
          color: 'rgba(251,251,251,0.6)',
          margin: 0
        }}>
          Manage your PIN and account security
        </p>
      </div>

      <div style={{ padding: '32px' }}>
        {/* Error Alert */}
        {pinError && (
          <div style={{
            padding: '14px 20px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#EF4444',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⚠️</span>
            <span>{pinError}</span>
          </div>
        )}

        <div className="security-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {/* Change PIN Section */}
          <div className="pin-section" style={{
            padding: '24px',
            background: 'rgba(255, 212, 28, 0.1)',
            border: '2px solid rgba(255, 212, 28, 0.3)',
            borderRadius: '12px'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#FFD41C',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🔑</span> Change PIN
            </h4>

            {/* Step 1: Enter PINs */}
            {pinStep === 1 && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFD41C',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Current PIN (6 digits) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPin ? 'text' : 'password'}
                      value={pinForm.currentPin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPinForm({ ...pinForm, currentPin: value });
                        setPinError('');
                      }}
                      disabled={sendingOtp}
                      placeholder="••••••"
                      maxLength="6"
                      className="pin-input"
                      style={{
                        width: '100%',
                        padding: '14px 45px 14px 14px',
                        border: '2px solid rgba(255, 212, 28, 0.3)',
                        borderRadius: '10px',
                        background: 'rgba(251, 251, 251, 0.05)',
                        color: 'rgba(251, 251, 251, 0.9)',
                        fontSize: '24px',
                        fontWeight: 700,
                        letterSpacing: '12px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPin(!showCurrentPin)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(251, 251, 251, 0.5)',
                        padding: '4px'
                      }}
                    >
                      {showCurrentPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFD41C',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    New PIN (6 digits) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPin ? 'text' : 'password'}
                      value={pinForm.newPin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPinForm({ ...pinForm, newPin: value });
                        setPinError('');
                      }}
                      disabled={sendingOtp}
                      placeholder="••••••"
                      maxLength="6"
                      className="pin-input"
                      style={{
                        width: '100%',
                        padding: '14px 45px 14px 14px',
                        border: '2px solid rgba(255, 212, 28, 0.3)',
                        borderRadius: '10px',
                        background: 'rgba(251, 251, 251, 0.05)',
                        color: 'rgba(251, 251, 251, 0.9)',
                        fontSize: '24px',
                        fontWeight: 700,
                        letterSpacing: '12px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin(!showNewPin)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(251, 251, 251, 0.5)',
                        padding: '4px'
                      }}
                    >
                      {showNewPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFD41C',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Confirm New PIN (6 digits) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPin ? 'text' : 'password'}
                      value={pinForm.confirmPin}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setPinForm({ ...pinForm, confirmPin: value });
                        setPinError('');
                      }}
                      disabled={sendingOtp}
                      placeholder="••••••"
                      maxLength="6"
                      className="pin-input"
                      style={{
                        width: '100%',
                        padding: '14px 45px 14px 14px',
                        border: '2px solid rgba(255, 212, 28, 0.3)',
                        borderRadius: '10px',
                        background: 'rgba(251, 251, 251, 0.05)',
                        color: 'rgba(251, 251, 251, 0.9)',
                        fontSize: '24px',
                        fontWeight: 700,
                        letterSpacing: '12px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPin(!showConfirmPin)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(251, 251, 251, 0.5)',
                        padding: '4px'
                      }}
                    >
                      {showConfirmPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p style={{
                    fontSize: '11px',
                    color: 'rgba(251, 251, 251, 0.5)',
                    marginTop: '8px',
                    marginBottom: 0
                  }}>
                    Must match the new PIN above
                  </p>
                </div>

                <button
                  onClick={handleSendPinOtp}
                  disabled={sendingOtp || pinForm.currentPin.length !== 6 || pinForm.newPin.length !== 6 || pinForm.confirmPin.length !== 6}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: sendingOtp || pinForm.currentPin.length !== 6 || pinForm.newPin.length !== 6 || pinForm.confirmPin.length !== 6
                      ? 'rgba(255, 212, 28, 0.3)'
                      : '#FFD41C',
                    color: '#181D40',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: sendingOtp || pinForm.currentPin.length !== 6 || pinForm.newPin.length !== 6 || pinForm.confirmPin.length !== 6
                      ? 'not-allowed'
                      : 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {sendingOtp ? (
                    <>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(24, 29, 64, 0.3)',
                        borderTopColor: '#181D40',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>📧</span>
                      <span>Send OTP</span>
                    </>
                  )}
                </button>
              </>
            )}

            {/* Step 2: Enter OTP */}
            {pinStep === 2 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: '28px'
                  }}>
                    📧
                  </div>
                  <p style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#FBFBFB',
                    marginBottom: '8px'
                  }}>
                    Check your email
                  </p>
                  <p style={{
                    fontSize: '12px',
                    color: 'rgba(251, 251, 251, 0.7)',
                    lineHeight: '1.5',
                    margin: 0
                  }}>
                    We sent a 6-digit code to<br />
                    <strong style={{ color: '#FFD41C' }}>{userData?.email}</strong>
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FFD41C',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textAlign: 'center'
                  }}>
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    value={pinForm.otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPinForm({ ...pinForm, otp: value });
                      setPinError('');
                    }}
                    maxLength={6}
                    placeholder="••••••"
                    disabled={changingPin}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: 'rgba(251, 251, 251, 0.05)',
                      border: '2px solid rgba(255, 212, 28, 0.3)',
                      borderRadius: '10px',
                      color: 'rgba(251, 251, 251, 0.9)',
                      fontSize: '28px',
                      fontWeight: 700,
                      letterSpacing: '0.5em',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace'
                    }}
                  />
                  <p style={{
                    fontSize: '11px',
                    color: 'rgba(251, 251, 251, 0.5)',
                    textAlign: 'center',
                    marginTop: '12px',
                    marginBottom: 0
                  }}>
                    Didn't receive the code?{' '}
                    <button
                      onClick={handleResendPinOtp}
                      disabled={sendingOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#FFD41C',
                        fontWeight: 700,
                        cursor: sendingOtp ? 'not-allowed' : 'pointer',
                        textDecoration: 'underline',
                        opacity: sendingOtp ? 0.5 : 1
                      }}
                    >
                      {sendingOtp ? 'Sending...' : 'Resend'}
                    </button>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleBackToPinStep1}
                    disabled={changingPin}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: 'rgba(251, 251, 251, 0.1)',
                      color: 'rgba(251, 251, 251, 0.7)',
                      border: '1px solid rgba(251, 251, 251, 0.2)',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: changingPin ? 'not-allowed' : 'pointer',
                      opacity: changingPin ? 0.5 : 1
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleVerifyPinOtp}
                    disabled={changingPin || pinForm.otp.length !== 6}
                    style={{
                      flex: 1,
                      padding: '14px',
                      background: changingPin || pinForm.otp.length !== 6 ? 'rgba(255, 212, 28, 0.3)' : '#FFD41C',
                      color: '#181D40',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: changingPin || pinForm.otp.length !== 6 ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {changingPin ? (
                      <>
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid rgba(24, 29, 64, 0.3)',
                          borderTopColor: '#181D40',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      'Verify & Change PIN'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Deactivate Account Section - Desktop Card with Step-by-Step */}
          <div className="deactivate-section-desktop" style={{
            padding: '24px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#EF4444',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle className="w-5 h-5" />
                Deactivate Account
              </h4>
              {deactivateStep === 2 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'rgba(251, 251, 251, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Step 2 of 2
                </span>
              )}
            </div>

            {/* Error Alert */}
            {deactivateError && (
              <div style={{
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                color: '#EF4444',
                fontSize: '12px',
                fontWeight: 600,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚠️</span>
                <span>{deactivateError}</span>
              </div>
            )}

            {/* Step 1: Initial Warning + Send OTP */}
            {deactivateStep === 1 && (
              <>
                <div style={{
                  textAlign: 'center',
                  marginBottom: '20px',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    fontSize: '36px'
                  }}>
                    🔒
                  </div>

                  <p style={{
                    fontSize: '13px',
                    color: 'rgba(251, 251, 251, 0.7)',
                    marginBottom: '16px',
                    lineHeight: '1.6'
                  }}>
                    Temporarily disable your account while keeping all data and balance intact. 
                    <span className="desktop-break"><br /></span>
                    You may reactivate it anytime through ITSO.
                  </p>

                  <div style={{
                    padding: '12px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '2px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    maxWidth: '450px',
                  }}>
                    <p style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#F59E0B',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: 'center'
                    }}>
                      ⚠️ Important
                    </p>
                    <p style={{
                      fontSize: '11px',
                      color: 'rgba(251, 251, 251, 0.7)',
                      margin: 0,
                      lineHeight: '1.4',
                      textAlign: 'center'
                    }}>
                      Once deactivated, you will not be able to access your account until it is reactivated.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRequestDeactivationDesktop}
                  disabled={sendingDeactivationOtp}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: sendingDeactivationOtp ? 'rgba(239, 68, 68, 0.5)' : '#EF4444',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: sendingDeactivationOtp ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {sendingDeactivationOtp ? (
                    <>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTopColor: '#FFFFFF',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>📧</span>
                      <span>Send Verification Code</span>
                    </>
                  )}
                </button>
              </>
            )}

            {/* Step 2: OTP Entry */}
            {deactivateStep === 2 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    fontSize: '28px'
                  }}>
                    📧
                  </div>
                  <p style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#FBFBFB',
                    marginBottom: '6px'
                  }}>
                    Check your email
                  </p>
                  <p style={{
                    fontSize: '11px',
                    color: 'rgba(251, 251, 251, 0.7)',
                    lineHeight: '1.4',
                    margin: 0
                  }}>
                    We sent a code to<br />
                    <strong style={{ color: '#FFD41C' }}>{userData?.email}</strong>
                  </p>
                </div>

                <div style={{ marginBottom: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#FBFBFB',
                    marginBottom: '8px',
                    textAlign: 'center'
                  }}>
                    Enter verification code
                  </label>
                  <input
                    type="text"
                    value={deactivateOtp}
                    onChange={(e) => {
                      setDeactivateOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setDeactivateError('');
                    }}
                    maxLength={6}
                    placeholder="••••••"
                    disabled={deactivating}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'rgba(251, 251, 251, 0.05)',
                      border: '2px solid rgba(255, 212, 28, 0.3)',
                      borderRadius: '10px',
                      color: 'rgba(251, 251, 251, 0.9)',
                      fontSize: '24px',
                      fontWeight: 700,
                      letterSpacing: '0.5em',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace'
                    }}
                  />
                  <p style={{
                    fontSize: '10px',
                    color: 'rgba(251, 251, 251, 0.5)',
                    textAlign: 'center',
                    marginTop: '10px',
                    marginBottom: 0
                  }}>
                    Didn't receive it?{' '}
                    <button
                      onClick={handleResendDeactivationOtp}
                      disabled={sendingDeactivationOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#FFD41C',
                        fontWeight: 700,
                        cursor: sendingDeactivationOtp ? 'not-allowed' : 'pointer',
                        textDecoration: 'underline',
                        opacity: sendingDeactivationOtp ? 0.5 : 1
                      }}
                    >
                      {sendingDeactivationOtp ? 'Sending...' : 'Resend'}
                    </button>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleBackToDeactivateStep1}
                    disabled={deactivating}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(251, 251, 251, 0.1)',
                      color: 'rgba(251, 251, 251, 0.7)',
                      border: '1px solid rgba(251, 251, 251, 0.2)',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: deactivating ? 'not-allowed' : 'pointer',
                      opacity: deactivating ? 0.5 : 1
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleDeactivateAccount}
                    disabled={deactivating || deactivateOtp.length !== 6}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: deactivating || deactivateOtp.length !== 6 ? 'rgba(239, 68, 68, 0.5)' : '#EF4444',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: deactivating || deactivateOtp.length !== 6 ? 'not-allowed' : 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {deactivating ? (
                      <>
                        <div style={{
                          width: '14px',
                          height: '14px',
                          border: '2px solid rgba(255, 255, 255, 0.3)',
                          borderTopColor: '#FFFFFF',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        <span>Deactivating...</span>
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Deactivate Account Section - Mobile Button with Alert */}
          <div className="deactivate-section-mobile" style={{
            padding: '24px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            display: 'none',
            flexDirection: 'column'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#EF4444',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle className="w-5 h-5" />
              Deactivate Account
            </h4>

            <p style={{
              fontSize: '13px',
              color: 'rgba(251, 251, 251, 0.7)',
              marginBottom: '16px',
              lineHeight: '1.6',
              flex: 1
            }}>
              Temporarily disable your account while keeping all data and balance intact. You may reactivate it anytime through ITSO.
            </p>

            {/* Alert Message */}
            <div style={{
              padding: '14px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '2px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '10px',
              marginBottom: '16px'
            }}>
              <p style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#F59E0B',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                ⚠️ Warning
              </p>
              <p style={{
                fontSize: '12px',
                color: 'rgba(251, 251, 251, 0.7)',
                margin: 0,
                lineHeight: '1.5'
              }}>
                Once deactivated, you will not be able to access your account until it is reactivated.
              </p>
            </div>

            <button
              onClick={handleRequestDeactivationMobile}
              disabled={sendingDeactivationOtp}
              style={{
                padding: '12px 24px',
                background: sendingDeactivationOtp ? 'rgba(239, 68, 68, 0.5)' : '#EF4444',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: sendingDeactivationOtp ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {sendingDeactivationOtp ? (
                <>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#FFFFFF',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <span>Sending Code...</span>
                </>
              ) : (
                'Request Deactivation'
              )}
            </button>
          </div>
        </div>

        {/* Security Tips */}
        <div style={{
          padding: '20px',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px'
        }}>
          <h4 style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#3B82F6',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Shield className="w-4 h-4" />
            Security Tips
          </h4>
          <ul style={{
            fontSize: '13px',
            color: 'rgba(251, 251, 251, 0.7)',
            margin: 0,
            paddingLeft: '20px',
            lineHeight: '1.6'
          }}>
            <li>Never share your PIN with anyone</li>
            <li>Change your PIN regularly (every 3 months recommended)</li>
            <li>Use a PIN that's hard to guess (avoid birthdays, repeating numbers)</li>
            <li>Report any suspicious activity immediately</li>
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: '30px',
        borderBottom: '2px solid rgba(255,212,28,0.2)',
        paddingBottom: '20px'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#FFD41C',
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>👤</span> My Profile
        </h2>
        <p style={{
          fontSize: '13px',
          color: 'rgba(251,251,251,0.6)',
          margin: 0
        }}>
          Manage your account information and security settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation" style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '30px'
      }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'profile'
              ? 'rgba(255, 212, 28, 0.15)'
              : 'rgba(30, 35, 71, 0.4)',
            border: activeTab === 'profile'
              ? '2px solid rgba(255, 212, 28, 0.4)'
              : '2px solid rgba(255, 212, 28, 0.1)',
            borderRadius: '12px',
            color: activeTab === 'profile'
              ? '#FFD41C'
              : 'rgba(251, 251, 251, 0.7)',
            fontSize: '14px',
            fontWeight: activeTab === 'profile' ? 700 : 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <span>📋</span>
          <span className="tab-text">Personal Information</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'security'
              ? 'rgba(255, 212, 28, 0.15)'
              : 'rgba(30, 35, 71, 0.4)',
            border: activeTab === 'security'
              ? '2px solid rgba(255, 212, 28, 0.4)'
              : '2px solid rgba(255, 212, 28, 0.1)',
            borderRadius: '12px',
            color: activeTab === 'security'
              ? '#FFD41C'
              : 'rgba(251, 251, 251, 0.7)',
            fontSize: '14px',
            fontWeight: activeTab === 'security' ? 700 : 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <span>🔐</span>
          <span className="tab-text">Security Settings</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'profile' && renderPersonalInfo()}
      {activeTab === 'security' && renderSecuritySettings()}

      {/* PIN Success Modal */}
      {showPinSuccess && (
        <div
          onClick={resetPinForm}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1E2347',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              border: '2px solid rgba(34, 197, 94, 0.3)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              padding: '24px 32px',
              borderBottom: '2px solid rgba(34, 197, 94, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle className="w-6 h-6" style={{ color: '#22C55E' }} />
                  <div>
                    <h2 style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#22C55E',
                      margin: 0
                    }}>
                      PIN Changed Successfully!
                    </h2>
                  </div>
                </div>
                <button
                  onClick={resetPinForm}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(251, 251, 251, 0.7)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '40px 32px', textAlign: 'center' }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: '48px'
              }}>
                ✅
              </div>
              
              <p style={{
                fontSize: '15px',
                color: 'rgba(251, 251, 251, 0.9)',
                marginBottom: '12px',
                lineHeight: '1.6',
                fontWeight: 600
              }}>
                Your PIN has been updated successfully.
              </p>
              
              <p style={{
                fontSize: '14px',
                color: 'rgba(251, 251, 251, 0.6)',
                marginBottom: 0,
                lineHeight: '1.5'
              }}>
                Please use your new PIN for future logins.
              </p>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 32px 32px',
              borderTop: '1px solid rgba(255, 212, 28, 0.1)'
            }}>
              <button
                onClick={resetPinForm}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#22C55E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s ease'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate OTP Modal - Mobile Only (OTP Entry) */}
      {showDeactivateModal && (
        <div
          onClick={handleCancelDeactivation}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1E2347',
              borderRadius: '16px',
              maxWidth: '460px',
              width: '100%',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              padding: '24px 32px',
              borderBottom: '2px solid rgba(239, 68, 68, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertTriangle className="w-6 h-6" style={{ color: '#EF4444' }} />
                  <div>
                    <h2 style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#EF4444',
                      margin: 0
                    }}>
                      Verify Deactivation
                    </h2>
                  </div>
                </div>
                <button
                  onClick={handleCancelDeactivation}
                  disabled={deactivating}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(251, 251, 251, 0.7)',
                    cursor: deactivating ? 'not-allowed' : 'pointer',
                    padding: '4px',
                    opacity: deactivating ? 0.5 : 1
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '32px' }}>
              {/* Error Alert */}
              {deactivateError && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '2px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  color: '#EF4444',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>⚠️</span>
                  <span>{deactivateError}</span>
                </div>
              )}

              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: '36px'
                }}>
                  📧
                </div>
                <p style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#FBFBFB',
                  marginBottom: '8px'
                }}>
                  Check your email
                </p>
                <p style={{
                  fontSize: '13px',
                  color: 'rgba(251, 251, 251, 0.7)',
                  lineHeight: '1.5'
                }}>
                  We sent a 6-digit verification code to<br />
                  <strong style={{ color: '#FFD41C' }}>{userData?.email}</strong>
                </p>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#FBFBFB',
                  marginBottom: '8px',
                  textAlign: 'center'
                }}>
                  Enter verification code
                </label>
                <input
                  type="text"
                  value={deactivateOtp}
                  onChange={(e) => {
                    setDeactivateOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setDeactivateError('');
                  }}
                  maxLength={6}
                  placeholder="••••••"
                  disabled={deactivating}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: 'rgba(251, 251, 251, 0.05)',
                    border: '2px solid rgba(255, 212, 28, 0.3)',
                    borderRadius: '10px',
                    color: 'rgba(251, 251, 251, 0.9)',
                    fontSize: '28px',
                    fontWeight: 700,
                    letterSpacing: '0.5em',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <p style={{
                fontSize: '12px',
                color: 'rgba(251, 251, 251, 0.5)',
                textAlign: 'center',
                marginTop: '16px',
                marginBottom: 0
              }}>
                Didn't receive the code?{' '}
                <button
                  onClick={handleResendDeactivationOtp}
                  disabled={sendingDeactivationOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FFD41C',
                    fontWeight: 700,
                    cursor: sendingDeactivationOtp ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    opacity: sendingDeactivationOtp ? 0.5 : 1
                  }}
                >
                  {sendingDeactivationOtp ? 'Sending...' : 'Resend code'}
                </button>
              </p>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              gap: '12px',
              padding: '16px 32px 32px',
              borderTop: '1px solid rgba(255, 212, 28, 0.1)'
            }}>
              <button
                onClick={handleCancelDeactivation}
                disabled={deactivating}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: 'rgba(251, 251, 251, 0.1)',
                  color: 'rgba(251, 251, 251, 0.7)',
                  border: '1px solid rgba(251, 251, 251, 0.2)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: deactivating ? 'not-allowed' : 'pointer',
                  opacity: deactivating ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivateAccount}
                disabled={deactivating || deactivateOtp.length !== 6}
                style={{
                  flex: 1,
                  padding: '14px',
                  background: deactivating || deactivateOtp.length !== 6 ? 'rgba(239, 68, 68, 0.5)' : '#EF4444',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: deactivating || deactivateOtp.length !== 6 ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {deactivating ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTopColor: '#FFFFFF',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    <span>Deactivating...</span>
                  </>
                ) : (
                  'Confirm Deactivation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations and Mobile Responsive Styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Desktop: Show card, hide mobile button */
        .deactivate-section-desktop {
          display: flex !important;
        }
        .deactivate-section-mobile {
          display: none !important;
        }

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          /* Hide desktop deactivation card, show mobile button */
          .deactivate-section-desktop {
            display: none !important;
          }
          .deactivate-section-mobile {
            display: flex !important;
          }

          /* Profile Header - Stack vertically on mobile */
          .profile-header {
            flex-direction: column !important;
            text-align: center !important;
            padding: 24px !important;
          }

          .profile-avatar {
            width: 80px !important;
            height: 80px !important;
            font-size: 32px !important;
          }

          .profile-name {
            font-size: 22px !important;
          }

          /* Personal Info Grid - Single column on mobile */
          .info-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }

          /* Tab Navigation - Smaller text on mobile */
          .tab-navigation {
            gap: 8px !important;
          }

          .tab-navigation button {
            padding: 10px 16px !important;
            font-size: 13px !important;
          }

          .tab-text {
            display: none !important;
          }

          .tab-navigation button span:first-child {
            font-size: 18px !important;
          }

          /* Security Grid - Stack vertically on mobile */
          .security-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }

          /* PIN Section - Full width on mobile */
          .pin-section {
            order: 1 !important;
          }

          /* Deactivate Section - Show mobile version */
          .deactivate-section-mobile {
            display: flex !important;
            order: 2 !important;
          }

          /* PIN Input - Smaller font on mobile */
          .pin-input {
            font-size: 20px !important;
            letter-spacing: 8px !important;
            padding: 12px 40px 12px 12px !important;
          }
        }

        @media (max-width: 480px) {
          .profile-avatar {
            width: 70px !important;
            height: 70px !important;
            font-size: 28px !important;
            box-shadow: 0 0 0 4px rgba(255,212,28,0.2) !important;
          }

          .profile-name {
            font-size: 20px !important;
          }

          .pin-input {
            font-size: 18px !important;
            letter-spacing: 6px !important;
          }
        }
      `}</style>
    </div>
  );
}

// Info Field Component
function InfoField({ label, value, highlight, fullWidth }) {
  const getHighlightColor = () => {
    if (highlight === 'success') return { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', color: '#22C55E' };
    if (highlight === 'error') return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', color: '#EF4444' };
    if (highlight === 'warning') return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', color: '#F59E0B' };
    return null;
  };

  const highlightStyle = getHighlightColor();

  return (
    <div style={{
      gridColumn: fullWidth ? '1 / -1' : 'span 1'
    }}>
      <label style={{
        display: 'block',
        marginBottom: '8px',
        fontSize: '11px',
        fontWeight: 700,
        color: 'rgba(255,212,28,0.8)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </label>
      <div style={{
        padding: '12px 16px',
        background: highlightStyle ? highlightStyle.bg : 'rgba(251,251,251,0.05)',
        border: `1px solid ${highlightStyle ? highlightStyle.border : 'rgba(255,212,28,0.1)'}`,
        borderRadius: '8px',
        color: highlightStyle ? highlightStyle.color : 'rgba(251,251,251,0.9)',
        fontSize: '15px',
        fontWeight: highlight ? 700 : 500,
        wordBreak: 'break-word'
      }}>
        {value || 'N/A'}
      </div>
    </div>
  );
}