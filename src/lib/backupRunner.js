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

      // Write manifest.json at GitHub repository root
      await this.updateManifest(uploader, conn.name, result);

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

  async dryRun(connectionId) {
    const conn = await store.getConnectionById(connectionId, true);
    if (!conn) throw new Error('Connection not found');

    const adapter = getAdapter(conn.type);
    const exportedData = await adapter.exportData(conn);

    const tableSummary = {};
    let totalRows = 0;

    for (const [table, rows] of Object.entries(exportedData)) {
      const count = Array.isArray(rows) ? rows.length : 0;
      tableSummary[table] = count;
      totalRows += count;
    }

    const payloadJson = JSON.stringify(exportedData);
    const estimatedSizeMB = (Buffer.byteLength(payloadJson) / (1024 * 1024)).toFixed(2);

    return {
      connectionName: conn.name,
      type: conn.type,
      tablesCount: Object.keys(tableSummary).length,
      totalRows,
      estimatedSizeMB,
      tables: tableSummary
    };
  }

  async updateManifest(uploader, connectionName, backupResult) {
    try {
      const manifestPath = 'manifest.json';
      let manifest = { lastUpdated: new Date().toISOString(), backups: {} };

      try {
        const existing = await uploader.octokit.rest.repos.getContent({
          owner: uploader.owner,
          repo: uploader.repo,
          path: manifestPath,
          ref: uploader.branch
        });
        if (existing.data && existing.data.content) {
          const contentStr = Buffer.from(existing.data.content, 'base64').toString('utf-8');
          manifest = JSON.parse(contentStr);
        }
      } catch (e) {
        // First time manifest creation
      }

      manifest.lastUpdated = new Date().toISOString();
      manifest.backups[connectionName] = {
        lastRunAt: backupResult.timestamp,
        sizeMB: backupResult.totalSizeMB,
        files: backupResult.uploadedFiles
      };

      const contentBase64 = Buffer.from(JSON.stringify(manifest, null, 2)).toString('base64');
      
      let sha;
      try {
        const existing = await uploader.octokit.rest.repos.getContent({
          owner: uploader.owner,
          repo: uploader.repo,
          path: manifestPath,
          ref: uploader.branch
        });
        if (existing.data) sha = existing.data.sha;
      } catch (e) {}

      await uploader.octokit.rest.repos.createOrUpdateFileContents({
        owner: uploader.owner,
        repo: uploader.repo,
        path: manifestPath,
        message: `Update manifest summary for ${connectionName}`,
        content: contentBase64,
        branch: uploader.branch,
        ...(sha ? { sha } : {})
      });
    } catch (e) {
      console.error('Failed updating manifest.json:', e);
    }
  }

  async testConnection(connectionData) {
    const adapter = getAdapter(connectionData.type);
    return await adapter.testConnection(connectionData);
  }
}

module.exports = new BackupRunner();
