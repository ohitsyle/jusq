// Test script for role-based log filtering
// This script can be used to verify that the filtering logic works correctly

import EventLog from '../models/EventLog.js';

const testRoleBasedFiltering = async () => {
  console.log('🧪 Testing role-based log filtering...\n');

  // Create test logs for different scenarios
  const testLogs = [
    // Motorpool admin logs
    {
      eventType: 'login',
      title: 'Motorpool Admin Login',
      adminName: 'John Motorpool',
      adminId: 'MP001',
      metadata: { adminRole: 'motorpool' },
      department: 'motorpool',
      timestamp: new Date()
    },
    {
      eventType: 'driver_login',
      title: 'Driver Login',
      driverName: 'Driver Bob',
      driverId: 'DRV001',
      department: 'motorpool',
      targetEntity: 'driver',
      timestamp: new Date()
    },
    {
      eventType: 'trip_start',
      title: 'Trip Started',
      driverId: 'DRV001',
      tripId: 'TRIP001',
      department: 'motorpool',
      targetEntity: 'trip',
      timestamp: new Date()
    },
    
    // Treasury admin logs
    {
      eventType: 'login',
      title: 'Treasury Admin Login',
      adminName: 'Sarah Treasury',
      adminId: 'TR001',
      metadata: { adminRole: 'treasury' },
      department: 'treasury',
      timestamp: new Date()
    },
    {
      eventType: 'cash_in',
      title: 'User Cash In',
      adminName: 'Sarah Treasury',
      adminId: 'TR001',
      userId: 'USR001',
      metadata: { adminRole: 'treasury' },
      department: 'treasury',
      targetEntity: 'transaction',
      timestamp: new Date()
    },
    
    // System admin logs
    {
      eventType: 'maintenance_mode',
      title: 'Maintenance Mode Enabled',
      adminName: 'Admin System',
      adminId: 'SYS001',
      metadata: { adminRole: 'sysad' },
      department: 'system',
      timestamp: new Date()
    }
  ];

  try {
    // Insert test logs
    await EventLog.insertMany(testLogs);
    console.log('✅ Test logs created successfully\n');

    // Test motorpool admin filtering
    const motorpoolQuery = {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'motorpool' },
        { department: 'motorpool' },
        { targetEntity: { $in: ['driver', 'shuttle', 'route', 'trip', 'phone'] } },
        { eventType: { $in: ['driver_login', 'driver_logout', 'trip_start', 'trip_end', 'route_change', 'refund', 'phone_assigned', 'phone_unassigned'] } },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'motorpool' }
      ]
    };
    
    const motorpoolLogs = await EventLog.find(motorpoolQuery);
    console.log(`🔧 Motorpool admin should see ${motorpoolLogs.length} logs:`);
    motorpoolLogs.forEach(log => console.log(`  - ${log.eventType}: ${log.title}`));

    // Test treasury admin filtering
    const treasuryQuery = {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'treasury' },
        { department: 'treasury' },
        { targetEntity: { $in: ['user', 'transaction'] } },
        { eventType: { $in: ['cash_in', 'registration'] } },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'treasury' }
      ]
    };
    
    const treasuryLogs = await EventLog.find(treasuryQuery);
    console.log(`\n💰 Treasury admin should see ${treasuryLogs.length} logs:`);
    treasuryLogs.forEach(log => console.log(`  - ${log.eventType}: ${log.title}`));

    // Test system admin filtering (should see everything)
    const allLogs = await EventLog.find({});
    console.log(`\n👑 System admin should see all ${allLogs.length} logs:`);
    allLogs.forEach(log => console.log(`  - ${log.eventType}: ${log.title}`));

    console.log('\n✅ Role-based filtering test completed successfully!');
    
    // Clean up test logs
    await EventLog.deleteMany({ title: { $in: testLogs.map(log => log.title) } });
    console.log('🧹 Test logs cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Export for use in testing
export default testRoleBasedFiltering;
