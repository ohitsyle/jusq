// src/screens/PaymentScreen.js
// FIXED: 
// 1. Now passes route's fare amount to PaymentService instead of hardcoding ₱15
// 2. Total fare display uses actual route fare
// 3. Added api import for refund functionality

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, ScrollView } from 'react-native';
import NFCService from '../services/NFCService';
import PaymentService from '../services/PaymentService';
import api from '../services/api';
import useOfflineMode from '../hooks/useOfflineMode';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaymentScreen({ navigation, route }) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [passengersBoarded, setPassengersBoarded] = useState([]);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' or 'passengers'
  const [refundingId, setRefundingId] = useState(null); // rfidUId being refunded

  // Use the new offline mode hook
  const { 
    isOnline, 
    queueCount, 
    isSyncing, 
    syncNow: handleSync,
    statusMessage,
    syncStatusMessage 
  } = useOfflineMode();

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Manual cache trigger for testing
  const handleCacheUsers = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Please connect to internet to cache users');
      return;
    }

    try {
      const cachedCount = await PaymentService.cacheAllActiveUsers();
      Alert.alert('Success', `Cached ${cachedCount} active users for offline mode`);
    } catch (error) {
      Alert.alert('Error', 'Failed to cache users');
    }
  };

  const driverName = route.params?.name || 'Driver';
  const driverId = route.params?.driverId || '';
  const shuttleId = route.params?.shuttleId || 'SHUTTLE_01';
  const selectedRoute = route.params?.selectedRoute || null;
  
  // UPDATED: Extract routeId and fare for new database structure
  const routeId = selectedRoute?.id || selectedRoute?.routeId || null;
  const routeFare = selectedRoute?.fare || 15; // FIXED: Use route's fare, default to 15

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
      setCurrentDate(now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }));
    }, 1000);

    initNFC();
    // Network status and queue count are now handled by useOfflineMode hook

    return () => {
      clearInterval(interval);
      isMountedRef.current = false; // Mark as unmounted
    };
  }, []);

  useEffect(() => {
    if (!isScanning && isReady) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isScanning, isReady]);

  const initNFC = async () => {
    const enabled = await NFCService.isEnabled();
    setIsReady(enabled);
  };


  const handleScan = async () => {
    if (!isReady) {
      Alert.alert('NFC Not Ready', 'Please enable NFC to scan cards');
      return;
    }

    // TOGGLE: If already scanning, stop scanning
    if (isScanning) {
      console.log('🛑 Stopping scan...');
      setIsScanning(false);
      await NFCService.cancelScan();
      return;
    }

    // START SCANNING
    console.log('🔍 Starting scan...');
    setIsScanning(true);
    
    try {
      const nfcResult = await NFCService.readRFIDCard();
      
      // If user cancelled or no card detected
      if (!nfcResult.success) {
        setIsScanning(false);
        return;
      }

      const rfidUId = nfcResult.uid;

      // Check for duplicate scan (same card scanned twice)
      const alreadyScanned = passengersBoarded.find(p => p.rfidUId === rfidUId);
      if (alreadyScanned) {
        console.log('⚠️ Duplicate scan detected:', alreadyScanned.name);
        setIsScanning(false);
        Alert.alert(
          'Already Scanned',
          `${alreadyScanned.name} has already paid for this trip.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Keep scanning state while processing payment
      console.log('💳 Card detected, processing payment with fare:', routeFare);

      // FIXED: Pass routeFare to payment service
      const paymentResult = await PaymentService.processFare(
        rfidUId,
        driverId,
        shuttleId,
        routeId,
        null,      // tripId
        routeFare  // FIXED: Pass route's fare amount
      );

      // Add passenger to list
      if (paymentResult.success) {
        const passenger = {
          name: paymentResult.data.studentName,
          studentName: paymentResult.data.studentName, // Add studentName for consistency
          rfidUId: rfidUId,
          amount: paymentResult.data.fareAmount,
          fareAmount: paymentResult.data.fareAmount, // Add fareAmount for refund logic
          transactionId: paymentResult.transactionId || paymentResult.data?.transactionId,
          tripId: paymentResult.data?.tripId || null, // Add tripId for refund
          timestamp: new Date().toISOString()
        };
        
        setPassengersBoarded(prev => {
          const newList = [...prev, passenger];
          console.log('✅ Passenger added:', passenger.name);
          console.log('📊 Total passengers:', newList.length);
          return newList;
        });
      }

      if (paymentResult.success) {
        const data = paymentResult.data;
        navigation.navigate('Result', {
          success: true,
          studentName: data.studentName,
          fareAmount: data.fareAmount,
          previousBalance: data.previousBalance,
          newBalance: data.newBalance,
          rfidUId: rfidUId,
          userType: 'driver',
          offlineMode: paymentResult.offlineMode || paymentResult.mode === 'offline',
          transactionType: data.transactionType || paymentResult.transactionType || 'payment'
        });
      } else {
        const errorMsg = paymentResult.error?.error || paymentResult.message || 'Payment failed';
        const isInsufficientBalance = errorMsg.toLowerCase().includes('insufficient');

        console.log('❌ Payment failed:', errorMsg);

        navigation.navigate('Result', {
          success: false,
          message: isInsufficientBalance ? 'Please recharge' : 'Payment failed',
          error: errorMsg,
          rfidUId: rfidUId,
          userType: 'driver'
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Scan Error', 'Failed to read card. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleNext = () => {
    if (passengersBoarded.length === 0) {
      Alert.alert(
        'No Passengers Scanned',
        'You haven\'t scanned any passengers yet. Continue to route tracking anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => navigateToRouteTracking()
          }
        ]
      );
    } else {
      navigateToRouteTracking();
    }
  };

  const navigateToRouteTracking = () => {
    console.log('➡️ Going to route tracking with', passengersBoarded.length, 'passengers');
    
    // Navigate to RouteTracking WITHOUT starting the route yet
    navigation.navigate('RouteTracking', {
      driverId: driverId,
      name: driverName,
      shuttleId: shuttleId,
      selectedRoute: selectedRoute,
      passengersBoarded: passengersBoarded,
      routeFare: routeFare, // FIXED: Pass fare to tracking screen
      routeStarted: false
    });
  };

  const handleChangeRoute = () => {
    if (passengersBoarded.length > 0) {
      Alert.alert(
        'Change Route?',
        `You have ${passengersBoarded.length} passenger(s) scanned.\n\n⚠️ Their payments will be REFUNDED if you go back.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Refund & Go Back',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log(`💸 Starting refund for ${passengersBoarded.length} passengers`);
                
                let refundedCount = 0;
                const refundResults = [];

                // Process each passenger refund
                for (const passenger of passengersBoarded) {
                  try {
                    console.log(`💸 Refunding passenger: ${passenger.studentName || passenger.rfidUId}, Amount: ₱${passenger.fareAmount}`);
                    
                    const refundResult = await PaymentService.processRefund(
                      passenger.rfidUId,
                      driverId,
                      shuttleId,
                      routeId,
                      passenger.tripId,
                      passenger.fareAmount,
                      'Route changed by driver'
                    );

                    if (refundResult.success) {
                      refundedCount++;
                      refundResults.push({
                        studentName: refundResult.studentName || passenger.studentName,
                        amount: refundResult.fareAmount || passenger.fareAmount,
                        success: true
                      });
                      
                      console.log(`✅ Refund processed: ${refundResult.studentName || passenger.studentName} + ₱${refundResult.fareAmount || passenger.fareAmount}`);
                    } else {
                      refundResults.push({
                        studentName: passenger.studentName,
                        amount: passenger.fareAmount,
                        success: false,
                        error: refundResult.error?.message
                      });
                      
                      console.log(`❌ Refund failed: ${passenger.studentName} - ${refundResult.error?.message}`);
                    }
                  } catch (error) {
                    console.error(`❌ Refund error for ${passenger.studentName}:`, error);
                    refundResults.push({
                      studentName: passenger.studentName,
                      amount: passenger.fareAmount,
                      success: false,
                      error: error.message
                    });
                  }
                }

                console.log('✅ Refund result:', { refundedCount, total: passengersBoarded.length, results: refundResults });

                Alert.alert(
                  refundedCount > 0 ? 'Refunded!' : 'Refund Failed',
                  refundedCount > 0 
                    ? `${refundedCount} payment(s) refunded successfully${refundedCount < passengersBoarded.length ? ` (${passengersBoarded.length - refundedCount} failed)` : ''}`
                    : 'Could not process refunds. Please try again.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setPassengersBoarded([]);
                        navigation.replace('RouteSelection', {
                          name: driverName,
                          driverId: driverId,
                          shuttleId: shuttleId
                        });
                      }
                    }
                  ]
                );
              } catch (error) {
                console.error('Refund error:', error);
                Alert.alert('Refund Failed', 'Could not process refunds. Please try again.');
              }
            }
          }
        ]
      );
    } else {
      navigation.replace('RouteSelection', {
        name: driverName,
        driverId: driverId,
        shuttleId: shuttleId
      });
    }
  };

  // Refund a specific passenger
  const handleRefundPassenger = (passenger) => {
    Alert.alert(
      'Refund Passenger?',
      `Refund ₱${passenger.fareAmount.toFixed(2)} to ${passenger.studentName || passenger.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: async () => {
            setRefundingId(passenger.rfidUId);
            try {
              const refundResult = await PaymentService.processRefund(
                passenger.rfidUId,
                driverId,
                shuttleId,
                routeId,
                passenger.tripId,
                passenger.fareAmount,
                'Refunded by driver before route start'
              );

              if (refundResult.success) {
                // Remove passenger from list
                setPassengersBoarded(prev => prev.filter(p => p.rfidUId !== passenger.rfidUId));
                Alert.alert('Refunded', `₱${passenger.fareAmount.toFixed(2)} refunded to ${passenger.studentName || passenger.name}`);
              } else {
                Alert.alert('Refund Failed', refundResult.error?.message || refundResult.error?.error || 'Could not process refund');
              }
            } catch (error) {
              console.error('Refund error:', error);
              Alert.alert('Error', 'Failed to process refund. Please try again.');
            } finally {
              setRefundingId(null);
            }
          }
        }
      ]
    );
  };

  // Calculate total fare using actual amounts paid
  const totalFareCollected = passengersBoarded.reduce((sum, p) => sum + (p.fareAmount || routeFare), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleChangeRoute} style={styles.backButton}>
            <View style={styles.iconWrapper}>
              <Text style={styles.backIcon}>←</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.routeInfo}>
            <Text style={styles.routeName} numberOfLines={1}>
              {selectedRoute?.shortName || selectedRoute?.name || 'No Route'}
            </Text>
            <Text style={styles.shuttleText}>
              {shuttleId} • ₱{routeFare.toFixed(2)}/fare
            </Text>
          </View>

          <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
            <Text style={styles.nextButtonLabel}>Start</Text>
            <Text style={styles.nextIcon}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Status Bar */}
        <View style={[styles.statusBar, !isOnline && styles.statusBarOffline]}>
          <View style={styles.statusContent}>
            <View style={[styles.statusDot, !isOnline && styles.statusDotOffline]} />
            <Text style={styles.statusText}>
              {statusMessage}
            </Text>
          </View>
          <View style={styles.statusButtons}>
            {isOnline && (
              <TouchableOpacity onPress={handleCacheUsers} style={styles.cacheBtn}>
                <Text style={styles.cacheText}>Cache Users</Text>
              </TouchableOpacity>
            )}
            {!isOnline && queueCount > 0 && (
              <TouchableOpacity onPress={handleSync} style={styles.syncBtn} disabled={isSyncing}>
                <Text style={styles.syncText}>{isSyncing ? '...' : 'Sync'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'scan' && styles.tabActive]}
            onPress={() => setActiveTab('scan')}
          >
            <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
              Scan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'passengers' && styles.tabActive]}
            onPress={() => setActiveTab('passengers')}
          >
            <Text style={[styles.tabText, activeTab === 'passengers' && styles.tabTextActive]}>
              Passengers ({passengersBoarded.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* SCAN TAB */}
        {activeTab === 'scan' && (
          <View style={styles.mainContent}>
            {/* Passenger Count */}
            <View style={styles.passengerSection}>
              <Text style={styles.passengerLabel}>Passengers Boarded</Text>
              <Text style={styles.passengerCount}>{passengersBoarded.length}</Text>
              {passengersBoarded.length === 0 && (
                <Text style={styles.scanHint}>
                  Tap "Scan Card" below to collect fares
                </Text>
              )}
              <View style={styles.fareBox}>
                <Text style={styles.fareLabel}>Total Fare Collected:</Text>
                <Text style={styles.fareAmount}>₱{totalFareCollected.toFixed(2)}</Text>
              </View>
            </View>

            {/* Time & Date */}
            <View style={styles.timeSection}>
              <Text style={styles.time}>{currentTime}</Text>
              <Text style={styles.date}>{currentDate}</Text>
            </View>

            {/* Scan Button */}
            <View style={styles.scanSection}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[
                    styles.scanButton,
                    isScanning && styles.scanButtonActive,
                    !isReady && styles.scanButtonDisabled
                  ]}
                  onPress={handleScan}
                  disabled={!isReady}
                  activeOpacity={0.8}
                >
                  <Text style={styles.scanIcon}>📱</Text>
                  <Text style={styles.scanText}>
                    {isScanning ? 'TAP TO STOP' : 'TAP TO SCAN'}
                  </Text>
                  <View style={styles.nfcStatus}>
                    <View style={[styles.nfcDot, isReady && styles.nfcDotActive]} />
                    <Text style={styles.nfcStatusText}>
                      {isReady ? 'NFC Ready' : 'NFC Disabled'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )}

        {/* PASSENGERS TAB */}
        {activeTab === 'passengers' && (
          <View style={styles.passengersTab}>
            <View style={styles.passengersTabHeader}>
              <Text style={styles.passengersTabTitle}>Scanned Passengers</Text>
              <Text style={styles.passengersTabSubtitle}>
                Tap a passenger to refund their fare
              </Text>
            </View>

            {passengersBoarded.length === 0 ? (
              <View style={styles.emptyPassengers}>
                <Text style={styles.emptyPassengersIcon}>👥</Text>
                <Text style={styles.emptyPassengersText}>No passengers scanned yet</Text>
                <TouchableOpacity
                  style={styles.goToScanBtn}
                  onPress={() => setActiveTab('scan')}
                >
                  <Text style={styles.goToScanBtnText}>Go to Scan</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.passengersList} showsVerticalScrollIndicator={false}>
                {passengersBoarded.map((passenger, index) => (
                  <View key={passenger.rfidUId} style={styles.passengerCard}>
                    <View style={styles.passengerCardLeft}>
                      <View style={styles.passengerNumber}>
                        <Text style={styles.passengerNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.passengerInfo}>
                        <Text style={styles.passengerName} numberOfLines={1}>
                          {passenger.studentName || passenger.name}
                        </Text>
                        <Text style={styles.passengerMeta}>
                          ₱{(passenger.fareAmount || routeFare).toFixed(2)} • {new Date(passenger.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.refundBtn, refundingId === passenger.rfidUId && styles.refundBtnDisabled]}
                      onPress={() => handleRefundPassenger(passenger)}
                      disabled={refundingId === passenger.rfidUId}
                    >
                      <Text style={styles.refundBtnText}>
                        {refundingId === passenger.rfidUId ? '...' : 'Refund'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.passengersSummary}>
                  <View style={styles.fareBox}>
                    <Text style={styles.fareLabel}>Total Collected:</Text>
                    <Text style={styles.fareAmount}>₱{totalFareCollected.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={{ height: 30 }} />
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#181D40',
  },
  container: {
    flex: 1,
    backgroundColor: '#181D40',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 212, 28, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFD41C',
    overflow: 'hidden',
  },
  iconWrapper: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#FFD41C',
    fontWeight: '600',
  },
  routeInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  routeName: {
    fontSize: 15,
    color: '#FFD41C',
    fontWeight: '700',
    textAlign: 'center',
  },
  shuttleText: {
    fontSize: 12,
    color: '#FBFBFB',
    opacity: 0.6,
    marginTop: 3,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#FFD41C',
    shadowColor: '#FFD41C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonLabel: {
    fontSize: 14,
    color: '#181D40',
    fontWeight: '700',
    marginRight: 5,
  },
  nextIcon: {
    fontSize: 20,
    color: '#181D40',
    fontWeight: '700',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#10B981',
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  statusBarOffline: {
    backgroundColor: '#F59E0B',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBFBFB',
    marginRight: 8,
  },
  statusDotOffline: {
    backgroundColor: '#1E1E1E',
  },
  statusText: {
    fontSize: 13,
    color: '#FBFBFB',
    fontWeight: '600',
  },
  statusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cacheBtn: {
    backgroundColor: 'rgba(34,197,94,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.5)',
  },
  cacheText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '700',
  },
  syncBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncText: {
    fontSize: 12,
    color: '#FBFBFB',
    fontWeight: '700',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-around',
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  scanSection: {
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#35408E',
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#FFD41C',
    shadowColor: '#FFD41C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 12,
  },
  scanButtonActive: {
    backgroundColor: '#4B5BAD',
    borderColor: '#10B981',
  },
  scanButtonDisabled: {
    backgroundColor: '#2A2F54',
    borderColor: '#6B7280',
    opacity: 0.5,
  },
  scanIcon: {
    fontSize: 70,
    marginBottom: 12,
  },
  scanText: {
    fontSize: 20,
    color: '#FFD41C',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  nfcStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  nfcDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#6B7280',
    marginRight: 7,
  },
  nfcDotActive: {
    backgroundColor: '#10B981',
  },
  nfcStatusText: {
    fontSize: 12,
    color: '#FBFBFB',
    fontWeight: '600',
  },
  timeSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  time: {
    fontSize: 35,
    fontWeight: '700',
    color: '#FBFBFB',
    letterSpacing: 2,
    marginBottom: 6,
  },
  date: {
    fontSize: 16,
    color: '#FBFBFB',
    opacity: 0.7,
    fontWeight: '500',
  },
  passengerSection: {
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    padding: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#35408E',
  },
  passengerLabel: {
    fontSize: 14,
    color: '#FBFBFB',
    opacity: 0.7,
    marginBottom: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  passengerCount: {
    fontSize: 65,
    fontWeight: '700',
    color: '#FFD41C',
    marginBottom: 20,
  },
  fareBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#35408E',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  fareLabel: {
    fontSize: 15,
    color: '#FBFBFB',
    opacity: 0.8,
    fontWeight: '600',
  },
  fareAmount: {
    fontSize: 22,
    color: '#10B981',
    fontWeight: '700',
  },
  scanHint: {
    color: '#FFD41C',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#35408E',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#35408E',
  },
  tabText: {
    fontSize: 14,
    color: '#FBFBFB',
    opacity: 0.6,
    fontWeight: '600',
  },
  tabTextActive: {
    opacity: 1,
    color: '#FFD41C',
  },
  // Passengers tab styles
  passengersTab: {
    flex: 1,
    paddingHorizontal: 20,
  },
  passengersTabHeader: {
    marginBottom: 15,
  },
  passengersTabTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FBFBFB',
    marginBottom: 4,
  },
  passengersTabSubtitle: {
    fontSize: 13,
    color: '#FBFBFB',
    opacity: 0.6,
  },
  emptyPassengers: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPassengersIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyPassengersText: {
    fontSize: 16,
    color: '#FBFBFB',
    opacity: 0.6,
    marginBottom: 20,
  },
  goToScanBtn: {
    backgroundColor: '#FFD41C',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goToScanBtnText: {
    color: '#181D40',
    fontSize: 16,
    fontWeight: '700',
  },
  passengersList: {
    flex: 1,
  },
  passengerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#35408E',
  },
  passengerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#35408E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  passengerNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD41C',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FBFBFB',
    marginBottom: 3,
  },
  passengerMeta: {
    fontSize: 12,
    color: '#FBFBFB',
    opacity: 0.6,
  },
  refundBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginLeft: 10,
  },
  refundBtnDisabled: {
    opacity: 0.4,
  },
  refundBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  passengersSummary: {
    marginTop: 10,
  },
});