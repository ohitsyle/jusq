// src/pages/legal/PrivacyPolicy.jsx
// Privacy Policy page for NUCash System

import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

export default function PrivacyPolicy() {
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
            Privacy Policy
          </h1>
          <p style={{ color: theme.text.secondary, fontSize: '14px' }}>
            Last updated: February 2026
          </p>
        </div>

        {/* Content */}
        <div style={{ lineHeight: '1.8', fontSize: '15px' }}>
          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              1. Information We Collect
            </h2>
            <p style={{ color: theme.text.secondary }}>
              We collect information you provide directly to us, including:
            </p>
            <ul style={{ color: theme.text.secondary, paddingLeft: '20px', marginTop: '10px' }}>
              <li>Personal information (name, email, student/employee ID)</li>
              <li>RFID card information</li>
              <li>Transaction history</li>
              <li>Account activity and usage data</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              2. How We Use Your Information
            </h2>
            <p style={{ color: theme.text.secondary }}>
              We use the information we collect to:
            </p>
            <ul style={{ color: theme.text.secondary, paddingLeft: '20px', marginTop: '10px' }}>
              <li>Process transactions and manage your account</li>
              <li>Provide shuttle tracking and payment services</li>
              <li>Send important notifications about your account</li>
              <li>Improve our services and user experience</li>
              <li>Ensure security and prevent fraud</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              3. Information Sharing
            </h2>
            <p style={{ color: theme.text.secondary }}>
              We do not sell, trade, or otherwise transfer your personal information to outside parties. Your information may be shared with:
            </p>
            <ul style={{ color: theme.text.secondary, paddingLeft: '20px', marginTop: '10px' }}>
              <li>National University administration for academic purposes</li>
              <li>Authorized merchants for transaction processing</li>
              <li>Law enforcement when required by law</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              4. Data Security
            </h2>
            <p style={{ color: theme.text.secondary }}>
              We implement appropriate security measures to protect your personal information:
            </p>
            <ul style={{ color: theme.text.secondary, paddingLeft: '20px', marginTop: '10px' }}>
              <li>Encrypted data transmission (HTTPS)</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              5. Data Retention
            </h2>
            <p style={{ color: theme.text.secondary }}>
              We retain your personal information for as long as your account is active or as needed to provide you services. Transaction records are kept for a minimum of 5 years for auditing purposes.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              6. Your Rights
            </h2>
            <p style={{ color: theme.text.secondary }}>
              You have the right to:
            </p>
            <ul style={{ color: theme.text.secondary, paddingLeft: '20px', marginTop: '10px' }}>
              <li>Access your personal information</li>
              <li>Request correction of inaccurate data</li>
              <li>Request account deactivation</li>
              <li>Receive a copy of your transaction history</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              7. Cookies and Tracking
            </h2>
            <p style={{ color: theme.text.secondary }}>
              We use local storage and session cookies to maintain your login session and preferences. These are essential for the proper functioning of the system.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              8. Changes to This Policy
            </h2>
            <p style={{ color: theme.text.secondary }}>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2 style={{ color: theme.accent.primary, fontSize: '20px', marginBottom: '12px' }}>
              9. Contact Us
            </h2>
            <p style={{ color: theme.text.secondary }}>
              If you have any questions about this Privacy Policy, please contact us at{' '}
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
