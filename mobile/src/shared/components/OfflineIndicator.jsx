// src/shared/components/OfflineIndicator.jsx
// Global offline mode indicator component

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react-native';
import NetworkService from '../../services/NetworkService';
import PaymentService from '../../services/PaymentService';

const OfflineIndicator = ({ style, showQueueCount = true }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Update network status
    const updateNetworkStatus = (online) => {
      setIsOnline(online);
      
      // Animate slide in/out when status changes
      Animated.timing(slideAnim, {
        toValue: online ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };

    // Initial status
    updateNetworkStatus(NetworkService.isConnected);

    // Listen for network changes
    NetworkService.addListener(updateNetworkStatus);

    // Update queue count periodically
    const updateQueueCount = async () => {
      try {
        const count = await PaymentService.getOfflineQueueCount();
        setQueueCount(count);
      } catch (error) {
        console.error('Failed to get queue count:', error);
      }
    };

    updateQueueCount();
    const queueInterval = setInterval(updateQueueCount, 5000); // Update every 5 seconds

    return () => {
      NetworkService.removeListener(updateNetworkStatus);
      clearInterval(queueInterval);
    };
  }, []);

  if (isOnline && queueCount === 0) {
    return null; // Don't show indicator when online and no queued items
  }

  const indicatorStyle = [
    styles.container,
    !isOnline && styles.containerOffline,
    style,
  ];

  const slideStyle = {
    transform: [{ translateY: slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-100, 0], // Slide from top
    }) }],
  };

  return (
    <Animated.View style={[indicatorStyle, slideStyle]}>
      <View style={styles.content}>
        <View style={styles.statusSection}>
          {isOnline ? (
            <Wifi size={16} color="#10B981" />
          ) : (
            <WifiOff size={16} color="#EF4444" />
          )}
          
          <Text style={[styles.statusText, !isOnline && styles.statusTextOffline]}>
            {isOnline ? 
              (queueCount > 0 ? `Online • ${queueCount} payment(s) to sync` : 'Online • Connected') :
              `Offline Mode${queueCount > 0 ? ` • ${queueCount} payment(s) queued` : ''}`
            }
          </Text>
        </View>

        {!isOnline && (
          <View style={styles.offlineInfo}>
            <AlertCircle size={14} color="#F59E0B" />
            <Text style={styles.offlineInfoText}>
              Payments will queue and sync when connection is restored
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1000,
  },
  containerOffline: {
    backgroundColor: '#F59E0B',
  },
  content: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextOffline: {
    color: '#FFFFFF',
  },
  offlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  offlineInfoText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
});

export default OfflineIndicator;
