// nucash-server/routes/systemAlerts.js
// System alerts: sysad CRUD + a public "active" feed for end-users.

import express from 'express';
import SystemAlert from '../models/SystemAlert.js';

const router = express.Router();

// GET /api/system-alerts/active  -> active alerts for end-users (newest first)
router.get('/active', async (req, res) => {
  try {
    const alerts = await SystemAlert.find({ active: true }).sort({ createdAt: -1 }).lean();
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/system-alerts  -> all alerts (sysad management)
router.get('/', async (req, res) => {
  try {
    const alerts = await SystemAlert.find().sort({ createdAt: -1 }).lean();
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// POST /api/system-alerts  -> create
router.post('/', async (req, res) => {
  try {
    const { title, message, severity, active } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const alert = await SystemAlert.create({
      title,
      message,
      severity: severity || 'info',
      active: active !== undefined ? active : true,
      createdBy: req.adminName || 'System Administrator'
    });
    res.status(201).json(alert);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// PUT /api/system-alerts/:id  -> update (toggle active, edit)
router.put('/:id', async (req, res) => {
  try {
    const { title, message, severity, active } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (message !== undefined) update.message = message;
    if (severity !== undefined) update.severity = severity;
    if (active !== undefined) update.active = active;
    const alert = await SystemAlert.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// DELETE /api/system-alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    const alert = await SystemAlert.findByIdAndDelete(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert deleted' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
