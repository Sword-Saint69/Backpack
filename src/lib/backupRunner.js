const store = require('../store');
const { getAdapter } = require('../adapters');
const GitHubUploader = require('./github');

class BackupRunner {
  async runBackup(connectionId, onProgress = () => {}) {
    const conn = await store.getConnectionById(connectionId, true);
    if (!conn) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const githubConfig = await store.getGitHubConfig(true);
    if (!githubConfig.ownerRepo || !githubConfig.token) {
      throw new Error('GitHub token and repository must be configured in settings');
    }

    const startTime = Date.now();
    try {
      onProgress({ status: 'connecting', message: `Connecting to ${conn.name}...` });

      const adapter = getAdapter(conn.type);
      
      onProgress({ status: 'exporting', message: `Exporting data from ${conn.name}...` });
      const exportedData = await adapter.exportData(conn);

      const tableCount = Object.keys(exportedData).length;
      let totalRows = 0;
      Object.values(exportedData).forEach(rows => {
        if (Array.isArray(rows)) totalRows += rows.length;
      });

      onProgress({ status: 'uploading', message: `Uploading ${totalRows} rows to GitHub...` });
      const uploader = new GitHubUploader(githubConfig.token, githubConfig.ownerRepo, githubConfig.branch);
      const result = await uploader.uploadBackup(conn.name, exportedData);

      const durationMs = Date.now() - startTime;
      const logEntry = {
        connectionId: conn.id,
        connectionName: conn.name,
        type: conn.type,
        status: 'success',
        tablesCount: tableCount,
        totalRows,
        sizeMB: result.totalSizeMB,
        files: result.uploadedFiles,
        durationMs
      };

      await store.appendLog(logEntry);
      onProgress({ status: 'completed', message: `Backup completed successfully in ${durationMs}ms`, log: logEntry });
      return logEntry;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const logEntry = {
        connectionId: conn.id,
        connectionName: conn.name,
        type: conn.type,
        status: 'failed',
        error: err.message,
        durationMs
      };
      await store.appendLog(logEntry);
      onProgress({ status: 'error', message: `Backup failed: ${err.message}`, log: logEntry });
      throw err;
    }
  }

  async testConnection(connectionData) {
    const adapter = getAdapter(connectionData.type);
    return await adapter.testConnection(connectionData);
  }
}

module.exports = new BackupRunner();
