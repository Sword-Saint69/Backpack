const { Notification } = require('electron');

class Notifier {
  async notifyWebhook(webhookUrl, payload) {
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error('Failed sending webhook notification:', e);
    }
  }

  notifySuccess(connectionName, totalRows, sizeMB, webhookUrl) {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `🎒 Backup Completed: ${connectionName}`,
        body: `Successfully exported ${totalRows} rows (${sizeMB} MB) and pushed to GitHub.`
      });
      notification.show();
    }
    this.notifyWebhook(webhookUrl, {
      event: 'backup.success',
      connectionName,
      totalRows,
      sizeMB,
      timestamp: new Date().toISOString()
    });
  }

  notifyFailure(connectionName, errorMsg, webhookUrl) {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `🚨 Backup Failed: ${connectionName}`,
        body: `Error: ${errorMsg}`
      });
      notification.show();
    }
    this.notifyWebhook(webhookUrl, {
      event: 'backup.failure',
      connectionName,
      error: errorMsg,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new Notifier();
