const { Octokit } = require('@octokit/rest');
const zlib = require('zlib');
const cryptoUtils = require('./crypto');

class GitHubUploader {
  constructor(token, ownerRepo, branch = 'main') {
    this.token = token;
    const parts = ownerRepo.split('/');
    this.owner = parts[0] ? parts[0].trim() : '';
    this.repo = parts[1] ? parts[1].trim() : '';
    this.branch = branch;
    this.octokit = new Octokit({ auth: token });
  }

  async testConnection() {
    if (!this.owner || !this.repo) {
      throw new Error(`Invalid GitHub repository format "${this.owner}${this.repo ? '/' + this.repo : ''}". Expected "owner/repository-name" (e.g. Sword-Saint69/Backpack)`);
    }
    try {
      const res = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo
      });
      return res.status === 200;
    } catch (err) {
      throw new Error(`GitHub Connection Failed: ${err.message}`);
    }
  }

  async uploadBackup(connectionName, data, options = {}) {
    if (!this.owner || !this.repo) {
      throw new Error('Invalid GitHub repo format. Expected "owner/repo"');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeConnName = connectionName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    let jsonString = JSON.stringify(data, null, 2);
    let payloadBuffer = Buffer.from(jsonString, 'utf-8');

    let fileExtension = '.json';

    // Optional Gzip compression
    if (options.compress) {
      payloadBuffer = zlib.gzipSync(payloadBuffer);
      fileExtension = '.json.gz';
    }

    // Optional Client-side AES Encryption
    if (options.encryptionPassword) {
      payloadBuffer = cryptoUtils.encryptPayload(payloadBuffer, options.encryptionPassword);
      fileExtension += '.enc';
    }

    const sizeInMB = payloadBuffer.length / (1024 * 1024);
    const MAX_CHUNK_MB = 40;
    const filesToUpload = [];

    if (sizeInMB > MAX_CHUNK_MB && !options.encryptionPassword && !options.compress) {
      // Chunking by top-level keys
      let currentChunk = {};
      let currentChunkSize = 0;
      let partIndex = 1;

      for (const [key, rows] of Object.entries(data)) {
        const itemStr = JSON.stringify({ [key]: rows });
        const itemSize = Buffer.byteLength(itemStr);

        if (currentChunkSize + itemSize > MAX_CHUNK_MB * 1024 * 1024 && Object.keys(currentChunk).length > 0) {
          filesToUpload.push({
            path: `backups/${safeConnName}/${timestamp}.part-${String(partIndex).padStart(4, '0')}${fileExtension}`,
            content: Buffer.from(JSON.stringify(currentChunk, null, 2)).toString('base64')
          });
          partIndex++;
          currentChunk = {};
          currentChunkSize = 0;
        }

        currentChunk[key] = rows;
        currentChunkSize += itemSize;
      }

      if (Object.keys(currentChunk).length > 0) {
        filesToUpload.push({
          path: `backups/${safeConnName}/${timestamp}.part-${String(partIndex).padStart(4, '0')}${fileExtension}`,
          content: Buffer.from(JSON.stringify(currentChunk, null, 2)).toString('base64')
        });
      }
    } else {
      filesToUpload.push({
        path: `backups/${safeConnName}/${timestamp}${fileExtension}`,
        content: payloadBuffer.toString('base64')
      });
    }

    // Overwrite latest.json (or latest.json.gz / latest.json.enc)
    filesToUpload.push({
      path: `backups/${safeConnName}/latest${fileExtension}`,
      content: payloadBuffer.toString('base64')
    });

    const commitMessage = `Backup ${connectionName} (${timestamp})`;
    const uploadedPaths = [];

    for (const file of filesToUpload) {
      let sha;
      try {
        const existing = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: file.path,
          ref: this.branch
        });
        if (existing.data && existing.data.sha) {
          sha = existing.data.sha;
        }
      } catch (e) {}

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: file.path,
        message: commitMessage,
        content: file.content,
        branch: this.branch,
        ...(sha ? { sha } : {})
      });
      uploadedPaths.push(file.path);
    }

    return {
      uploadedFiles: uploadedPaths,
      totalSizeMB: sizeInMB.toFixed(2),
      timestamp
    };
  }
}

module.exports = GitHubUploader;
