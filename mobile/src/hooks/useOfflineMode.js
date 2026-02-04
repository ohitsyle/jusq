// src/hooks/useOfflineMode.js
// Comprehensive offline mode hook for mobile app

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import NetworkService from '../services/NetworkService';
import PaymentService from '../services/PaymentService';
import OfflineStorageService from '../services/OfflineStorageService';

export const useOfflineMode = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [connectionType, setConnectionType] = useState('unknown');

  // Update network status
  const updateNetworkStatus = useCallback(async (online, wasOnline) => {
    setIsOnline(online);
    
    // Get detailed connection info
    try {
      const detailedInfo = await NetworkService.getDetailedConnectionInfo();
      if (detailedInfo) {
        setConnectionType(detailedInfo.type);
      }
    } catch (error) {
      console.log('Could not get detailed connection info:', error);
    }

    // If we just came online, cache active users and trigger auto-sync
    if (online && !wasOnline) {
      console.log('🌐 Just came online, caching active users...');
      cacheActiveUsers();
      
      // Trigger auto-sync after a short delay
      setTimeout(() => {
        if (isOnline) {
          handleAutoSync();
        }
      }, 1000);
    }

    // Show alert when coming back online with queued payments
    if (online && !wasOnline && queueCount > 0) {
      Alert.alert(
        'Connection Restored',
        `You have ${queueCount} payment(s) queued for sync. Would you like to sync now?`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Sync Now', onPress: handleSyncNow }
        ]
      );
    }

    // Auto-sync when coming back online
    if (online && !wasOnline) {
      handleAutoSync();
    }
  }, [queueCount]);

  // Update queue count
  const updateQueueCount = useCallback(async () => {
    try {
      const count = await PaymentService.getOfflineQueueCount();
      setQueueCount(count);
    } catch (error) {
      console.error('Failed to get queue count:', error);
    }
  }, []);

  // Update last sync time
  const updateLastSyncTime = useCallback(async () => {
    try {
      const lastSync = await OfflineStorageService.getTimeSinceLastSync();
      setLastSyncTime(lastSync);
    } catch (error) {
      console.error('Failed to get last sync time:', error);
    }
  }, []);

  // Handle manual sync
  const handleSyncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const result = await PaymentService.syncOfflineQueue();
      
      if (result.success) {
        await updateQueueCount();
        await updateLastSyncTime();
        
        if (result.processed > 0) {
          Alert.alert(
            'Sync Complete',
            `Successfully synced ${result.processed} payment(s)${result.failed > 0 ? `. ${result.failed} failed.` : '.'}`
          );
        }
      } else {
        Alert.alert('Sync Failed', 'Unable to sync payments. Please try again later.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Error', 'An error occurred while syncing payments.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, updateQueueCount, updateLastSyncTime]);

  // Handle auto-sync
  const handleAutoSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    try {
      setIsSyncing(true);
      const result = await PaymentService.syncOfflineQueue();
      
      if (result.success && result.processed > 0) {
        await updateQueueCount();
        await updateLastSyncTime();
        console.log(`Auto-synced ${result.processed} payments`);
      }
    } catch (error) {
      console.error('Auto-sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updateQueueCount, updateLastSyncTime]);

  // Cache active users when coming online
  const cacheActiveUsers = useCallback(async () => {
    if (!isOnline) return;
    
    try {
      console.log('🔄 Caching active users for offline mode...');
      const cachedCount = await PaymentService.cacheAllActiveUsers();
      if (cachedCount > 0) {
        console.log(`✅ Cached ${cachedCount} active users for offline payments`);
      }
    } catch (error) {
      console.error('❌ Failed to cache active users:', error);
    }
  }, [isOnline]);

  // Clear offline queue (admin function)
  const clearOfflineQueue = useCallback(async () => {
    Alert.alert(
      'Clear Offline Queue',
      'Are you sure you want to clear all queued offline payments? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await PaymentService.clearOfflineQueue();
              await updateQueueCount();
              Alert.alert('Queue Cleared', 'All offline payments have been cleared.');
            } catch (error) {
              console.error('Failed to clear queue:', error);
              Alert.alert('Error', 'Failed to clear offline queue.');
            }
          }
        }
      ]
    );
  }, [updateQueueCount]);

  // Get offline statistics
  const getOfflineStats = useCallback(async () => {
    try {
      const stats = await OfflineStorageService.getStorageStats();
      return {
        queueCount,
        isOnline,
        isSyncing,
        lastSyncTime,
        connectionType,
        storageStats: stats
      };
    } catch (error) {
      console.error('Failed to get offline stats:', error);
      return null;
    }
  }, [queueCount, isOnline, isSyncing, lastSyncTime, connectionType]);

  // Initialize and setup listeners
  useEffect(() => {
    // Initialize NetworkService if not already initialized
    if (!NetworkService.isInitialized) {
      NetworkService.initialize();
    }

    // Initial status
    const initialOnline = NetworkService.isConnected;
    updateNetworkStatus(initialOnline, null);
    NetworkService.addListener(updateNetworkStatus);

    // If initially online, cache active users
    if (initialOnline) {
      console.log('🌐 Initially online, caching active users...');
      cacheActiveUsers();
    }

    // Update queue count periodically
    updateQueueCount();
    const queueInterval = setInterval(updateQueueCount, 5000);

    // Update last sync time
    updateLastSyncTime();
    const syncInterval = setInterval(updateLastSyncTime, 10000);

    return () => {
      NetworkService.removeListener(updateNetworkStatus);
      clearInterval(queueInterval);
      clearInterval(syncInterval);
    };
  }, []); // Remove dependencies to prevent re-initialization

  return {
    // State
    isOnline,
    queueCount,
    isSyncing,
    lastSyncTime,
    connectionType,
    
    // Actions
    syncNow: handleSyncNow,
    clearQueue: clearOfflineQueue,
    refreshStats: getOfflineStats,
    
    // Computed values
    hasQueuedPayments: queueCount > 0,
    canSync: isOnline && !isSyncing && queueCount > 0,
    isOffline: !isOnline,
    
    // Status messages
    statusMessage: isOnline 
      ? (queueCount > 0 ? `Online • ${queueCount} payment(s) to sync` : 'Online • Connected')
      : `Offline Mode${queueCount > 0 ? ` • ${queueCount} payment(s) queued` : ''}`,
    
    syncStatusMessage: isSyncing 
      ? 'Syncing...' 
      : (isOnline ? 'Ready to sync' : 'Waiting for connection')
  };
};

export default useOfflineMode;
