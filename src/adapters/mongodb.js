const { MongoClient } = require('mongodb');

class MongoDBAdapter {
  async testConnection(config) {
    const client = new MongoClient(config.secret, { connectTimeoutMS: 5000 });
    try {
      await client.connect();
      await client.db().command({ ping: 1 });
      await client.close();
      return true;
    } catch (err) {
      throw new Error(`MongoDB Connection Failed: ${err.message}`);
    }
  }

  async exportData(config) {
    const client = new MongoClient(config.secret);
    await client.connect();
    try {
      const db = client.db();
      let collections = await db.listCollections().toArray();
      let colNames = collections.map(c => c.name);

      if (config.selectedTables && config.selectedTables.length > 0) {
        colNames = colNames.filter(n => config.selectedTables.includes(n));
      }

      const exportedData = {};
      for (const colName of colNames) {
        const docs = await db.collection(colName).find({}).toArray();
        exportedData[colName] = docs;
      }

      await client.close();
      return exportedData;
    } catch (err) {
      await client.close();
      throw err;
    }
  }
}

module.exports = new MongoDBAdapter();
