const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

// Disable GPU acceleration and sandboxing to prevent Chromium GPU/Network crashes on Windows
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const store = require('./store');
const backupRunner = require('./lib/backupRunner');
const GitHubUploader = require('./lib/github');
const scheduler = require('./lib/scheduler');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (event) => {
    // Minimize to tray instead of quitting if tray exists
    if (tray && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Create 1x1 fallback icon or standard icon
  const icon = nativeImage.createFromNamedImage('NSImageNameFolder');
  tray = new Tray(icon);
  tray.setToolTip('Backpack — Database Backup Tool');

  const contextMenu = Menu.buildFromTemplate([
    { label: '🎒 Open Backpack', click: () => { if (mainWindow) mainWindow.show(); } },
    {
      label: '⚡ Backup All Now',
      click: async () => {
        const connections = await store.getConnections(false);
        for (const conn of connections) {
          try {
            await backupRunner.runBackup(conn.id);
          } catch (e) {
            console.error(e);
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) mainWindow.show();
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    createWindow();
    createTray();
    await scheduler.init();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-connections', async () => {
  return await store.getConnections(false);
});

ipcMain.handle('save-connection', async (_, conn) => {
  const result = await store.saveConnection(conn);
  await scheduler.reloadSchedules();
  return result;
});

ipcMain.handle('delete-connection', async (_, id) => {
  const result = await store.deleteConnection(id);
  await scheduler.reloadSchedules();
  return result;
});

ipcMain.handle('test-connection', async (_, conn) => {
  return await backupRunner.testConnection(conn);
});

ipcMain.handle('get-github-config', async () => {
  return await store.getGitHubConfig(false);
});

ipcMain.handle('save-github-config', async (_, config) => {
  return await store.setGitHubConfig(config);
});

ipcMain.handle('test-github-connection', async () => {
  const config = await store.getGitHubConfig(true);
  if (!config.ownerRepo || !config.token) {
    throw new Error('Please save repository (owner/repo) and token first');
  }
  const uploader = new GitHubUploader(config.token, config.ownerRepo, config.branch);
  return await uploader.testConnection();
});

ipcMain.handle('run-backup', async (_, id) => {
  return await backupRunner.runBackup(id, (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup-progress', { connectionId: id, ...progress });
    }
  });
});

ipcMain.handle('dry-run-backup', async (_, id) => {
  return await backupRunner.dryRun(id);
});

ipcMain.handle('get-snapshot-history', async (_, connName) => {
  const restoreEngine = require('./lib/restoreEngine');
  return await restoreEngine.getSnapshotHistory(connName);
});

ipcMain.handle('generate-restore-sql', async (_, { path, dialect, password }) => {
  const restoreEngine = require('./lib/restoreEngine');
  const data = await restoreEngine.fetchAndDecodeSnapshot(path, password);
  return restoreEngine.generateSQLInsertScript(data, dialect);
});

ipcMain.handle('get-logs', async () => {
  return await store.getLogs();
});

ipcMain.handle('get-startup-setting', () => {
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
});

ipcMain.handle('set-startup-setting', (_, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe')
  });
  return app.getLoginItemSettings().openAtLogin;
});
