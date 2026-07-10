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

// Eligibility window + duplicate-guard key for a campaign frequency.
// weekly   -> current calendar week (Monday start)
// biweekly -> fixed 14-day blocks (epoch-anchored)
// monthly  -> current calendar month
export function campaignPeriod(frequency) {
  const now = new Date();
  if (frequency === 'weekly') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
    return { start, key: `W-${start.toISOString().slice(0, 10)}` };
  }
  if (frequency === 'biweekly') {
    const block = Math.floor(now.getTime() / (14 * 86400000));
    return { start: new Date(block * 14 * 86400000), key: `BW-${block}` };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, key: `M-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
}

// Riders with at least minRides completed shuttle rides since `start`.
async function findEligibleRiders(minRides, start) {
  const riders = await Transaction.aggregate([
    {
      $match: {
        transactionType: 'debit',
        shuttleId: { $ne: null },
        status: { $nin: ['Refunded', 'Failed'] },
        createdAt: { $gte: start }
      }
    },
    {
      $group: {
        _id: '$userId',
        ridesThisMonth: { $sum: 1 }, // field name kept for client compatibility; means "rides this period"
        totalSpent: { $sum: '$amount' },
        lastRideDate: { $max: '$createdAt' }
      }
    },
    { $match: { ridesThisMonth: { $gte: minRides } } },
    { $sort: { ridesThisMonth: -1 } }
  ]);

  const users = [];
  for (const rider of riders) {
    const user = await User.findById(rider._id);
    if (user) {
      users.push({
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
  return users;
}

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
    const { title, description, rewardType, rewardValue, minimumRides, frequency, active } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const campaign = new PromotionCampaign({
      title,
      description,
      rewardType: rewardType || 'free_ride',
      rewardValue: rewardValue !== undefined ? Math.max(0, Number(rewardValue) || 0) : 1,
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
    // Whitelist editable fields — rewardType is fixed once a campaign exists
    // (progress/eligibility semantics would silently change under students).
    const updates = {};
    for (const k of ['title', 'description', 'rewardValue', 'minimumRides', 'frequency', 'active']) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (updates.rewardValue !== undefined) updates.rewardValue = Math.max(0, Number(updates.rewardValue) || 0);
    if (updates.minimumRides !== undefined) updates.minimumRides = Math.max(1, parseInt(updates.minimumRides, 10) || 1);

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
    // Preferred: ?campaignId= uses that campaign's threshold, frequency window,
    // and duplicate-send state. Legacy ?minRides=N previews with a month window.
    let minRides = Math.max(1, parseInt(req.query.minRides, 10) || 10);
    let period = campaignPeriod('monthly');
    let alreadySent = new Set();

    if (req.query.campaignId) {
      const campaign = await PromotionCampaign.findById(req.query.campaignId);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
      minRides = campaign.minimumRides || 1;
      period = campaignPeriod(campaign.frequency);
      if (campaign.sentPeriodKey === period.key) {
        alreadySent = new Set((campaign.sentUserIds || []).map(String));
      }
    }

    const eligibleUsers = (await findEligibleRiders(minRides, period.start)).map((u) => ({
      ...u,
      alreadyRewarded: alreadySent.has(String(u._id))
    }));

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

    // Eligibility window follows the campaign's frequency; users already
    // rewarded in this period are skipped (no double-sending).
    const period = campaignPeriod(campaign.frequency);
    const alreadySent = campaign.sentPeriodKey === period.key
      ? new Set((campaign.sentUserIds || []).map(String))
      : new Set();

    const allEligible = await findEligibleRiders(campaign.minimumRides || 1, period.start);
    const eligibleUsers = allEligible.filter((u) => !alreadySent.has(String(u._id)));
    const skippedCount = allEligible.length - eligibleUsers.length;

    let sentCount = 0;
    const sentIds = [];
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
                <p style="font-size: 18px; font-weight: bold; color: #FFD41C;">${
                  campaign.rewardType === 'free_ride' ? `${campaign.rewardValue || 1} Free Ride${(campaign.rewardValue || 1) !== 1 ? 's' : ''}!`
                  : campaign.rewardType === 'discount' ? `${campaign.rewardValue || 0}% Off Your Next Ride!`
                  : `₱${(campaign.rewardValue || 0).toFixed ? (campaign.rewardValue || 0).toFixed(2) : campaign.rewardValue} NUCash Credit!`
                }</p>
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
        sentIds.push(String(user._id));
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError);
        errors.push({ user: user.email, error: emailError.message });
      }
    }

    // Update campaign + record who was rewarded this period
    campaign.rewardsSent = (campaign.rewardsSent || 0) + sentCount;
    campaign.lastRunDate = new Date();
    if (campaign.sentPeriodKey === period.key) {
      campaign.sentUserIds = [...new Set([...(campaign.sentUserIds || []), ...sentIds])];
    } else {
      campaign.sentPeriodKey = period.key;
      campaign.sentUserIds = sentIds;
    }
    await campaign.save();

    logPromoAction(req, 'Rewards Sent', `sent ${sentCount} reward email${sentCount !== 1 ? 's' : ''} for campaign "${campaign.title}"${skippedCount ? ` (${skippedCount} already rewarded this period)` : ''}`, campaign._id, 'crud_update', { sent: sentCount, skipped: skippedCount, eligible: allEligible.length });

    res.json({
      message: 'Rewards sent successfully',
      sent: sentCount,
      skipped: skippedCount,
      total: allEligible.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error sending rewards:', error);
    res.status(500).json({ error: 'Failed to send rewards' });
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
