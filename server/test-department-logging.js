// Test script for department-specific logging functionality
// Tests all the new logging functions for each department

import {
  logDriverLogin,
  logDriverLogout,
  logDriverShuttleSelection,
  logDriverRouteChange,
  logMerchantLogin,
  logMerchantLogout,
  logCashIn,
  logAutoExportConfigChange,
  logManualExport,
  logMaintenanceMode,
  logStudentDeactivation,
  logLogin,
  logLogout,
  logAdminAction
} from './utils/logger.js';

async function testDepartmentLogging() {
  console.log('🧪 Testing Department-Specific Logging Functions...\n');

  try {
    // Test Motorpool Admin Logging
    console.log('🚌 Testing Motorpool Admin Logging...');
    
    await logDriverLogin({
      driverId: 'DRV001',
      driverName: 'Juan Santos',
      deviceInfo: 'iPhone 14',
      ipAddress: '192.168.1.100',
      timestamp: new Date()
    });
    console.log('✅ Driver login logged');

    await logDriverLogout({
      driverId: 'DRV001',
      driverName: 'Juan Santos',
      sessionDuration: 480,
      timestamp: new Date()
    });
    console.log('✅ Driver logout logged');

    await logDriverShuttleSelection({
      driverId: 'DRV001',
      driverName: 'Juan Santos',
      shuttleId: 'SH001',
      routeId: 'RT001',
      shuttlePlateNumber: 'ABC123',
      routeName: 'Main Campus Route',
      timestamp: new Date()
    });
    console.log('✅ Driver shuttle selection logged');

    await logDriverRouteChange({
      driverId: 'DRV001',
      driverName: 'Juan Santos',
      shuttleId: 'SH001',
      oldRouteId: 'RT001',
      newRouteId: 'RT002',
      refundAmount: 50,
      refundReason: 'Route change',
      timestamp: new Date()
    });
    console.log('✅ Driver route change logged');

    // Test Merchant Admin Logging
    console.log('\n🏪 Testing Merchant Admin Logging...');
    
    await logMerchantLogin({
      merchantId: 'MCH001',
      merchantName: 'Campus Cafe',
      deviceInfo: 'Android Phone',
      ipAddress: '192.168.1.101',
      timestamp: new Date()
    });
    console.log('✅ Merchant login logged');

    await logMerchantLogout({
      merchantId: 'MCH001',
      merchantName: 'Campus Cafe',
      sessionDuration: 360,
      timestamp: new Date()
    });
    console.log('✅ Merchant logout logged');

    // Test Treasury Admin Logging
    console.log('\n💰 Testing Treasury Admin Logging...');
    
    await logCashIn({
      adminId: 'TRS001',
      adminName: 'Maria Reyes',
      amount: 1000,
      userId: 'USR001',
      userName: 'John Doe',
      paymentMethod: 'cash',
      transactionId: 'TXN001',
      timestamp: new Date()
    });
    console.log('✅ Cash-in logged');

    // Test System Admin Logging
    console.log('\n⚙️ Testing System Admin Logging...');
    
    await logMaintenanceMode({
      adminId: 'SYS001',
      adminName: 'Admin User',
      enabled: true,
      reason: 'System update',
      estimatedDuration: '2 hours',
      timestamp: new Date()
    });
    console.log('✅ Maintenance mode logged');

    await logStudentDeactivation({
      adminId: 'SYS001',
      adminName: 'Admin User',
      enabled: true,
      reason: 'End of semester',
      affectedStudents: 'All students',
      timestamp: new Date()
    });
    console.log('✅ Student deactivation logged');

    // Test Export Logging (for all departments)
    console.log('\n📊 Testing Export Logging...');
    
    await logAutoExportConfigChange({
      adminId: 'ACC001',
      adminName: 'Accounting Admin',
      adminRole: 'accounting',
      department: 'accounting',
      configChanges: { frequency: 'daily', enabled: true },
      oldConfig: { frequency: 'weekly', enabled: false },
      newConfig: { frequency: 'daily', enabled: true },
      timestamp: new Date()
    });
    console.log('✅ Auto export config change logged');

    await logManualExport({
      adminId: 'ACC001',
      adminName: 'Accounting Admin',
      adminRole: 'accounting',
      department: 'accounting',
      exportType: 'transactions',
      dateRange: '2024-01-01 to 2024-01-31',
      recordCount: 1500,
      timestamp: new Date()
    });
    console.log('✅ Manual export logged');

    // Test Admin Authentication Logging
    console.log('\n🔐 Testing Admin Authentication Logging...');
    
    await logLogin({
      adminId: 'MTR001',
      adminName: 'Motorpool Admin',
      userType: 'Admin (motorpool)',
      adminRole: 'motorpool',
      department: 'motorpool',
      ipAddress: '192.168.1.102',
      deviceInfo: 'Chrome Browser'
    });
    console.log('✅ Motorpool admin login logged');

    await logLogin({
      adminId: 'TRS001',
      adminName: 'Treasury Admin',
      userType: 'Admin (treasury)',
      adminRole: 'treasury',
      department: 'treasury',
      ipAddress: '192.168.1.103',
      deviceInfo: 'Firefox Browser'
    });
    console.log('✅ Treasury admin login logged');

    await logLogin({
      adminId: 'MCH001',
      adminName: 'Merchant Admin',
      userType: 'Admin (merchant)',
      adminRole: 'merchant',
      department: 'merchant',
      ipAddress: '192.168.1.104',
      deviceInfo: 'Safari Browser'
    });
    console.log('✅ Merchant admin login logged');

    await logLogin({
      adminId: 'ACC001',
      adminName: 'Accounting Admin',
      userType: 'Admin (accounting)',
      adminRole: 'accounting',
      department: 'accounting',
      ipAddress: '192.168.1.105',
      deviceInfo: 'Edge Browser'
    });
    console.log('✅ Accounting admin login logged');

    await logLogin({
      adminId: 'SYS001',
      adminName: 'System Admin',
      userType: 'Admin (sysad)',
      adminRole: 'sysad',
      department: 'sysad',
      ipAddress: '192.168.1.106',
      deviceInfo: 'Opera Browser'
    });
    console.log('✅ System admin login logged');

    // Test CRUD Operations
    console.log('\n🔧 Testing CRUD Operations Logging...');
    
    await logAdminAction({
      adminId: 'MTR001',
      adminName: 'Motorpool Admin',
      adminRole: 'motorpool',
      department: 'motorpool',
      action: 'Driver Created',
      description: 'created driver DRV002 (Pedro Santos)',
      targetEntity: 'driver',
      targetId: 'DRV002',
      crudOperation: 'crud_create',
      changes: { name: 'Pedro Santos', license: 'LIC002' },
      ipAddress: '192.168.1.102'
    });
    console.log('✅ Motorpool CRUD operation logged');

    await logAdminAction({
      adminId: 'TRS001',
      adminName: 'Treasury Admin',
      adminRole: 'treasury',
      department: 'treasury',
      action: 'User Updated',
      description: 'updated user USR002 balance',
      targetEntity: 'user',
      targetId: 'USR002',
      crudOperation: 'crud_update',
      changes: { balance: 500 },
      ipAddress: '192.168.1.103'
    });
    console.log('✅ Treasury CRUD operation logged');

    console.log('\n✅ All department logging tests completed successfully!');
    console.log('📝 Check the EventLog collection in MongoDB to verify all logs were created.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDepartmentLogging().then(() => {
  console.log('\n🎉 Department logging test completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
