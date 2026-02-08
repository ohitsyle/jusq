// nucash-server/server.js
// FIXED: Using dynamic imports and index.js aggregator

import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import http from 'http';

// ES6 module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// CORS Configuration - Allow credentials from frontend
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://18.166.29.239:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public', 'dist')));

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nucash';

mongoose.connect(mongoUri)
  .then(() => {
    console.log('✅ MongoDB connected');
    // Initialize auto-export cron job after DB connection
    initializeAutoExportCron();
    // Initialize deactivation scheduler cron job
    initializeDeactivationCron(getSystemConfig, setSchedulerExecuted);
  })
  .catch(e => console.error('❌ MongoDB connection error:', e));

// Import centralized routes (from routes/index.js)
import apiRoutes from './routes/index.js';
import adminAuthRoutes from './routes/adminauth.js';
import adminRoutes from './routes/admin.js';
import merchantAuthRoutes from './routes/merchantauth.js';
import merchantAdminRoutes from './routes/merchantadmin.js';
import promotionsRoutes from './routes/promotions.js';
import configurationsRoutes from './routes/configurations.js';
import userDashboardRoutes from './routes/userdashboard.js';
import activationRoutes from './routes/activation.js';
import treasuryRoutes from './routes/treasury.js';
import accountingRoutes from './routes/accounting.js';
import sysadRoutes, { getSystemConfig, setSchedulerExecuted } from './routes/sysad.js';
import websocketRoutes from './routes/websocket.js';
import { initializeAutoExportCron } from './jobs/autoExportCron.js';
import { initializeDeactivationCron } from './jobs/deactivationCron.js';
import { checkMaintenanceMode } from './middlewares/maintenanceMode.js';
import websocketService from './services/websocketService.js';

// Apply maintenance mode middleware to all routes (but we'll handle auth checking inside)
app.use(checkMaintenanceMode);

// Mount all API routes at /api
// NOTE: More specific routes MUST come before more general routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/treasury', treasuryRoutes);
app.use('/api/admin/accounting', accountingRoutes);
app.use('/api/admin/sysad', sysadRoutes);
app.use('/api/admin/promotions', promotionsRoutes);
app.use('/api/admin/configurations', configurationsRoutes);
app.use('/api/admin', adminRoutes); // General admin routes AFTER specific admin/* routes
app.use('/api/merchant/auth', merchantAuthRoutes);
app.use('/api/merchant', merchantAdminRoutes);
app.use('/api/treasury', treasuryRoutes); // Also mount at /api/treasury for client compatibility
app.use('/api/user', userDashboardRoutes);
app.use('/api/activation', activationRoutes);
app.use('/api/websocket', websocketRoutes);
app.use('/api', apiRoutes); // General API routes last

// Serve admin dashboard (production build)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dist', 'index.html'));
});

// Serve motorpool admin dashboard
app.get('/motorpool', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dist', 'index.html'));
});

// Serve merchant admin dashboard (production build)
app.get('/merchant', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dist', 'index.html'));
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dist', 'index.html'));
});

// Serve activation page
app.get('/activate', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'activate.html'));
});

// Serve force logout page
app.get('/force-logout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'force-logout.html'));
});

// Catch-all handler for React Router - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't intercept API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/assets')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'dist', 'index.html'));
});

// DEBUG: Check all users in database
app.get('/debug/users', async (req, res) => {
  try {
    const User = (await import('./models/User.js')).default;
    const users = await User.find({}).select('email isActive createdAt');
    res.json({
      count: users.length,
      users: users.map(u => ({
        email: u.email,
        isActive: u.isActive,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'NUCash API Server',
    version: '3.0.0',
    status: 'online',
    endpoints: {
      mobile: '/api',
      admin: '/admin',
      motorpool: '/motorpool',
      health: '/health'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    status: dbStatus === 1 ? 'healthy' : 'unhealthy',
    timestamp: new Date(),
    database: dbStates[dbStatus],
    uptime: process.uptime()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '3.0.0',
    schema: 'v3.0'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Initialize WebSocket service
websocketService.initialize(server);

server.listen(PORT, HOST, () => {
  // Get local network IP
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';

  // Find the first non-internal IPv4 address
  for (const [name, addresses] of Object.entries(networkInterfaces)) {
    for (const addr of addresses) {
      if (addr.family === 'IPv4' && !addr.internal) {
        localIP = addr.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }

  console.log('\n🚀 NUCash Server Started!');
  console.log('┌────────────────────────────────────────┐');
  console.log(`│ 📱 Mobile API:        http://localhost:${PORT}/api`);
  console.log(`│ 🌐 Network Access:    http://${localIP}:${PORT}/api`);
  console.log(`│ 🖥️  Admin Dashboard:   http://localhost:${PORT}/admin`);
  console.log(`│ 🚌 Motorpool Admin:   http://localhost:${PORT}/motorpool`);
  console.log(`│ 💚 Health Check:      http://localhost:${PORT}/health`);
  console.log(`│ 🔌 WebSocket Ready:    ws://${localIP}:${PORT}`);
  console.log(`│ 🧪 Test Endpoint:     http://localhost:${PORT}/api/test`);
  console.log('└────────────────────────────────────────┘');
  console.log('\n✅ Available Endpoints:');
  console.log('   Mobile App:');
  console.log('   - GET  /api/user/balance/:rfidUid');
  console.log('   - POST /api/driver/login');
  console.log('   - POST /api/shuttle/pay');
  console.log('   - POST /api/merchant/pay');
  console.log('   - GET  /api/geofences');
  console.log('   - GET  /api/system/config');
  console.log('   - GET  /api/routes');
  console.log('   - GET  /api/shuttles/available');
  console.log('   - POST /api/trips/start');
  console.log('   - GET  /api/analytics/dashboard');
  console.log('   - GET  /api/logs');
  console.log('');
  console.log('   Admin Dashboard:');
  console.log('   - GET  /api/admin/analytics');
  console.log('   - GET  /api/admin/drivers');
  console.log('   - POST /api/admin/drivers');
  console.log('   - PUT  /api/admin/drivers/:id');
  console.log('   - GET  /api/admin/shuttles');
  console.log('   - GET  /api/admin/routes');
  console.log('   - GET  /api/admin/phones');
  console.log('   - GET  /api/admin/event-logs');
  console.log('   - GET  /api/admin/user-concerns');
  console.log('┌────────────────────────────────────────┐');
  console.log('│ Schema v3.0 - ES6 Modules              │');
  console.log('└────────────────────────────────────────┘\n');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, closing server...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing MongoDB:', error);
    process.exit(1);
  }
});

export default app;