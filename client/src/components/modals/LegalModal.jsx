// src/components/modals/LegalModal.jsx
// Theme-aware modal for Terms and Conditions / Privacy Policy.
// Replaces the old standalone /terms and /privacy pages in the user footer.

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

const LEGAL = {
  terms: {
    title: 'Terms and Conditions',
    updated: 'Last updated: February 2026',
    sections: [
      {
        h: '1. Acceptance of Terms',
        p: 'By accessing and using the NUCash System, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this service.'
      },
      {
        h: '2. Description of Service',
        p: 'NUCash is a digital payment and shuttle management system designed for National University - Laguna. The system provides:',
        list: [
          'Digital wallet services for cashless transactions',
          'Shuttle service tracking and payment',
          'Merchant payment processing',
          'Account management features'
        ]
      },
      {
        h: '3. User Responsibilities',
        p: 'Users are responsible for:',
        list: [
          'Maintaining the confidentiality of their PIN and account information',
          'All activities that occur under their account',
          'Notifying the administration immediately of any unauthorized use',
          'Ensuring their RFID card is not shared with others'
        ]
      },
      {
        h: '4. Account Security',
        p: 'You are responsible for safeguarding your 6-digit PIN. We recommend that you do not share your PIN with anyone. NUCash staff will never ask for your PIN.'
      },
      {
        h: '5. Transactions',
        p: 'All transactions made through the NUCash system are final. Refunds may be processed at the discretion of the Treasury Office. Users should verify transaction details before confirming any payment.'
      },
      {
        h: '6. Limitation of Liability',
        p: 'NUCash and National University shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.'
      },
      {
        h: '7. Modifications',
        p: 'We reserve the right to modify these terms at any time. Users will be notified of significant changes through the system or via email.'
      },
      {
        h: '8. Contact Information',
        p: 'For questions about these Terms and Conditions, please contact us at nucashsystem@gmail.com.'
      }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: February 2026',
    sections: [
      {
        h: '1. Information We Collect',
        p: 'We collect information you provide directly to us, including:',
        list: [
          'Personal information (name, email, student/employee ID)',
          'RFID card information',
          'Transaction history',
          'Account activity and usage data'
        ]
      },
      {
        h: '2. How We Use Your Information',
        p: 'We use the information we collect to:',
        list: [
          'Process transactions and manage your account',
          'Provide shuttle tracking and payment services',
          'Send important notifications about your account',
          'Improve our services and user experience',
          'Ensure security and prevent fraud'
        ]
      },
      {
        h: '3. Information Sharing',
        p: 'We do not sell, trade, or otherwise transfer your personal information to outside parties. Your information may be shared with:',
        list: [
          'National University administration for academic purposes',
          'Authorized merchants for transaction processing',
          'Law enforcement when required by law'
        ]
      },
      {
        h: '4. Data Security',
        p: 'We implement appropriate security measures to protect your personal information:',
        list: [
          'Encrypted data transmission (HTTPS)',
          'Secure password hashing (bcrypt)',
          'Regular security audits',
          'Access controls and authentication'
        ]
      },
      {
        h: '5. Data Retention',
        p: 'We retain your personal information for as long as your account is active or as needed to provide you services. Transaction records are kept for a minimum of 5 years for auditing purposes.'
      },
      {
        h: '6. Your Rights',
        p: 'You have the right to:',
        list: [
          'Access your personal information',
          'Request correction of inaccurate data',
          'Request account deactivation',
          'Receive a copy of your transaction history'
        ]
      },
      {
        h: '7. Cookies and Tracking',
        p: 'We use local storage and session cookies to maintain your login session and preferences. These are essential for the proper functioning of the system.'
      },
      {
        h: '8. Changes to This Policy',
        p: 'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy here and updating the "Last updated" date.'
      },
      {
        h: '9. Contact Us',
        p: 'If you have any questions about this Privacy Policy, please contact us at nucashsystem@gmail.com.'
      }
    ]
  }
};

export default function LegalModal({ type, onClose }) {
  const { theme, isDarkMode } = useTheme();
  const doc = LEGAL[type];
  if (!doc) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          // Opaque background — theme.bg.card is translucent in dark mode, which
          // made the modal see-through onto the page behind it.
          background: isDarkMode ? '#181D40' : '#FFFFFF',
          borderRadius: '16px',
          border: `2px solid ${theme.accent.primary}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.border.primary}`,
            background: isDarkMode ? 'rgba(255,212,28,0.05)' : 'rgba(59,130,246,0.05)'
          }}
        >
          <div>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', fontWeight: 700, margin: 0 }}>
              {doc.title}
            </h2>
            <p style={{ color: theme.text.secondary, fontSize: '12px', margin: '4px 0 0 0' }}>
              {doc.updated}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.text.secondary,
              fontSize: '24px',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '8px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.accent.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.text.secondary; }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ padding: '24px', overflowY: 'auto', lineHeight: 1.7, fontSize: '14px' }}>
          {doc.sections.map((s, i) => (
            <section key={i} style={{ marginBottom: i === doc.sections.length - 1 ? 0 : '24px' }}>
              <h3 style={{ color: theme.accent.primary, fontSize: '16px', fontWeight: 700, margin: '0 0 8px 0' }}>
                {s.h}
              </h3>
              <p style={{ color: theme.text.secondary, margin: 0 }}>{s.p}</p>
              {s.list && (
                <ul style={{ color: theme.text.secondary, paddingLeft: '20px', marginTop: '8px', marginBottom: 0 }}>
                  {s.list.map((item, j) => (
                    <li key={j} style={{ marginBottom: '4px' }}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${theme.border.primary}`,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: theme.accent.primary,
              color: isDarkMode ? '#181D40' : '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 24px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
