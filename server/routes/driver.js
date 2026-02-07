// nucash-server/routes/driver.js
import express from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import Driver from '../models/Driver.js';

// Driver login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find driver in database
    const driver = await Driver.findOne({ username, isActive: true });

    if (!driver) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password (TODO: use bcrypt in production)
    if (driver.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        username: driver.username,
        driverId: driver.driverId,
        shuttleId: driver.shuttleId,
        role: 'driver'
      },
      process.env.JWT_SECRET || 'nucash_secret_2025',
      { expiresIn: '24h' }
    );

    // Log driver login with proper department tracking
    const { logDriverLogin } = await import('../utils/logger.js');
    await logDriverLogin({
      driverId: driver.driverId,
      driverName: driver.name,
      deviceInfo: req.headers['user-agent'],
      ipAddress: req.ip,
      timestamp: new Date()
    });

    return res.json({
      success: true,
      token,
      driverId: driver.driverId,
      name: driver.name,
      shuttleId: driver.shuttleId,
      role: 'driver'
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nucash_secret_2025');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get driver profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const driver = await Driver.findOne({ driverId: req.user.driverId });
    
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json({
      driverId: driver.driverId,
      name: driver.name,
      username: driver.username,
      shuttleId: driver.shuttleId
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Driver logout endpoint
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const driver = await Driver.findOne({ driverId: req.user.driverId });
    
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Log driver logout with proper department tracking
    const { logDriverLogout } = await import('../utils/logger.js');
    await logDriverLogout({
      driverId: driver.driverId,
      driverName: driver.name,
      sessionDuration: req.body.sessionDuration || null,
      timestamp: new Date()
    });

    return res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;