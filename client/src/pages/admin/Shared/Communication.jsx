// src/admin/components/Communication/DriverNotifications.jsx
import { toast } from 'react-toastify';
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../utils/api';
import { ThemedSelect } from '../../../components/shared/ThemedControls';

export default function DriverNotifications() {
    const { theme, isDarkMode } = useTheme();
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [messageType, setMessageType] = useState('info');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sentMessages, setSentMessages] = useState([]);

  useEffect(() => {
    loadDrivers();
    loadSentMessages();
  }, []);

  const loadDrivers = async () => {
    try {
      const data = await api.get('/admin/drivers');
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadSentMessages = () => {
    const stored = localStorage.getItem('sentDriverMessages');
    if (stored) {
      setSentMessages(JSON.parse(stored));
    }
  };

  const saveSentMessage = (message) => {
    const updated = [message, ...sentMessages].slice(0, 50); // Keep last 50
    setSentMessages(updated);
    localStorage.setItem('sentDriverMessages', JSON.stringify(updated));
  };

  const handleSendNotification = async () => {
    if (!messageTitle.trim() || !messageContent.trim()) {
      toast.error('Please fill in both title and message');
      return;
    }

    setSending(true);
    try {
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');

      // Log the notification as an admin action
      const recipients = selectedDriver === 'all' ? 'All Drivers' : drivers.find(d => d.driverId === selectedDriver)?.name || selectedDriver;

      await api.post('/admin/event-logs', {
        eventType: 'admin_action',
        severity: 'info',
        title: 'Driver Notification Sent',
        description: `Notification sent to: ${recipients}`,
        details: {
          recipients,
          messageType,
          title: messageTitle,
          content: messageContent,
          adminId: adminData._id,
          adminName: adminData.name
        }
      });

      // Save to local history
      saveSentMessage({
        id: Date.now(),
        recipients,
        messageType,
        title: messageTitle,
        content: messageContent,
        timestamp: new Date().toISOString(),
        sentBy: adminData.name || 'Admin'
      });

      // Clear form
      setMessageTitle('');
      setMessageContent('');
      toast.success('Notification sent successfully!');
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const activeDrivers = drivers.filter(d => d.isActive);

  const getMessageTypeColor = (type) => {
    switch (type) {
      case 'urgent': return { bg: 'rgba(239,68,68,0.2)', color: '#EF4444', border: 'rgba(239,68,68,0.3)' };
      case 'warning': return { bg: 'rgba(251,191,36,0.2)', color: '#FBBF24', border: 'rgba(251,191,36,0.3)' };
      case 'success': return { bg: 'rgba(34,197,94,0.2)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' };
      default: return { bg: 'rgba(59,130,246,0.2)', color: '#3B82F6', border: 'rgba(59,130,246,0.3)' };
    }
  };

  const currentTypeStyle = getMessageTypeColor(messageType);

  return (
    <div>
      <div style={{ borderBottomColor: theme.border.primary }} className="mb-[30px] border-b-2 pb-5">
        <h2 style={{ color: theme.accent.primary }} className="text-2xl font-bold m-0 mb-2 flex items-center gap-[10px]">
          <span>📢</span> Driver Communications
        </h2>
        <p style={{ color: theme.text.secondary }} className="text-[13px] m-0">
          Send notifications and messages to drivers
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Send Notification Form */}
        <div style={{
          background: theme.bg.tertiary,
          borderRadius: '16px',
          border: `1px solid ${theme.border.primary}`,
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.accent.primary, marginBottom: '20px' }}>
            Send Notification
          </h3>

          {/* Recipient Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: theme.text.secondary, marginBottom: '8px' }}>
              Recipient
            </label>
            <ThemedSelect
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                background: theme.bg.tertiary,
                border: '1px solid rgba(255,212,28,0.3)',
                borderRadius: '8px',
                color: theme.text.primary,
                fontSize: '13px'
              }}
            >
              <option value="all">All Active Drivers ({activeDrivers.length})</option>
              {activeDrivers.map(driver => (
                <option key={driver.driverId} value={driver.driverId}>
                  {driver.fullName || driver.name} ({driver.driverId})
                </option>
              ))}
            </ThemedSelect>
          </div>

          {/* Message Type */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: theme.text.secondary, marginBottom: '8px' }}>
              Message Type
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['info', 'success', 'warning', 'urgent'].map(type => {
                const typeStyle = getMessageTypeColor(type);
                const isSelected = messageType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setMessageType(type)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: isSelected ? typeStyle.bg : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${isSelected ? typeStyle.border : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '8px',
                      color: isSelected ? typeStyle.color : 'rgba(251,251,251,0.6)',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: theme.text.secondary, marginBottom: '8px' }}>
              Title
            </label>
            <input
              type="text"
              value={messageTitle}
              onChange={(e) => setMessageTitle(e.target.value)}
              placeholder="Enter notification title..."
              style={{
                width: '100%',
                padding: '10px',
                background: theme.bg.tertiary,
                border: '1px solid rgba(255,212,28,0.3)',
                borderRadius: '8px',
                color: theme.text.primary,
                fontSize: '13px'
              }}
            />
          </div>

          {/* Message Content */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: theme.text.secondary, marginBottom: '8px' }}>
              Message
            </label>
            <textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Enter your message..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '10px',
                background: theme.bg.tertiary,
                border: '1px solid rgba(255,212,28,0.3)',
                borderRadius: '8px',
                color: theme.text.primary,
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Preview */}
          {(messageTitle || messageContent) && (
            <div style={{
              background: currentTypeStyle.bg,
              border: `1px solid ${currentTypeStyle.border}`,
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '11px', color: currentTypeStyle.color, fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                PREVIEW
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: theme.text.primary, marginBottom: '4px' }}>
                {messageTitle || 'Notification Title'}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(251,251,251,0.8)' }}>
                {messageContent || 'Notification message...'}
              </div>
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSendNotification}
            disabled={!messageTitle.trim() || !messageContent.trim() || sending}
            style={{
              width: '100%',
              padding: '12px',
              background: messageTitle.trim() && messageContent.trim() && !sending ? '#FFD41C' : 'rgba(255,212,28,0.3)',
              color: messageTitle.trim() && messageContent.trim() && !sending ? '#181D40' : 'rgba(251,251,251,0.5)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: messageTitle.trim() && messageContent.trim() && !sending ? 'pointer' : 'not-allowed',
              boxShadow: messageTitle.trim() && messageContent.trim() && !sending ? '0 4px 12px rgba(255,212,28,0.4)' : 'none'
            }}
          >
            {sending ? 'Sending...' : 'Send Notification'}
          </button>
        </div>

        {/* Sent Messages History */}
        <div style={{
          background: theme.bg.tertiary,
          borderRadius: '16px',
          border: `1px solid ${theme.border.primary}`,
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.accent.primary, marginBottom: '20px' }}>
            Recent Messages ({sentMessages.length})
          </h3>

          {sentMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: theme.text.tertiary }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
              <div>No messages sent yet</div>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {sentMessages.map(msg => {
                const typeStyle = getMessageTypeColor(msg.messageType);
                return (
                  <div key={msg.id} style={{
                    background: theme.bg.card,
                    border: '1px solid rgba(255,212,28,0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: typeStyle.bg,
                        color: typeStyle.color,
                        border: `1px solid ${typeStyle.border}`
                      }}>
                        {msg.messageType}
                      </span>
                      <div style={{ fontSize: '10px', color: theme.text.tertiary }}>
                        {new Date(msg.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: theme.accent.primary, marginBottom: '4px' }}>
                      {msg.title}
                    </div>
                    <div style={{ fontSize: '12px', color: theme.text.secondary, marginBottom: '6px' }}>
                      {msg.content}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: theme.text.tertiary }}>
                      <span>To: {msg.recipients}</span>
                      <span>By: {msg.sentBy}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
