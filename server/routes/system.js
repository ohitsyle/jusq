// nucash-server/routes/system.js
// System routes for settings and configuration

import express from 'express';
const router = express.Router();
import Setting from '../models/Setting.js';

// Get current settings
router.get('/config', async (req, res) => {
  try {
    let setting = await Setting.findOne();
    
    if (!setting) {
      // Create default settings if none exist
      setting = await Setting.create({
        currentFare: 15,
        negativeLimit: -14,
        updatedBy: 'System'
      });
    }
    
    res.json({
      currentFare: setting.currentFare,
      negativeLimit: setting.negativeLimit,
      lastUpdated: setting.updatedAt
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.put('/config', async (req, res) => {
  try {
    const { currentFare } = req.body;

    let setting = await Setting.findOne();

    const fare = currentFare !== undefined ? currentFare : (setting?.currentFare || 15);
    // negativeLimit is always -(fare - 1): student needs ₱1 minimum to ride
    const computedNegativeLimit = -(fare - 1);

    if (!setting) {
      setting = new Setting({
        currentFare: fare,
        negativeLimit: computedNegativeLimit,
        updatedBy: 'Admin'
      });
    } else {
      if (currentFare !== undefined) setting.currentFare = currentFare;
      setting.negativeLimit = computedNegativeLimit;
      setting.updatedBy = 'Admin';
      setting.updatedAt = new Date();
    }
    
    await setting.save();
    
    res.json({
      message: 'Settings updated successfully',
      settings: {
        currentFare: setting.currentFare,
        negativeLimit: setting.negativeLimit
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;