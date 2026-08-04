const cron = require('node-cron');
const store = require('../store');
const backupRunner = require('./backupRunner');
const notifier = require('./notifier');

class BackupScheduler {
  constructor() {
    this.tasks = new Map(); // connectionId -> cronTask
  }

  async init() {
    await this.reloadSchedules();
  }

  async reloadSchedules() {
    // Stop all current tasks
    this.tasks.forEach(task => task.stop());
    this.tasks.clear();

    const connections = await store.getConnections(true);
    for (const conn of connections) {
      if (conn.schedule && conn.schedule.enabled) {
        this.scheduleConnection(conn);
      }
    }
  }

  cronExpressionFromPreset(preset, customCron) {
    switch (preset) {
      case 'hourly': return '0 * * * *';
      case 'daily': return '0 0 * * *';
      case 'weekly': return '0 0 * * 0';
      case 'custom': return customCron || '0 0 * * *';
      default: return null;
    }
  }

  scheduleConnection(conn) {
    if (this.tasks.has(conn.id)) {
      this.tasks.get(conn.id).stop();
      this.tasks.delete(conn.id);
    }

    const expr = this.cronExpressionFromPreset(conn.schedule.preset, conn.schedule.customCron);
    if (!expr || !cron.validate(expr)) {
      console.error(`Invalid cron expression for connection ${conn.name}: ${expr}`);
      return;
    }

    const task = cron.schedule(expr, async () => {
      try {
        console.log(`[Scheduler] Starting scheduled backup for ${conn.name}`);
        const result = await backupRunner.runBackup(conn.id);
        notifier.notifySuccess(conn.name, result.totalRows, result.sizeMB);
      } catch (err) {
        console.error(`[Scheduler] Failed backup for ${conn.name}:`, err);
        notifier.notifyFailure(conn.name, err.message);
      }
    });

    this.tasks.set(conn.id, task);
  }

  stopAll() {
    this.tasks.forEach(task => task.stop());
    this.tasks.clear();
  }
}

module.exports = new BackupScheduler();
