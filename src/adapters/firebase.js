const admin = require('firebase-admin');

class FirebaseAdapter {
  async testConnection(config) {
    try {
      const serviceAccount = JSON.parse(config.secret);
      const appName = `test-${Date.now()}`;
      const app = admin.initializeApp(
        { credential: admin.credential.cert(serviceAccount) },
        appName
      );
      const db = app.firestore();
      await db.listCollections();
      await app.delete();
      return true;
    } catch (err) {
      throw new Error(`Firebase Connection Failed: ${err.message}`);
    }
  }

  async exportData(config) {
    const serviceAccount = JSON.parse(config.secret);
    const appName = `export-${Date.now()}`;
    const app = admin.initializeApp(
      { credential: admin.credential.cert(serviceAccount) },
      appName
    );
    const db = app.firestore();

    try {
      const collections = await db.listCollections();
      const exportedData = {};

      for (const col of collections) {
        const snapshot = await col.get();
        exportedData[col.id] = snapshot.docs.map(doc => ({
          _id: doc.id,
          ...doc.data()
        }));
      }

      await app.delete();
      return exportedData;
    } catch (err) {
      await app.delete();
      throw err;
    }
  }
}

module.exports = new FirebaseAdapter();
