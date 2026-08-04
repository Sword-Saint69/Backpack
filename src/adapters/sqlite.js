const fs = require('fs');

class SQLiteAdapter {
  async testConnection(config) {
    try {
      if (!config.secret || !fs.existsSync(config.secret)) {
        throw new Error(`SQLite database file not found at path: ${config.secret}`);
      }
      return true;
    } catch (err) {
      throw new Error(`SQLite Connection Failed: ${err.message}`);
    }
  }

  async exportData(config) {
    // Basic file path check
    if (!fs.existsSync(config.secret)) {
      throw new Error(`SQLite file not found: ${config.secret}`);
    }
    // Return base64 payload of raw sqlite DB file for file-level snapshot
    const buffer = fs.readFileSync(config.secret);
    return {
      _sqlite_raw_db: buffer.toString('base64'),
      _filePath: config.secret
    };
  }
}

module.exports = new SQLiteAdapter();
