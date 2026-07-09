// nucash-server/routes/promotions.js
// Promotional campaigns and loyalty rewards endpoints

import express from 'express';
const router = express.Router();
import PromotionCampaign from '../models/PromotionCampaign.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';
import { logAdminAction } from '../utils/logger.js';

// Write marketing actions to the event log (visible in Marketing -> Logs).
const logPromoAction = (req, action, description, targetId, crudOperation = 'crud_update', changes = {}) => {
  logAdminAction({
    adminId: req.authAdmin?.adminId || req.headers['x-admin-id'] || 'marketing',
    adminName: req.headers['x-admin-name'] || 'Marketing Admin',
    adminRole: req.authAdmin?.role || 'marketing',
    department: 'marketing',
    action,
    description,
    targetEntity: 'promotion',
    targetId: String(targetId || ''),
    crudOperation,
    changes,
    ipAddress: req.ip
  }).catch(() => {});
};

// ============================================================
// CAMPAIGN MANAGEMENT
// ============================================================

/**
 * GET /admin/promotions/campaigns
 * Get all promotional campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await PromotionCampaign.find().sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

/**
 * POST /admin/promotions/campaigns
 * Create a new promotional campaign
 */
router.post('/campaigns', async (req, res) => {
  try {
    const { title, description, rewardType, minimumRides, frequency, active } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const campaign = new PromotionCampaign({
      title,
      description,
      rewardType: rewardType || 'free_ride',
      minimumRides: minimumRides || 10,
      frequency: frequency || 'monthly',
      active: active !== undefined ? active : true
    });

    await campaign.save();
    logPromoAction(req, 'Campaign Created', `created promo campaign "${campaign.title}"`, campaign._id, 'crud_create', { title: campaign.title, rewardType: campaign.rewardType, minimumRides: campaign.minimumRides });
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

/**
 * PUT /admin/promotions/campaigns/:id
 * Update a promotional campaign
 */
router.put('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const campaign = await PromotionCampaign.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const act = updates.active === true ? 'Campaign Activated' : updates.active === false ? 'Campaign Deactivated' : 'Campaign Updated';
    logPromoAction(req, act, `${act.toLowerCase()}: "${campaign.title}"`, campaign._id, 'crud_update', updates);
    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

/**
 * DELETE /admin/promotions/campaigns/:id
 * Delete a promotional campaign
 */
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await PromotionCampaign.findByIdAndDelete(id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    logPromoAction(req, 'Campaign Deleted', `deleted promo campaign "${campaign.title}"`, campaign._id, 'crud_delete', { title: campaign.title });
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// ============================================================
// ELIGIBLE USERS & REWARDS
// ============================================================

/**
 * GET /admin/promotions/eligible-users
 * Get users eligible for rewards based on ride frequency
 */
router.get('/eligible-users', async (req, res) => {
  try {
    // Campaigns can preview with their own threshold via ?minRides=N
    const minRides = Math.max(1, parseInt(req.query.minRides, 10) || 10);
    // Get date range for this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Aggregate shuttle transactions to find frequent riders
    const frequentRiders = await Transaction.aggregate([
      {
        $match: {
          transactionType: 'debit',
          shuttleId: { $ne: null },
          status: { $nin: ['Refunded', 'Failed'] },
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$userId',
          ridesThisMonth: { $sum: 1 },
          totalSpent: { $sum: '$amount' },
          lastRideDate: { $max: '$createdAt' }
        }
      },
      {
        $match: {
          ridesThisMonth: { $gte: minRides }
        }
      },
      {
        $sort: { ridesThisMonth: -1 }
      }
    ]);

    // Populate user details
    const eligibleUsers = [];
    for (const rider of frequentRiders) {
      const user = await User.findById(rider._id);
      if (user) {
        eligibleUsers.push({
          _id: user._id,
          fullName: user.fullName,
          schoolUId: user.schoolUId,
          email: user.email,
          ridesThisMonth: rider.ridesThisMonth,
          totalSpent: rider.totalSpent,
          lastRideDate: rider.lastRideDate
        });
      }
    }

    res.json(eligibleUsers);
  } catch (error) {
    console.error('Error fetching eligible users:', error);
    res.status(500).json({ error: 'Failed to fetch eligible users' });
  }
});

/**
 * POST /admin/promotions/campaigns/:id/send-rewards
 * Send reward emails to all eligible users for a campaign
 */
router.post('/campaigns/:id/send-rewards', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await PromotionCampaign.findById(id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (!campaign.active) {
      return res.status(400).json({ error: 'Campaign is not active' });
    }

    // Get eligible users directly
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const frequentRiders = await Transaction.aggregate([
      {
        $match: {
          transactionType: 'debit',
          shuttleId: { $ne: null },
          status: { $nin: ['Refunded', 'Failed'] },
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$userId',
          ridesThisMonth: { $sum: 1 },
          totalSpent: { $sum: '$amount' },
          lastRideDate: { $max: '$createdAt' }
        }
      },
      {
        $match: {
          ridesThisMonth: { $gte: campaign.minimumRides }
        }
      },
      {
        $sort: { ridesThisMonth: -1 }
      }
    ]);

    const eligibleUsers = [];
    for (const rider of frequentRiders) {
      const user = await User.findById(rider._id);
      if (user) {
        eligibleUsers.push({
          _id: user._id,
          fullName: user.fullName,
          schoolUId: user.schoolUId,
          email: user.email,
          ridesThisMonth: rider.ridesThisMonth,
          totalSpent: rider.totalSpent,
          lastRideDate: rider.lastRideDate
        });
      }
    }

    let sentCount = 0;
    const errors = [];

    // Send reward emails
    for (const user of eligibleUsers) {
      try {
        await sendEmail({
          to: user.email,
          subject: `🎁 ${campaign.title} - You've Earned a Reward!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #FFD41C;">🎉 Congratulations, ${user.fullName}!</h2>
              <p>We have a gift for you!</p>
              <p>Since you've been regularly using the NU Shuttle Service, we thought you deserve a reward for your loyalty.</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1E2347;">Your Reward:</h3>
                <p style="font-size: 18px; font-weight: bold; color: #FFD41C;">${campaign.rewardType === 'free_ride' ? 'One Free Ride!' : campaign.rewardType}</p>
                <p>${campaign.description}</p>
              </div>
              <p><strong>Your Stats This Month:</strong></p>
              <ul>
                <li>Rides taken: ${user.ridesThisMonth}</li>
                <li>Total spent: ₱${user.totalSpent.toFixed(2)}</li>
              </ul>
              <p>Thank you for choosing NU Shuttle Service! Keep riding with us to earn more rewards.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              <p style="font-size: 12px; color: #666;">
                This reward is valid for the next 30 days. Terms and conditions apply.
              </p>
            </div>
          `
        });
        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        errors.push({ user: user.email, error: emailError.message });
      }
    }

    // Update campaign
    campaign.rewardsSent = (campaign.rewardsSent || 0) + sentCount;
    campaign.lastRunDate = new Date();
    await campaign.save();

    logPromoAction(req, 'Rewards Sent', `sent ${sentCount} reward email${sentCount !== 1 ? 's' : ''} for campaign "${campaign.title}"`, campaign._id, 'crud_update', { sent: sentCount, eligible: eligibleUsers.length });

    res.json({
      message: 'Rewards sent successfully',
      sent: sentCount,
      total: eligibleUsers.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error sending rewards:', error);
    res.status(500).json({ error: 'Failed to send rewards' });
  }
});

/**
 * POST /admin/promotions/send-reward
 * Send reward email to a specific user
 */
router.post('/send-reward', async (req, res) => {
  try {
    const { userId, rewardType } = req.body;

    if (!userId || !rewardType) {
      return res.status(400).json({ error: 'userId and rewardType are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Send reward email
    await sendEmail({
      to: user.email,
      subject: '🎁 You\'ve Earned a Special Reward!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FFD41C;">🎉 Congratulations, ${user.fullName}!</h2>
          <p>We have a special gift for you!</p>
          <p>Thank you for being a loyal NU Shuttle Service user. We appreciate your continued support!</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1E2347;">Your Reward:</h3>
            <p style="font-size: 18px; font-weight: bold; color: #FFD41C;">${rewardType === 'free_ride' ? 'One Free Ride!' : rewardType}</p>
          </div>
          <p>Keep riding with us to earn more rewards!</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #666;">
            This reward is valid for the next 30 days. Terms and conditions apply.
          </p>
        </div>
      `
    });

    res.json({ message: 'Reward email sent successfully' });
  } catch (error) {
    console.error('Error sending reward:', error);
    res.status(500).json({ error: 'Failed to send reward email' });
  }
});

// ============================================================
// END-USER PROMO TAB TOGGLE (controlled by Marketing admin)
// Stored as a global tabVisibility config (promotions field).
// ============================================================

/**
 * GET /admin/promotions/tab-setting
 * Returns whether the end-user Promotions tab is enabled.
 */
router.get('/tab-setting', async (req, res) => {
  try {
    const Configuration = (await import('../models/Configuration.js')).default;
    const cfg = await Configuration.findOne({ configType: 'tabVisibility', adminRole: 'global' });
    const enabled = cfg?.tabVisibility?.promotions ?? true;
    res.json({ enabled });
  } catch (error) {
    console.error('Error reading promo tab setting:', error);
    res.status(500).json({ error: 'Failed to read promo tab setting' });
  }
});

/**
 * PUT /admin/promotions/tab-setting
 * Enable/disable the end-user Promotions tab. Body: { enabled: boolean }
 */
router.put('/tab-setting', async (req, res) => {
  try {
    const { enabled } = req.body;
    const Configuration = (await import('../models/Configuration.js')).default;
    const cfg = await Configuration.findOneAndUpdate(
      { configType: 'tabVisibility', adminRole: 'global' },
      { $set: { 'tabVisibility.promotions': !!enabled, updatedAt: Date.now() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    logPromoAction(req, `Promo Tab ${enabled ? 'Enabled' : 'Disabled'}`, `${enabled ? 'enabled' : 'disabled'} the end-user promotions tab`, 'tab-setting', 'config_updated', { enabled: !!enabled });
    res.json({ enabled: cfg?.tabVisibility?.promotions ?? !!enabled });
  } catch (error) {
    console.error('Error updating promo tab setting:', error);
    res.status(500).json({ error: 'Failed to update promo tab setting' });
  }
});

export default router;
