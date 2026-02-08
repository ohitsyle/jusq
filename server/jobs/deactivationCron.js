// server/jobs/deactivationCron.js
// Cron job that checks the deactivation scheduler config and bulk-deactivates all student accounts
// when the scheduled date/time is reached.

import cron from 'node-cron';
import User from '../models/User.js';
import SystemLog from '../models/SystemLog.js';

// Reference to the systemConfig from sysad routes (will be set during init)
let getSystemConfig = null;
let setSchedulerExecuted = null;

/**
 * Check if the scheduled deactivation time has been reached
 * and if so, deactivate all student accounts.
 */
async function checkAndProcessDeactivation() {
  try {
    if (!getSystemConfig) return;

    const config = getSystemConfig();
    const scheduler = config.deactivationScheduler;

    // Skip if scheduler is not enabled or already executed
    if (!scheduler?.enabled || !scheduler?.date || !scheduler?.time) return;
    if (scheduler.executed) return;

    // Parse the scheduled date/time
    const scheduledDateTime = new Date(`${scheduler.date}T${scheduler.time}:00`);
    const now = new Date();

    // Check if the scheduled time has been reached
    if (now < scheduledDateTime) return;

    console.log('[Deactivation] Scheduled time reached! Deactivating all student accounts...');

    // Find all active student accounts (role = 'student', isActive = true)
    const result = await User.updateMany(
      { role: 'student', isActive: true },
      {
        $set: {
          isActive: false,
          isDeactivated: true,
          deactivatedAt: new Date()
        }
      }
    );

    const deactivatedCount = result.modifiedCount || 0;
    console.log(`[Deactivation] Deactivated ${deactivatedCount} student accounts`);

    // Log the action
    await SystemLog.create({
      eventType: 'scheduled_student_deactivation',
      description: `Scheduled deactivation executed: ${deactivatedCount} student accounts deactivated`,
      severity: 'warning',
      metadata: {
        scheduledDate: scheduler.date,
        scheduledTime: scheduler.time,
        deactivatedCount,
        adminAction: true
      }
    });

    // Mark as executed so it doesn't run again
    if (setSchedulerExecuted) {
      setSchedulerExecuted();
    }

    console.log(`[Deactivation] Done. ${deactivatedCount} students deactivated.`);
  } catch (error) {
    console.error('[Deactivation] Error during scheduled deactivation:', error);
  }
}

/**
 * Initialize the deactivation scheduler cron job.
 * Runs every minute to check if the scheduled time has been reached.
 *
 * @param {Function} configGetter - Function that returns the current systemConfig
 * @param {Function} executedSetter - Function to mark the scheduler as executed
 */
export function initializeDeactivationCron(configGetter, executedSetter) {
  getSystemConfig = configGetter;
  setSchedulerExecuted = executedSetter;

  console.log('[Deactivation] Initializing deactivation scheduler cron job...');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    await checkAndProcessDeactivation();
  });

  console.log('[Deactivation] Cron job scheduled to run every minute');
}
