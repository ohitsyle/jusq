// src/admin/components/Profile/ProfilePage.jsx
// Full page for admin profile with personal info and password management

import React, { useState, useEffect } from 'react';
import { AlertTriangle, ClipboardList, Lock, Mail, Shield, User } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function ProfilePage() {
    const { theme, isDarkMode } = useTheme();
  const [adminData, setAdminData] = useState(() => {
    const data = localStorage.getItem('adminData');
    return data ? JSON.parse(data) : null;
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('personal'); // 'personal' or 'security'
  const [step, setStep] = useState(1); // For password change: 1: Enter PINs, 2: Enter OTP, 3: Success
  const [formData, setFormData] = useState({
    oldPin: '',
    newPin: '',
    confirmPin: '',
    otp: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // All admins (incl. the merchant department admin) are Admin records and
  // are reached via /admin/auth/*. The merchant logs in under merchantToken,
  // so fall back to it for the Authorization header.
  const getAuthToken = () =>
    localStorage.getItem('adminToken') || localStorage.getItem('merchantToken');

  // Fetch profile data from database on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = getAuthToken();
        if (!token) {
          setProfileLoading(false);
          return;
        }

        const response = await fetch(`${API_BASE}/admin/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setAdminData(data);
          // Update localStorage with fresh data
          localStorage.setItem('adminData', JSON.stringify(data));
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (field, value) => {
    // Only allow digits
    if (field !== 'otp' && !/^\d*$/.test(value)) return;

    // Limit to 6 digits for PINs
    if ((field === 'oldPin' || field === 'newPin' || field === 'confirmPin') && value.length > 6) return;

    // Limit to 6 digits for OTP
    if (field === 'otp' && value.length > 6) return;

    setFormData({
      ...formData,
      [field]: value
    });
    setError('');
  };

  const handleSendOTP = async () => {
    if (!formData.oldPin || formData.oldPin.length !== 6) {
      setError('Old PIN must be exactly 6 digits');
      return;
    }

    if (!formData.newPin || formData.newPin.length !== 6) {
      setError('New PIN must be exactly 6 digits');
      return;
    }

    if (formData.oldPin === formData.newPin) {
      setError('New PIN must be different from old PIN');
      return;
    }

    if (formData.newPin !== formData.confirmPin) {
      setError('New PIN and confirmation do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          email: adminData.email,
          purpose: 'password_change'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setOtpSent(true);
      setStep(2);
      setError('');
    } catch (err) {
      console.error('Send OTP error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!formData.otp || formData.otp.length !== 6) {
      setError('OTP must be exactly 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          oldPin: formData.oldPin,
          newPin: formData.newPin,
          otp: formData.otp
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setStep(3);
      setError('');
    } catch (err) {
      console.error('Change password error:', err);
      setError(err.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordForm = () => {
    setStep(1);
    setFormData({ oldPin: '', newPin: '', confirmPin: '', otp: '' });
    setError('');
    setOtpSent(false);
    setShowConfirm(false);
    setShowOldPin(false);
    setShowNewPin(false);
    setShowConfirmPin(false);
  };

  const getInitials = () => {
    if (!adminData) return '?';
    const first = adminData.firstName?.[0] || '';
    const last = adminData.lastName?.[0] || '';
    return (first + last).toUpperCase();
  };

  const getRoleLabel = (role) => {
    const roleMap = {
      motorpool: 'Motorpool Admin',
      merchant: 'Merchant Admin',
      treasury: 'Treasury Admin',
      accounting: 'Accounting Admin',
      sysad: 'System Administrator'
    };
    return roleMap[role] || role;
  };

  const renderPersonalInfo = () => (
    <div style={{
      background: theme.bg.tertiary,
      borderRadius: '16px',
      border: `1px solid ${theme.border.primary}`,
      overflow: 'hidden'
    }}>
      {/* Profile Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,212,28,0.2) 0%, rgba(255,212,28,0.05) 100%)',
        padding: '40px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        borderBottom: '1px solid rgba(255,212,28,0.2)'
      }}>
        {/* Avatar */}
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FFD41C 0%, #F59E0B 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          fontWeight: 800,
          color: theme.accent.secondary,
          boxShadow: '0 0 0 6px rgba(255,212,28,0.2)'
        }}>
          {getInitials()}
        </div>

        {/* Name and Role */}
        <div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: theme.text.primary,
            margin: '0 0 8px 0'
          }}>
            {adminData?.firstName} {adminData?.lastName}
          </h2>
          <div style={{
            display: 'inline-block',
            padding: '6px 16px',
            background: 'rgba(255,212,28,0.2)',
            border: '1px solid rgba(255,212,28,0.4)',
            borderRadius: '20px',
            color: theme.accent.primary,
            fontSize: '13px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {getRoleLabel(adminData?.role)}
          </div>
        </div>
      </div>

      {/* Personal Info Grid */}
      <div style={{ padding: '32px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '24px'
        }}>
          <InfoField label="Admin ID" value={adminData?.adminId || 'N/A'} />
          <InfoField label="Role" value={getRoleLabel(adminData?.role)} />
          <InfoField label="First Name" value={adminData?.firstName || 'N/A'} />
          <InfoField label="Last Name" value={adminData?.lastName || 'N/A'} />
          <InfoField label="Middle Name" value={adminData?.middleName || 'N/A'} />
          <InfoField label="Email Address" value={adminData?.email || 'N/A'} />
          <InfoField
            label="Account Status"
            value={adminData?.isActive ? 'Active' : 'Inactive'}
            highlight={adminData?.isActive ? 'success' : 'error'}
          />
          <InfoField
            label="Created By"
            value={adminData?.createdBy || 'System'}
          />
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div style={{
      background: theme.bg.tertiary,
      borderRadius: '16px',
      border: `1px solid ${theme.border.primary}`,
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
          color: theme.accent.primary,
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Lock className="w-5 h-5" /> Security Settings
        </h3>
        <p style={{
          fontSize: '14px',
          color: theme.text.secondary,
          margin: 0
        }}>
          Update your 6-digit PIN for enhanced security
        </p>
      </div>

      <div style={{ padding: '32px' }}>

      {/* Error Alert */}
      {error && (
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
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {step === 1 && (
        <div style={{ maxWidth: '560px' }}>
          {[
            { key: 'oldPin', label: 'Current PIN (6 digits) *', show: showOldPin, setShow: setShowOldPin, hint: null },
            { key: 'newPin', label: 'New PIN (6 digits) *', show: showNewPin, setShow: setShowNewPin, hint: 'Must be different from current PIN' },
            { key: 'confirmPin', label: 'Confirm New PIN (6 digits) *', show: showConfirmPin, setShow: setShowConfirmPin, hint: 'Must match the new PIN above' }
          ].map((field) => (
            <div key={field.key} style={{ marginBottom: '18px' }}>
              <label style={{
                display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700,
                color: theme.accent.primary, textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                {field.label}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={field.show ? 'text' : 'password'}
                  value={formData[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  disabled={loading}
                  placeholder="••••••"
                  maxLength="6"
                  style={{
                    width: '100%', padding: '14px 48px 14px 14px',
                    border: `2px solid ${theme.border.primary}`, borderRadius: '10px',
                    background: theme.bg.tertiary, color: theme.text.primary,
                    fontSize: '24px', fontWeight: 700, letterSpacing: '12px',
                    textAlign: 'center', boxSizing: 'border-box', fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => field.setShow(!field.show)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px',
                    color: theme.text.tertiary, padding: 0, lineHeight: 1
                  }}
                  aria-label={field.show ? 'Hide PIN' : 'Show PIN'}
                >
                  {field.show ? '🙈' : '👁️'}
                </button>
              </div>
              {field.hint && (
                <p style={{ fontSize: '11px', color: theme.text.tertiary, marginTop: '8px', marginBottom: 0 }}>
                  {field.hint}
                </p>
              )}
            </div>
          ))}

          <button
            onClick={handleSendOTP}
            disabled={loading || formData.oldPin.length !== 6 || formData.newPin.length !== 6 || formData.confirmPin.length !== 6}
            style={{
              width: '100%', padding: '14px', marginTop: '6px',
              background: (loading || formData.oldPin.length !== 6 || formData.newPin.length !== 6 || formData.confirmPin.length !== 6)
                ? (isDarkMode ? 'rgba(255, 212, 28, 0.3)' : 'rgba(59,130,246,0.3)')
                : theme.accent.primary,
              color: isDarkMode ? '#181D40' : '#FFFFFF',
              border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
              cursor: (loading || formData.oldPin.length !== 6 || formData.newPin.length !== 6 || formData.confirmPin.length !== 6) ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase', letterSpacing: '1px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.3s ease'
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '16px', height: '16px', border: '2px solid rgba(24, 29, 64, 0.3)',
                  borderTopColor: isDarkMode ? '#181D40' : '#FFFFFF', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span>Sending OTP...</span>
              </>
            ) : (
              <>
                <Mail className="w-5 h-5" />
                <span>Send OTP to Email</span>
              </>
            )}
          </button>

          {/* Security Tips */}
          <div style={{
            marginTop: '24px', padding: '16px 20px',
            background: isDarkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
            border: `1px solid ${isDarkMode ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.2)'}`,
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#3B82F6', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield className="w-5 h-5" /> Security Tips
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: theme.text.secondary, fontSize: '12px', lineHeight: 1.7 }}>
              <li>Never share your PIN with anyone</li>
              <li>Change your PIN regularly (every 3 months recommended)</li>
              <li>Use a PIN that's hard to guess (avoid birthdays, repeating numbers)</li>
              <li>Report any suspicious activity immediately</li>
            </ul>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ maxWidth: '500px' }}>
          <div style={{
            padding: '16px',
            background: 'rgba(59, 130, 246, 0.15)',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📧</div>
            <div style={{
              fontSize: '14px',
              color: '#3B82F6',
              fontWeight: 600,
              marginBottom: '4px'
            }}>
              OTP Sent Successfully!
            </div>
            <div style={{
              fontSize: '12px',
              color: theme.text.secondary
            }}>
              Check your email: {adminData?.email}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '12px',
              fontWeight: 700,
              color: theme.accent.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Enter OTP (6 digits) *
            </label>
            <input
              type="text"
              value={formData.otp}
              onChange={(e) => handleChange('otp', e.target.value)}
              disabled={loading}
              placeholder="______"
              maxLength="6"
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid rgba(255, 212, 28, 0.3)',
                borderRadius: '10px',
                background: theme.bg.tertiary,
                color: theme.text.primary,
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '12px',
                textAlign: 'center',
                boxSizing: 'border-box',
                fontFamily: 'monospace'
              }}
            />
            <p style={{
              fontSize: '11px',
              color: theme.text.tertiary,
              marginTop: '8px',
              marginBottom: 0
            }}>
              OTP expires in 10 minutes
            </p>
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            disabled={loading || formData.otp.length !== 6}
            style={{
              width: '100%',
              padding: '14px',
              background: loading || formData.otp.length !== 6
                ? 'rgba(255, 212, 28, 0.3)'
                : '#FFD41C',
              color: theme.accent.secondary,
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading || formData.otp.length !== 6
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
            <Lock className="w-5 h-5" />
            <span>Change Password</span>
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '40px 0', maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ fontSize: '80px', marginBottom: '24px' }}>✅</div>
          <h3 style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#22C55E',
            marginBottom: '12px'
          }}>
            Password Changed Successfully!
          </h3>
          <p style={{
            fontSize: '14px',
            color: theme.text.secondary,
            marginBottom: '32px'
          }}>
            Your password has been updated. Please use your new PIN for future logins.
          </p>
          <button
            onClick={resetPasswordForm}
            style={{
              padding: '14px 32px',
              background: '#FFD41C',
              color: theme.accent.secondary,
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.7)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: isDarkMode ? '#1a1f3a' : theme.bg.secondary,
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
              border: '2px solid rgba(255, 212, 28, 0.3)',
              textAlign: 'center'
            }}
          >
            <div className="text-5xl mb-4">⚠️</div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: theme.text.primary,
              marginBottom: '12px'
            }}>
              Confirm Password Change
            </h3>
            <p style={{
              fontSize: '14px',
              color: theme.text.secondary,
              marginBottom: '24px'
            }}>
              Are you sure you want to change your password? You will need to use the new PIN for future logins.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: 'rgba(251, 251, 251, 0.1)',
                  color: theme.text.secondary,
                  border: '1px solid rgba(251, 251, 251, 0.2)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  handleChangePassword();
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#FFD41C',
                  color: theme.accent.secondary,
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ borderBottomColor: theme.border.primary }} className="mb-[30px] border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <User className="w-5 h-5" /> My Profile
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Manage your account information and security settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '30px'
      }}>
        <button
          onClick={() => setActiveSection('personal')}
          style={{
            padding: '12px 24px',
            background: activeSection === 'personal'
              ? 'rgba(255, 212, 28, 0.15)'
              : 'rgba(30, 35, 71, 0.4)',
            border: activeSection === 'personal'
              ? '2px solid rgba(255, 212, 28, 0.4)'
              : '2px solid rgba(255, 212, 28, 0.1)',
            borderRadius: '12px',
            color: activeSection === 'personal'
              ? '#FFD41C'
              : 'rgba(251, 251, 251, 0.7)',
            fontSize: '14px',
            fontWeight: activeSection === 'personal' ? 700 : 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <ClipboardList className="w-5 h-5" />
          <span>Personal Information</span>
        </button>
        <button
          onClick={() => setActiveSection('security')}
          style={{
            padding: '12px 24px',
            background: activeSection === 'security'
              ? 'rgba(255, 212, 28, 0.15)'
              : 'rgba(30, 35, 71, 0.4)',
            border: activeSection === 'security'
              ? '2px solid rgba(255, 212, 28, 0.4)'
              : '2px solid rgba(255, 212, 28, 0.1)',
            borderRadius: '12px',
            color: activeSection === 'security'
              ? '#FFD41C'
              : 'rgba(251, 251, 251, 0.7)',
            fontSize: '14px',
            fontWeight: activeSection === 'security' ? 700 : 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Lock className="w-5 h-5" />
          <span>Security Settings</span>
        </button>
      </div>

      {/* Content */}
      {profileLoading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px 20px',
          color: theme.text.secondary
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 212, 28, 0.2)',
            borderTopColor: '#FFD41C',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
      ) : (
        <>
          {activeSection === 'personal' && renderPersonalInfo()}
          {activeSection === 'security' && renderSecuritySettings()}
        </>
      )}
    </div>
  );
}

// Info Field Component
function InfoField({ label, value, highlight, fullWidth }) {
  const { theme, isDarkMode } = useTheme();
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
        color: theme.accent.primary,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </label>
      <div style={{
        padding: '12px 16px',
        background: highlightStyle ? highlightStyle.bg : theme.bg.tertiary,
        border: `1px solid ${highlightStyle ? highlightStyle.border : theme.border.secondary}`,
        borderRadius: '8px',
        color: highlightStyle ? highlightStyle.color : theme.text.primary,
        fontSize: '15px',
        fontWeight: highlight ? 700 : 500
      }}>
        {value || 'N/A'}
      </div>
    </div>
  );
}
