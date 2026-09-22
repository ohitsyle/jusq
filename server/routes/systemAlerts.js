// nucash-server/routes/systemAlerts.js
// System alerts: sysad CRUD + a public "active" feed for end-users.

import express from 'express';
import SystemAlert from '../models/SystemAlert.js';
import { extractAdminInfo } from '../middlewares/extractAdminInfo.js';
import { logAdminAction } from '../utils/logger.js';

const router = express.Router();
router.use(extractAdminInfo);

// Write alert mutations to the event log (visible in sysad Logs tab)
const logAlertAction = (req, action, description, alertId, crudOperation) => {
  logAdminAction({
    adminId: req.adminInfo?.adminId || 'sysad',
    adminName: req.adminInfo?.adminName || 'System Admin',
    adminRole: req.adminInfo?.adminRole || 'sysad',
    department: 'system',
    action,
    description,
    targetEntity: 'alert',
    targetId: String(alertId),
    crudOperation,
    ipAddress: req.ip
  }).catch(() => {});
};

// GET /api/system-alerts/active  -> active alerts for end-users (newest first)
router.get('/active', async (req, res) => {
  try {
    const alerts = await SystemAlert.find({
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
    }).sort({ createdAt: -1 }).lean();
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
    const { title, message, severity, active, expiresAt } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    const alert = await SystemAlert.create({
      title,
      message,
      severity: severity || 'info',
      active: active !== undefined ? active : true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.adminInfo?.adminName || 'System Administrator'
    });
    logAlertAction(req, 'Alert Posted', `posted ${alert.severity} alert "${alert.title}"`, alert._id, 'crud_create');
    res.status(201).json(alert);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// PUT /api/system-alerts/:id  -> update (toggle active, edit)
// expiresAt: omit to keep it, null for "never", or a date.
const SEVERITIES = ['info', 'warning', 'critical', 'success'];
router.put('/:id', async (req, res) => {
  try {
    const { title, message, severity, active, expiresAt } = req.body;
    const update = {};
    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ error: 'Title is required' });
      update.title = String(title).trim();
    }
    if (message !== undefined) {
      if (!String(message).trim()) return res.status(400).json({ error: 'Message is required' });
      update.message = String(message).trim();
    }
    if (severity !== undefined) {
      if (!SEVERITIES.includes(severity)) return res.status(400).json({ error: 'Invalid severity' });
      update.severity = severity;
    }
    if (active !== undefined) update.active = !!active;
    if (expiresAt !== undefined) {
      const when = expiresAt === null ? null : new Date(expiresAt);
      if (when && Number.isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid expiry date' });
      update.expiresAt = when;
    }
    const alert = await SystemAlert.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    const onlyVisibility = Object.keys(update).length === 1 && 'active' in update;
    const act = onlyVisibility ? (update.active ? 'Alert Shown' : 'Alert Hidden') : 'Alert Updated';
    logAlertAction(req, act, `${act.toLowerCase()}: "${alert.title}"`, alert._id, 'crud_update');
    res.json(alert);
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ error: 'Alert not found' });
    console.error('Error updating alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// DELETE /api/system-alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    const alert = await SystemAlert.findByIdAndDelete(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    logAlertAction(req, 'Alert Deleted', `deleted alert "${alert.title}"`, alert._id, 'crud_delete');
    res.json({ message: 'Alert deleted' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
