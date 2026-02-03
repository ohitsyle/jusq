// Client-side debug script - add this to your browser console
// This will help debug what's happening with the logs

console.log('🔍 Debugging client-side logs...');

// Check admin data in localStorage
const adminData = localStorage.getItem('adminData');
console.log('📦 AdminData in localStorage:', adminData);

if (adminData) {
  try {
    const admin = JSON.parse(adminData);
    console.log('👤 Parsed admin data:', admin);
    console.log('🏷️ Admin role:', admin.role);
    console.log('🆔 Admin ID:', admin.adminId);
    console.log('📛 Admin name:', `${admin.firstName} ${admin.lastName}`);
  } catch (e) {
    console.error('❌ Failed to parse adminData:', e);
  }
} else {
  console.log('⚠️ No adminData found in localStorage');
}

// Check API headers being sent
console.log('🌐 Testing API call...');
fetch('/api/admin/event-logs?department=motorpool')
  .then(response => {
    console.log('📡 API response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('📊 Logs received:', data.length);
    console.log('📋 Sample logs:', data.slice(0, 3));
  })
  .catch(error => {
    console.error('❌ API call failed:', error);
  });

// Check what the current page thinks the admin role is
const currentAdminData = localStorage.getItem('adminData');
const currentRole = currentAdminData ? JSON.parse(currentAdminData).role : 'unknown';
console.log('🎯 Current page role:', currentRole);

// Manual API test with different departments
const departments = ['motorpool', 'treasury', 'merchant', 'accounting', 'sysad'];
departments.forEach(dept => {
  fetch(`/api/admin/event-logs?department=${dept}`)
    .then(response => response.json())
    .then(data => {
      console.log(`📊 ${dept}: ${data.length} logs`);
    })
    .catch(error => {
      console.log(`❌ ${dept}: Error -`, error.message);
    });
});
