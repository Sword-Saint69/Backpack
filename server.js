const express = require('express');
const path = require('path');
const store = require('./src/store');
const backupRunner = require('./src/lib/backupRunner');
const GitHubUploader = require('./src/lib/github');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'src', 'renderer')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// API Routes mirroring IPC calls
app.get('/api/connections', async (req, res) => {
  try {
    const conns = await store.getConnections(false);
    res.json(conns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/connections', async (req, res) => {
  try {
    await store.saveConnection(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/connections/:id', async (req, res) => {
  try {
    await store.deleteConnection(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/:id', async (req, res) => {
  try {
    const result = await backupRunner.runBackup(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/dry-run/:id', async (req, res) => {
  try {
    const result = await backupRunner.dryRunBackup(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await store.getLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/github/config', async (req, res) => {
  try {
    const cfg = await store.getGitHubConfig();
    res.json({ ownerRepo: cfg.ownerRepo, branch: cfg.branch, hasToken: !!cfg.token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/github/config', async (req, res) => {
  try {
    await store.saveGitHubConfig(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/github/test', async (req, res) => {
  try {
    const uploader = new GitHubUploader(store);
    const valid = await uploader.verifyCredentials();
    if (!valid) throw new Error('Invalid repository access token');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎒 Backpack Web UI running live at: http://localhost:${PORT}\n`);
});
