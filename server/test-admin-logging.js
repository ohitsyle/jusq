// Test script to verify admin logging is working
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';

async function testAdminLogging() {
  try {
    console.log('🧪 Testing admin logging...\n');

    // Simulate a motorpool admin creating a driver
    const adminHeaders = {
      'Content-Type': 'application/json',
      'X-Admin-Id': 'MP001',
      'X-Admin-Name': 'John Motorpool',
      'X-Admin-Role': 'motorpool',
      'X-Admin-Department': 'motorpool'
    };

    const driverData = {
      driverId: 'TEST001',
      firstName: 'Test',
      lastName: 'Driver',
      email: 'test.driver@example.com',
      phone: '1234567890',
      licenseNumber: 'LIC123456',
      isActive: true
    };

    console.log('📝 Creating driver with admin logging...');
    const response = await fetch(`${API_BASE}/admin/drivers`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(driverData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const driver = await response.json();
    console.log('✅ Driver created:', driver.driverId);

    // Test updating the driver
    console.log('\n📝 Updating driver with admin logging...');
    const updateResponse = await fetch(`${API_BASE}/admin/drivers/${driver._id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        firstName: 'Test Updated',
        phone: '0987654321'
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`HTTP error! status: ${updateResponse.status}`);
    }

    const updatedDriver = await updateResponse.json();
    console.log('✅ Driver updated:', updatedDriver.firstName);

    // Test deleting the driver
    console.log('\n📝 Deleting driver with admin logging...');
    const deleteResponse = await fetch(`${API_BASE}/admin/drivers/${driver._id}`, {
      method: 'DELETE',
      headers: adminHeaders
    });

    if (!deleteResponse.ok) {
      throw new Error(`HTTP error! status: ${deleteResponse.status}`);
    }

    console.log('✅ Driver deleted');

    // Check the logs
    console.log('\n📋 Checking logs...');
    const logsResponse = await fetch(`${API_BASE}/admin/event-logs?department=motorpool`);
    const logs = await logsResponse.json();
    console.log(`Found ${logs.length} logs for motorpool admin:`);
    
    logs.forEach(log => {
      console.log(`  - ${log.eventType}: ${log.title} by ${log.adminName} (${log.metadata?.adminRole})`);
    });

    console.log('\n🎉 Admin logging test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAdminLogging();
