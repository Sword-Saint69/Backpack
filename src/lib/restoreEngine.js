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

    // 1. Decrypt if encrypted (.enc extension or decryption password provided)
    if (path.endsWith('.enc') || encryptionPassword) {
      if (!encryptionPassword) {
        throw new Error('This snapshot is AES encrypted. Please enter the decryption password in the modal.');
      }
      try {
        buffer = cryptoUtils.decryptPayload(buffer, encryptionPassword);
      } catch (err) {
        throw new Error(`AES Decryption failed: Incorrect decryption password or corrupted payload.`);
      }
    }

    // 2. Auto-detect Gzip compression via magic header 0x1f8b or .gz extension
    const isGzip = path.endsWith('.gz') || path.endsWith('.gz.enc') || (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);
    if (isGzip) {
      try {
        buffer = zlib.gunzipSync(buffer);
      } catch (err) {
        throw new Error(`Gzip Decompression failed: Snapshot payload is corrupted or requires AES decryption password.`);
      }
    }

    try {
      const jsonStr = buffer.toString('utf-8');
      return JSON.parse(jsonStr);
    } catch (err) {
      throw new Error(`Invalid Snapshot Payload: Unable to parse snapshot JSON (${err.message}). If this backup was compressed or encrypted when created, select Gzip / enter AES password.`);
    }
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
