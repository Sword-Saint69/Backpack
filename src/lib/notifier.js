const { Notification } = require('electron');

class Notifier {
  notifySuccess(connectionName, totalRows, sizeMB) {
    if (!Notification.isSupported()) return;
    const notification = new Notification({
      title: `🎒 Backup Completed: ${connectionName}`,
      body: `Successfully exported ${totalRows} rows (${sizeMB} MB) and pushed to GitHub.`
    });
    notification.show();
  }

  notifyFailure(connectionName, errorMsg) {
    if (!Notification.isSupported()) return;
    const notification = new Notification({
      title: `🚨 Backup Failed: ${connectionName}`,
      body: `Error: ${errorMsg}`
    });
    notification.show();
  }
}

module.exports = new Notifier();
