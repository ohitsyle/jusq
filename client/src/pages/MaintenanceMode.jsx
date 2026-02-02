// src/pages/MaintenanceMode.jsx
// Maintenance Mode page - displayed when system is under maintenance

import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceMode({ message }) {
  const navigate = useNavigate();

  const handleRetry = () => {
    // Reload the page to check if maintenance is over
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #181D40 0%, #0F1227 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div
        style={{
          background: 'rgba(30, 35, 71, 0.95)',
          borderRadius: '24px',
          padding: '60px 40px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          border: '2px solid #FFD41C',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'rgba(255, 212, 28, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 30px',
            border: '3px solid #FFD41C'
          }}
        >
          <span style={{ fontSize: '60px' }}>🔧</span>
        </div>

        {/* Title */}
        <h1
          style={{
            color: '#FFD41C',
            fontSize: '32px',
            fontWeight: '700',
            margin: '0 0 16px 0'
          }}
        >
          Under Maintenance
        </h1>

        {/* Message */}
        <p
          style={{
            color: '#FBFBFB',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 30px 0',
            opacity: 0.9
          }}
        >
          {message || 'The NUCash system is currently undergoing scheduled maintenance. We apologize for any inconvenience.'}
        </p>

        {/* Info Box */}
        <div
          style={{
            background: 'rgba(255, 212, 28, 0.1)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '30px',
            border: '1px solid rgba(255, 212, 28, 0.3)'
          }}
        >
          <p
            style={{
              color: '#FFD41C',
              fontSize: '14px',
              margin: '0 0 8px 0',
              fontWeight: '600'
            }}
          >
            ⏰ Please check back later
          </p>
          <p
            style={{
              color: 'rgba(251, 251, 251, 0.7)',
              fontSize: '13px',
              margin: 0
            }}
          >
            Our team is working to restore services as quickly as possible.
          </p>
        </div>

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          style={{
            background: '#FFD41C',
            color: '#181D40',
            border: 'none',
            borderRadius: '12px',
            padding: '16px 40px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(255, 212, 28, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 212, 28, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 212, 28, 0.3)';
          }}
        >
          🔄 Try Again
        </button>

        {/* Contact Info */}
        <p
          style={{
            color: 'rgba(251, 251, 251, 0.5)',
            fontSize: '12px',
            marginTop: '30px'
          }}
        >
          Need assistance? Contact us at{' '}
          <a
            href="mailto:nucashsystem@gmail.com"
            style={{ color: '#FFD41C', textDecoration: 'none' }}
          >
            nucashsystem@gmail.com
          </a>
        </p>

        {/* Footer */}
        <p
          style={{
            color: 'rgba(251, 251, 251, 0.4)',
            fontSize: '11px',
            marginTop: '20px'
          }}
        >
          © 2026 NUCash System | National University - Laguna
        </p>
      </div>
    </div>
  );
}
