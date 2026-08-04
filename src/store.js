const { safeStorage } = require('electron');
const path = require('path');

// Dynamically handle electron-store import if ESM or CommonJS
let Store;

class EncryptedStore {
  constructor() {
    this.store = null;
  }

  async init() {
    if (this.store) return;
    const { default: ElectronStore } = await import('electron-store');
    this.store = new ElectronStore({
      name: 'backpack-config',
      defaults: {
        connections: [],
        github: { token: '', repo: '', branch: 'main' },
        settings: { launchAtStartup: false },
        logs: [],
        schedules: []
      }
    });
  }

  encrypt(text) {
    if (!text) return '';
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(text).toString('hex');
    }
    return text;
  }

  decrypt(text) {
    if (!text) return '';
    if (text.startsWith('enc:')) {
      const hex = text.slice(4);
      const buffer = Buffer.from(hex, 'hex');
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(buffer);
      }
      return '[Encryption Unavailable]';
    }
    return text;
  }

  async getGitHubConfig(includeSecret = false) {
    await this.init();
    const config = this.store.get('github') || {};
    return {
      ownerRepo: config.repo || '',
      branch: config.branch || 'main',
      hasToken: Boolean(config.token),
      token: includeSecret ? this.decrypt(config.token) : undefined
    };
  }

  async setGitHubConfig({ repo, token, branch = 'main' }) {
    await this.init();
    const current = this.store.get('github') || {};
    const updated = {
      repo: repo !== undefined ? repo : current.repo,
      branch: branch || current.branch || 'main',
      token: token ? this.encrypt(token) : current.token
    };
    this.store.set('github', updated);
  }

  async getConnections(includeSecrets = false) {
    await this.init();
    const connections = this.store.get('connections') || [];
    return connections.map(conn => {
      const sanitized = { ...conn };
      if (!includeSecrets) {
        sanitized.hasSecret = Boolean(conn.secret);
        delete sanitized.secret;
      } else if (conn.secret) {
        sanitized.secret = this.decrypt(conn.secret);
      }
      return sanitized;
    });
  }

  async getConnectionById(id, includeSecret = true) {
    const connections = await this.getConnections(includeSecret);
    return connections.find(c => c.id === id);
  }

  async saveConnection(conn) {
    await this.init();
    const connections = this.store.get('connections') || [];
    const existingIndex = connections.findIndex(c => c.id === conn.id);
    
    const newConn = { ...conn };
    if (newConn.secret && !newConn.secret.startsWith('enc:')) {
      newConn.secret = this.encrypt(newConn.secret);
    } else if (!newConn.secret && existingIndex >= 0) {
      newConn.secret = connections[existingIndex].secret;
    }

    if (existingIndex >= 0) {
      connections[existingIndex] = newConn;
    } else {
      connections.push(newConn);
    }
    this.store.set('connections', connections);
    return newConn;
  }

  async deleteConnection(id) {
    await this.init();
    let connections = this.store.get('connections') || [];
    connections = connections.filter(c => c.id !== id);
    this.store.set('connections', connections);
  }

  async getLogs(limit = 200) {
    await this.init();
    const logs = this.store.get('logs') || [];
    return logs.slice(-limit).reverse();
  }

  async appendLog(logEntry) {
    await this.init();
    const logs = this.store.get('logs') || [];
    logs.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...logEntry
    });
    // Keep max 500 in store
    if (logs.length > 500) {
      logs.shift();
    }
    this.store.set('logs', logs);
  }
}

module.exports = new EncryptedStore();
