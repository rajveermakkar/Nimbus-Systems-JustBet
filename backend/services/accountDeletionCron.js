const { queryWithRetry, logDbChange } = require('../db/init');

// Run every hour
const CRON_INTERVAL_MS = 60 * 60 * 1000;

async function deleteScheduledUsers() {
  try {
    // Find users scheduled for deletion
    const result = await queryWithRetry(
      `SELECT id FROM users WHERE status = 'inactive' AND deletionScheduledAt IS NOT NULL AND deletionScheduledAt <= NOW()`
    );
    if (result.rows.length === 0) return;
    const userIds = result.rows.map(row => row.id);
    // Set status to 'deleted' for these users
    await queryWithRetry(
      `UPDATE users SET status = 'deleted' WHERE id = ANY($1::uuid[])`,
      [userIds]
    );
    logDbChange(`Deleted ${userIds.length} user(s) whose deletion was scheduled.`);
  } catch (err) {
    console.error('[AccountDeletionCron] Error deleting scheduled users:', err);
  }
}

setInterval(deleteScheduledUsers, CRON_INTERVAL_MS);

// Run once on startup
setTimeout(deleteScheduledUsers, 10 * 1000);

module.exports = { deleteScheduledUsers }; 