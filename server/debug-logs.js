// Debug script to check admin data and API calls
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

async function debugAdminLogs() {
  try {
    console.log('🔍 Debugging admin logs...\n');

    // Test different admin roles
    const testRoles = ['motorpool', 'treasury', 'merchant', 'accounting', 'sysad'];
    
    for (const role of testRoles) {
      console.log(`\n📝 Testing role: ${role}`);
      
      try {
        const response = await axios.get(`${API_BASE}/admin/event-logs?department=${role}`);
        console.log(`  ✅ Found ${response.data.length} logs for ${role}`);
        
        if (response.data.length > 0) {
          console.log('  📋 Sample logs:');
          response.data.slice(0, 3).forEach(log => {
            console.log(`    - ${log.eventType}: ${log.title} (${log.adminName || 'Unknown'})`);
          });
        }
      } catch (error) {
        console.log(`  ❌ Error for ${role}:`, error.response?.status, error.response?.data || error.message);
      }
    }

    // Test without department parameter (should return all)
    console.log('\n📝 Testing without department filter:');
    try {
      const response = await axios.get(`${API_BASE}/admin/event-logs`);
      console.log(`  ✅ Found ${response.data.length} total logs`);
    } catch (error) {
      console.log(`  ❌ Error:`, error.response?.status, error.response?.data || error.message);
    }

    // Check if server is running
    console.log('\n🔗 Testing server connection:');
    try {
      const healthResponse = await axios.get(`${API_BASE}/health`);
      console.log(`  ✅ Server is running:`, healthResponse.status);
    } catch (error) {
      console.log(`  ❌ Server connection failed:`, error.message);
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
  }
}

debugAdminLogs();
