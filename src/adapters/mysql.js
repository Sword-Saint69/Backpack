const mysql = require('mysql2/promise');

class MySQLAdapter {
  async testConnection(config) {
    try {
      const connection = await mysql.createConnection(config.secret);
      await connection.query('SELECT 1');
      await connection.end();
      return true;
    } catch (err) {
      throw new Error(`MySQL Connection Failed: ${err.message}`);
    }
  }

  async exportData(config) {
    const connection = await mysql.createConnection(config.secret);
    try {
      let [tables] = await connection.query('SHOW TABLES');
      let tableNames = tables.map(r => Object.values(r)[0]);

      if (config.selectedTables && config.selectedTables.length > 0) {
        tableNames = tableNames.filter(t => config.selectedTables.includes(t));
      }

      const exportedData = {};

      for (const tableName of tableNames) {
        const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
        exportedData[tableName] = rows;
      }

      await connection.end();
      return exportedData;
    } catch (err) {
      await connection.end();
      throw err;
    }
  }
}

module.exports = new MySQLAdapter();
