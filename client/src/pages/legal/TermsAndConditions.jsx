// src/pages/legal/TermsAndConditions.jsx
// Terms and Conditions page for NUCash System

import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

export default function TermsAndConditions() {
  const { theme, isDarkMode } = useTheme();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.bg.primary,
        color: theme.text.primary,
        padding: '40px 20px'
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          background: theme.bg.card,
          borderRadius: '16px',
          padding: '40px',
          border: `1px solid ${theme.border.primary}`
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ color: theme.accent.primary, fontSize: '32px', marginBottom: '8px' }}>
            Terms and Conditions
          </h1>
          <p style={{ color: theme.text.secondary, fontSize: '14px' }}>
            Last updated: February 2026
          </p>
        </div>

        {/* Content */}
        <div style={{ lineHeight: '1.8', fontSize: '15px' }}>
          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              1. Acceptance of Terms
            </h2>
            <p style={{ color: theme.text.secondary }}>
              By accessing and using the NUCash System, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to abide by these terms, please do not use this service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              2. Description of Service
            </h2>
            <p style={{ color: theme.text.secondary }}>
              NUCash is a digital payment and shuttle management system designed for National University - Laguna. The system provides:
            </p>
            <ul style={{ color: theme.text.secondary, paddingLeft: '20px', marginTop: '10px' }}>
              <li>Digital wallet services for cashless transactions</li>
              <li>Shuttle service tracking and payment</li>
              <li>Merchant payment processing</li>
              <li>Account management features</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              3. User Responsibilities
            </h2>
            <p style={{ color: theme.text.secondary }}>
              Users are responsible for:
            </p>
            <ul style={{ color: theme.text.secondary, paddingLeft: '20px', marginTop: '10px' }}>
              <li>Maintaining the confidentiality of their PIN and account information</li>
              <li>All activities that occur under their account</li>
              <li>Notifying the administration immediately of any unauthorized use</li>
              <li>Ensuring their RFID card is not shared with others</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              4. Account Security
            </h2>
            <p style={{ color: theme.text.secondary }}>
              You are responsible for safeguarding your 6-digit PIN. We recommend that you do not share your PIN with anyone. NUCash staff will never ask for your PIN.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              5. Transactions
            </h2>
            <p style={{ color: theme.text.secondary }}>
              All transactions made through the NUCash system are final. Refunds may be processed at the discretion of the Treasury Office. Users should verify transaction details before confirming any payment.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              6. Limitation of Liability
            </h2>
            <p style={{ color: theme.text.secondary }}>
              NUCash and National University shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              7. Modifications
            </h2>
            <p style={{ color: theme.text.secondary }}>
              We reserve the right to modify these terms at any time. Users will be notified of significant changes through the system or via email.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              8. Contact Information
            </h2>
            <p style={{ color: theme.text.secondary }}>
              For questions about these Terms and Conditions, please contact us at{' '}
              <a href="mailto:nucashsystem@gmail.com" style={{ color: theme.accent.primary }}>
                nucashsystem@gmail.com
              </a>
            </p>
          </section>
        </div>

        {/* Back Link */}
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Link
            to="/login"
            style={{
              color: theme.accent.primary,
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            ← Back to Login
          </Link>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '30px', paddingTop: '20px', borderTop: `1px solid ${theme.border.primary}` }}>
          <p style={{ color: theme.text.muted, fontSize: '12px' }}>
            © 2026 NUCash System | Jose Anjelo Abued, Ashley Gwyneth Cuevas, Jhustine Brylle Logronio
          </p>
        </div>
      </div>
    </div>
  );
}
