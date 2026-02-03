// Quick test script to populate sample logs and verify filtering
import EventLog from './models/EventLog.js';
import mongoose from 'mongoose';

const sampleLogs = [
  {
    eventId: 'EVT001',
    eventType: 'login',
    title: 'Admin Login',
    description: 'Motorpool admin logged in successfully',
    severity: 'info',
    adminId: 'MP001',
    adminName: 'John Motorpool',
    department: 'motorpool',
    targetEntity: 'admin',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    metadata: {
      adminRole: 'motorpool',
      userType: 'Admin (motorpool)',
      deviceInfo: 'Mozilla/5.0...'
    }
  },
  {
    eventId: 'EVT002',
    eventType: 'login',
    title: 'Admin Login',
    description: 'Treasury admin logged in successfully',
    severity: 'info',
    adminId: 'TR001',
    adminName: 'Sarah Treasury',
    department: 'treasury',
    targetEntity: 'admin',
    timestamp: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
    metadata: {
      adminRole: 'treasury',
      userType: 'Admin (treasury)',
      deviceInfo: 'Mozilla/5.0...'
    }
  },
  {
    eventId: 'EVT003',
    eventType: 'crud_create',
    title: 'Driver Created',
    description: 'Motorpool admin created a new driver',
    severity: 'info',
    adminId: 'MP001',
    adminName: 'John Motorpool',
    department: 'motorpool',
    targetEntity: 'driver',
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    metadata: {
      adminRole: 'motorpool',
      crudOperation: 'crud_create',
      targetId: 'DRV001'
    }
  },
  {
    eventId: 'EVT004',
    eventType: 'cash_in',
    title: 'User Cash In',
    description: 'Treasury admin processed cash in for student',
    severity: 'info',
    adminId: 'TR001',
    adminName: 'Sarah Treasury',
    department: 'treasury',
    targetEntity: 'transaction',
    timestamp: new Date(Date.now() - 1000 * 60 * 20), // 20 minutes ago
    metadata: {
      adminRole: 'treasury',
      userId: 'STU001',
      amount: 500
    }
  },
  {
    eventId: 'EVT005',
    eventType: 'driver_login',
    title: 'Driver Login',
    description: 'Driver logged into mobile app',
    severity: 'info',
    driverId: 'DRV001',
    driverName: 'Bob Driver',
    department: 'motorpool',
    targetEntity: 'driver',
    timestamp: new Date(Date.now() - 1000 * 60 * 25), // 25 minutes ago
    metadata: {
      deviceInfo: 'Mobile App'
    }
  }
];

async function testLogs() {
  try {
    await mongoose.connect('mongodb://localhost:27017/nucash');
    console.log('🔗 Connected to MongoDB');

    // Clear existing logs
    await EventLog.deleteMany({});
    console.log('🧹 Cleared existing logs');

    // Insert sample logs
    await EventLog.insertMany(sampleLogs);
    console.log('📝 Inserted sample logs');

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
    console.log(`\n🔧 Motorpool admin should see ${motorpoolLogs.length} logs:`);
    motorpoolLogs.forEach(log => {
      console.log(`  - ${log.eventType}: ${log.title} (${log.adminName || log.driverName})`);
    });

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
    treasuryLogs.forEach(log => {
      console.log(`  - ${log.eventType}: ${log.title} (${log.adminName || log.driverName})`);
    });

    // Test system admin (should see everything)
    const allLogs = await EventLog.find({});
    console.log(`\n👑 System admin should see all ${allLogs.length} logs:`);
    allLogs.forEach(log => {
      console.log(`  - ${log.eventType}: ${log.title} (${log.adminName || log.driverName})`);
    });

    console.log('\n✅ Test completed! Logs are now available in the database.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testLogs();
