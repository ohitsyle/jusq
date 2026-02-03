// Test script to verify real-time polling functionality
// Run this in React Native debugger console

import WebSocketService from './src/services/WebSocketService.js';

// Test the WebSocket service
async function testRealTimeUpdates() {
  console.log('🧪 Testing real-time updates...');
  
  try {
    // Initialize WebSocket service
    const connected = await WebSocketService.initialize();
    console.log('🔌 WebSocket service initialized:', connected);
    
    // Add listener for updates
    WebSocketService.addListener('connected', (data) => {
      console.log('✅ Connected to real-time updates:', data);
    });
    
    WebSocketService.addListener('server_update', (data) => {
      console.log('📡 Server update received:', data);
    });
    
    WebSocketService.addListener('force_refresh', (data) => {
      console.log('🔄 Force refresh received:', data);
    });
    
    // Get status
    const status = WebSocketService.getStatus();
    console.log('📊 WebSocket status:', status);
    
    // Test manual refresh
    WebSocketService.requestSync('shuttles');
    console.log('🔄 Manual sync requested');
    
    console.log('✅ Real-time test completed');
    
  } catch (error) {
    console.error('❌ Real-time test failed:', error);
  }
}

// Export for use in React Native debugger
global.testRealTimeUpdates = testRealTimeUpdates;

console.log('📱 Test script loaded. Run testRealTimeUpdates() in debugger console');
