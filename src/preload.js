const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConnections: () => ipcRenderer.invoke('get-connections'),
  saveConnection: (conn) => ipcRenderer.invoke('save-connection', conn),
  deleteConnection: (id) => ipcRenderer.invoke('delete-connection', id),
  testConnection: (conn) => ipcRenderer.invoke('test-connection', conn),

  getGitHubConfig: () => ipcRenderer.invoke('get-github-config'),
  saveGitHubConfig: (config) => ipcRenderer.invoke('save-github-config', config),
  testGitHubConnection: () => ipcRenderer.invoke('test-github-connection'),

  runBackup: (id) => ipcRenderer.invoke('run-backup', id),
  dryRunBackup: (id) => ipcRenderer.invoke('dry-run-backup', id),
  getLogs: () => ipcRenderer.invoke('get-logs'),

  getStartupSetting: () => ipcRenderer.invoke('get-startup-setting'),
  setStartupSetting: (enabled) => ipcRenderer.invoke('set-startup-setting', enabled),

  onBackupProgress: (callback) => {
    ipcRenderer.on('backup-progress', (event, data) => callback(data));
  }
});
