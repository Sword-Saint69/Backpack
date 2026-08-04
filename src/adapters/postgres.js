const { Client: PGClient } = require('pg');

class PostgresAdapter {
  async testConnection(config) {
    const client = new PGClient({
      connectionString: config.secret,
      ssl: config.ssl !== false ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return true;
    } catch (err) {
      throw new Error(`Postgres Connection Failed: ${err.message}`);
    }
  }

  async exportData(config) {
    const client = new PGClient({
      connectionString: config.secret,
      ssl: config.ssl !== false ? { rejectUnauthorized: false } : false
    });

    await client.connect();

    try {
      // Get all public tables
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
      `);

      let tables = tablesRes.rows.map(r => r.table_name);
      if (config.selectedTables && config.selectedTables.length > 0) {
        tables = tables.filter(t => config.selectedTables.includes(t));
      }
      const exportedData = {};

      for (const table of tables) {
        // Simple select dump (for MVP)
        const rowsRes = await client.query(`SELECT * FROM "${table}"`);
        exportedData[table] = rowsRes.rows;
      }

      await client.end();
      return exportedData;
    } catch (err) {
      await client.end();
      throw err;
    }
  }
}

module.exports = new PostgresAdapter();
