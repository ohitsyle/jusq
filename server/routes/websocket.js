// server/routes/websocket.js
// WebSocket status and management endpoints

import express from 'express';
import websocketService from '../services/websocketService.js';

const router = express.Router();

// Get WebSocket connection statistics
router.get('/stats', (req, res) => {
  try {
    const stats = websocketService.getStats();
    res.json({
      success: true,
      stats,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Force refresh all mobile clients
router.post('/refresh-mobile', (req, res) => {
  try {
    const { dataType = 'all' } = req.body;
    websocketService.forceMobileRefresh(dataType);
    
    res.json({
      success: true,
      message: `Force refresh sent to mobile clients for: ${dataType}`,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Force refresh all motorpool clients
router.post('/refresh-motorpool', (req, res) => {
  try {
    const { dataType = 'all' } = req.body;
    websocketService.forceMotorpoolRefresh(dataType);
    
    res.json({
      success: true,
      message: `Force refresh sent to motorpool clients for: ${dataType}`,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual broadcast for testing
router.post('/broadcast', (req, res) => {
  try {
    const { event, data, target = 'all' } = req.body;
    
    switch (target) {
      case 'mobile':
        websocketService.broadcastToMobile(event, data);
        break;
      case 'motorpool':
        websocketService.broadcastToMotorpool(event, data);
        break;
      case 'all':
      default:
        websocketService.broadcastToMobile(event, data);
        websocketService.broadcastToMotorpool(event, data);
        break;
    }
    
    res.json({
      success: true,
      message: `Broadcast sent: ${event} to ${target}`,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
