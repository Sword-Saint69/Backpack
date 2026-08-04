const zlib = require('zlib');
const cryptoUtils = require('./crypto');
const store = require('../store');
const GitHubUploader = require('./github');
const { getAdapter } = require('../adapters');

class RestoreEngine {
  async getSnapshotHistory(connectionName) {
    const githubConfig = await store.getGitHubConfig(true);
    if (!githubConfig.ownerRepo || !githubConfig.token) {
      throw new Error('GitHub token and repository must be configured');
    }

    const uploader = new GitHubUploader(githubConfig.token, githubConfig.ownerRepo, githubConfig.branch);
    const safeConnName = connectionName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const folderPath = `backups/${safeConnName}`;

    try {
      const res = await uploader.octokit.rest.repos.getContent({
        owner: uploader.owner,
        repo: uploader.repo,
        path: folderPath,
        ref: uploader.branch
      });

      if (!Array.isArray(res.data)) return [];

      return res.data
        .filter(item => item.name !== 'latest.json' && item.name !== 'latest.json.gz' && item.name !== 'latest.json.enc')
        .map(item => ({
          name: item.name,
          path: item.path,
          sizeMB: (item.size / (1024 * 1024)).toFixed(2),
          sha: item.sha,
          downloadUrl: item.download_url
        }));
    } catch (err) {
      throw new Error(`Failed fetching snapshot history: ${err.message}`);
    }
  }

  async fetchAndDecodeSnapshot(path, encryptionPassword = '') {
    const githubConfig = await store.getGitHubConfig(true);
    const uploader = new GitHubUploader(githubConfig.token, githubConfig.ownerRepo, githubConfig.branch);

    const res = await uploader.octokit.rest.repos.getContent({
      owner: uploader.owner,
      repo: uploader.repo,
      path,
      ref: uploader.branch
    });

    let buffer = Buffer.from(res.data.content, 'base64');

    // Decrypt if .enc extension or encrypted envelope
    if (path.endsWith('.enc') || encryptionPassword) {
      buffer = cryptoUtils.decryptPayload(buffer, encryptionPassword);
    }

    // Decompress if .gz extension
    if (path.endsWith('.gz') || path.endsWith('.gz.enc')) {
      buffer = zlib.gunzipSync(buffer);
    }

    const jsonStr = buffer.toString('utf-8');
    return JSON.parse(jsonStr);
  }

  generateSQLInsertScript(data, dialect = 'postgres') {
    let sqlScript = `-- Backpack Restore Script (${dialect.toUpperCase()})\n-- Generated at: ${new Date().toISOString()}\n\n`;

    for (const [tableName, rows] of Object.entries(data)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;

      sqlScript += `-- Table: ${tableName} (${rows.length} rows)\n`;
      const sample = rows[0];
      const columns = Object.keys(sample);

      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number' || typeof val === 'boolean') return val;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });

        const colQuote = dialect === 'mysql' ? '`' : '"';
        const formattedCols = columns.map(c => `${colQuote}${c}${colQuote}`).join(', ');
        sqlScript += `INSERT INTO ${colQuote}${tableName}${colQuote} (${formattedCols}) VALUES (${values.join(', ')});\n`;
      }
      sqlScript += `\n`;
    }

    return sqlScript;
  }
}

module.exports = new RestoreEngine();
