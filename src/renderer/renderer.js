// ── Animated List Notification System (unlumen-ui port) ──────────────────
const NOTIF_ICONS = {
  success: '<i class="ph-bold ph-check-circle"></i>',
  error:   '<i class="ph-bold ph-x-circle"></i>',
  info:    '<i class="ph-bold ph-info"></i>',
  warning: '<i class="ph-bold ph-warning"></i>',
};

function showNotification(title, message, type = 'info', duration = 4500) {
  const list = document.getElementById('notifList');
  if (!list) return;

  const item = document.createElement('div');
  item.className = 'notif-item';
  item.innerHTML = `
    <div class="notif-icon ${type}">${NOTIF_ICONS[type] || NOTIF_ICONS.info}</div>
    <div class="notif-body">
      <div class="notif-title">${title}</div>
      ${message ? `<div class="notif-msg">${message}</div>` : ''}
    </div>
    <button class="notif-close" aria-label="Dismiss">&times;</button>
  `;

  list.prepend(item);

  const dismiss = () => {
    item.classList.add('removing');
    item.addEventListener('animationend', () => item.remove(), { once: true });
  };

  item.querySelector('.notif-close').addEventListener('click', dismiss);
  item.addEventListener('click', dismiss);
  if (duration > 0) setTimeout(dismiss, duration);
}

document.addEventListener('DOMContentLoaded', async () => {
  // ── Dock Navigation ──
  const dockItems = document.querySelectorAll('.dock-item[data-tab]');
  const tabPages  = document.querySelectorAll('.tab-page');
  const dockPanel = document.getElementById('dockPanel');

  // Magnification constants (matching Dock.tsx defaults)
  const BASE_SIZE    = 50;
  const MAX_SIZE     = 72;
  const DISTANCE     = 130;

  function applyMagnification(mouseX) {
    dockItems.forEach(item => {
      const icon = item.querySelector('.dock-icon');
      if (!icon) return;
      const rect = icon.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(mouseX - center);
      let scale = 1;
      if (dist < DISTANCE) {
        // Cosine falloff
        scale = 1 + (MAX_SIZE / BASE_SIZE - 1) * Math.cos((dist / DISTANCE) * (Math.PI / 2));
      }
      icon.style.setProperty('--dock-scale', scale.toFixed(3));
    });
  }

  dockPanel?.addEventListener('mousemove', (e) => applyMagnification(e.clientX));
  dockPanel?.addEventListener('mouseleave', () => {
    dockItems.forEach(item => {
      item.querySelector('.dock-icon')?.style.setProperty('--dock-scale', '1');
    });
  });

  // Tab switching
  dockItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      dockItems.forEach(b => b.classList.remove('active'));
      tabPages.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${targetTab}`)?.classList.add('active');
      if (targetTab === 'logs') loadLogs();
      if (targetTab === 'restore') loadRestoreConnections();
    });
  });

  // Refresh Logs Button
  document.getElementById('btnRefreshLogs')?.addEventListener('click', () => loadLogs());

  const modal = document.getElementById('connectionModal');
  const btnOpenAdd = document.getElementById('btnOpenAddModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const connForm = document.getElementById('connectionForm');

  btnOpenAdd.addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Add Connection';
    connForm.reset();
    document.getElementById('connId').value = '';
    modal.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Watermelon UI Tab Selector Logic
  const btnTabNormal = document.getElementById('btnTabNormal');
  const btnTabGzip = document.getElementById('btnTabGzip');
  const btnTabEncrypt = document.getElementById('btnTabEncrypt');
  const chkCompress = document.getElementById('chkCompress');
  const groupEncPassword = document.getElementById('groupEncPassword');

  function setSecurityMode(mode) {
    [btnTabNormal, btnTabGzip, btnTabEncrypt].forEach(b => b?.classList.remove('active'));
    if (mode === 'normal') {
      btnTabNormal?.classList.add('active');
      if (chkCompress) chkCompress.checked = false;
      if (groupEncPassword) groupEncPassword.style.display = 'none';
    } else if (mode === 'gzip') {
      btnTabGzip?.classList.add('active');
      if (chkCompress) chkCompress.checked = true;
      if (groupEncPassword) groupEncPassword.style.display = 'none';
    } else if (mode === 'encrypt') {
      btnTabEncrypt?.classList.add('active');
      if (chkCompress) chkCompress.checked = true;
      if (groupEncPassword) groupEncPassword.style.display = 'flex';
    }
  }

  btnTabNormal?.addEventListener('click', () => setSecurityMode('normal'));
  btnTabGzip?.addEventListener('click', () => setSecurityMode('gzip'));
  btnTabEncrypt?.addEventListener('click', () => setSecurityMode('encrypt'));

  // Watermelon UI Switch Toggle for Scheduler
  const schedEnabledSwitch = document.getElementById('schedEnabled');
  const groupSchedulerFields = document.getElementById('groupSchedulerFields');

  schedEnabledSwitch?.addEventListener('change', (e) => {
    if (groupSchedulerFields) {
      groupSchedulerFields.style.display = e.target.checked ? 'flex' : 'none';
    }
  });

  // Persistent GitHub Warning Banner Buttons
  document.getElementById('btnSidebarConfigure')?.addEventListener('click', () => switchToTab('settings'));
  document.getElementById('btnBannerConfigure')?.addEventListener('click', () => switchToTab('settings'));

  // Dismissible banner
  document.getElementById('btnBannerDismiss')?.addEventListener('click', () => {
    const banner = document.getElementById('githubWarningBanner');
    if (banner) banner.style.display = 'none';
  });

  function switchToTab(tabName) {
    dockItems.forEach(b => b.classList.remove('active'));
    tabPages.forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`.dock-item[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
    if (tabName === 'logs') loadLogs();
    if (tabName === 'restore') loadRestoreConnections();
  }

  // Dry Run Modal Wire
  const dryRunModal = document.getElementById('dryRunModal');
  const btnCloseDryRunModal = document.getElementById('btnCloseDryRunModal');
  const btnCloseDryRun = document.getElementById('btnCloseDryRun');

  [btnCloseDryRunModal, btnCloseDryRun].forEach(btn => {
    btn?.addEventListener('click', () => dryRunModal.classList.remove('active'));
  });

  // Load Data
  await loadGitHubConfig();
  await loadConnections();
  await refreshGithubGating();

  // Settings Form
  const githubForm = document.getElementById('githubForm');
  githubForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim();
    const token = document.getElementById('ghToken').value.trim();

    try {
      await window.api.saveGitHubConfig({ repo, branch, token });
      showNotification('Settings Saved', `GitHub target set to ${repo}`, 'success');
      await loadGitHubConfig();
      await refreshGithubGating();
    } catch (err) {
      showNotification('Save Failed', err.message, 'error');
    }
  });

  document.getElementById('btnTestGitHub').addEventListener('click', async () => {
    try {
      await window.api.testGitHubConnection();
      showNotification('GitHub Connected', 'Repository access token is valid', 'success');
    } catch (err) {
      showNotification('Connection Failed', err.message, 'error');
    }
  });

  function animateSaveToggle(btn, idleText, savedText, asyncWork) {
    btn.classList.add('loading');
    btn.innerHTML = `<div class="save-spinner"></div>`;

    setTimeout(async () => {
      try {
        await asyncWork();
        btn.classList.remove('loading');
        btn.classList.add('saved');
        btn.innerHTML = `✓ ${savedText}`;

        setTimeout(() => {
          btn.classList.remove('saved');
          btn.innerHTML = `<span class="btn-text">${idleText}</span>`;
        }, 1200);
      } catch (err) {
        btn.classList.remove('loading');
        btn.innerHTML = `<span class="btn-text">${idleText}</span>`;
        alert(`Operation Failed: ${err.message}`);
      }
    }, 600);
  }

  // Save Connection Form
  connForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSaveConn = document.getElementById('btnSaveConn');

    const id = document.getElementById('connId').value || Date.now().toString();
    const name = document.getElementById('connName').value.trim();
    const type = document.getElementById('connType').value;
    const secret = document.getElementById('connSecret').value.trim();
    const tablesRaw = document.getElementById('selectedTables').value.trim();
    const selectedTables = tablesRaw ? tablesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const compress = document.getElementById('chkCompress').checked;
    const encryptionPassword = document.getElementById('encryptionPassword').value.trim();

    const schedule = {
      enabled: document.getElementById('schedEnabled').checked,
      preset: document.getElementById('schedPreset').value,
      customCron: document.getElementById('schedCustom').value.trim()
    };

    animateSaveToggle(btnSaveConn, 'Save Connection', 'Saved', async () => {
      await window.api.saveConnection({ id, name, type, secret, selectedTables, compress, encryptionPassword, schedule });
      setTimeout(() => modal.classList.remove('active'), 500);
      await loadConnections();
    });
  });

  // Test Connection in Modal
  document.getElementById('btnTestConn').addEventListener('click', async () => {
    const btnTestConn = document.getElementById('btnTestConn');
    const type = document.getElementById('connType').value;
    const secret = document.getElementById('connSecret').value.trim();
    if (!secret) return alert('Please provide a connection secret first.');

    animateSaveToggle(btnTestConn, 'Test Connection', 'Connected!', async () => {
      await window.api.testConnection({ type, secret });
    });
  });

  // Live progress updates
  window.api.onBackupProgress((progress) => {
    const card = document.querySelector(`[data-card-id="${progress.connectionId}"]`);
    if (card) {
      const statusEl = card.querySelector('.conn-status');
      if (statusEl) {
        statusEl.textContent = progress.message;
      }
    }
  });
});

async function loadGitHubConfig() {
  try {
    const config = await window.api.getGitHubConfig();
    const statusBox = document.getElementById('githubStatusSummary');
    const warningBanner = document.getElementById('githubWarningBanner');

    if (config.ownerRepo && config.hasToken) {
      document.getElementById('ghRepo').value = config.ownerRepo;
      document.getElementById('ghBranch').value = config.branch || 'main';
      statusBox.innerHTML = `
        <span class="status-indicator success"></span>
        <span class="status-text">Target: ${config.ownerRepo}</span>
      `;
      if (warningBanner) warningBanner.style.display = 'none';
    } else {
      statusBox.innerHTML = `
        <span class="status-indicator warning"></span>
        <span class="status-text">GitHub unconfigured</span>
        <button id="btnSidebarConfigure" onclick="document.querySelector('[data-tab=settings]').click()" style="margin-left: auto; font-size: 0.75rem; background: transparent; border: none; color: var(--primary); cursor: pointer; text-decoration: underline;">Configure</button>
      `;
      if (warningBanner) warningBanner.style.display = 'block';
    }
  } catch (e) {
    console.error(e);
  }
}

async function refreshGithubGating() {
  try {
    const config = await window.api.getGitHubConfig();
    const isConfigured = !!(config.ownerRepo && config.hasToken);
    document.querySelectorAll('.btn-backup').forEach(btn => {
      btn.disabled = !isConfigured;
      btn.title = isConfigured ? '' : 'Configure a GitHub target in Settings first';
    });
  } catch (e) {
    // If we can't check, leave buttons enabled to avoid blocking
    console.error('gating check failed', e);
  }
}

async function loadConnections() {
  const grid = document.getElementById('connectionsGrid');
  grid.innerHTML = '';
  const connections = await window.api.getConnections();
  const logs = await window.api.getLogs();

  if (connections.length === 0) {
    grid.innerHTML = `
      <div class="card" style="border: 2px dashed rgba(255,255,255,0.15); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; text-align: center; grid-column: 1 / -1;">
        <span style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔌</span>
        <h3>No Database Connections Yet</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0.5rem 0 1.25rem 0; max-width: 400px;">Add your database credentials to schedule automatic point-in-time backups to GitHub.</p>
        <button class="btn primary" onclick="document.getElementById('btnOpenAddModal').click()">+ Add First Connection</button>
      </div>
    `;
    return;
  }

  connections.forEach(conn => {
    const card = document.createElement('div');
    card.className = 'card conn-card';
    card.setAttribute('data-card-id', conn.id);

    // Find last run log for metadata line
    const connLogs = logs.filter(l => l.connectionId === conn.id || l.connectionName === conn.name);
    const lastLog = connLogs.length > 0 ? connLogs[0] : null;
    const lastRunText = lastLog ? `${new Date(lastLog.timestamp).toLocaleTimeString()} (${lastLog.status})` : 'Never';

    const schedText = conn.schedule && conn.schedule.enabled ? `Enabled (${conn.schedule.preset})` : 'Disabled';

    card.innerHTML = `
      <div>
        <div class="conn-header">
          <h3>${conn.name}</h3>
          <span class="badge ${conn.type}">${conn.type}</span>
        </div>
        <div class="conn-meta" style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.25rem;">
          <div><strong style="color: #a1a1aa;">Status:</strong> <span class="conn-status" style="color: var(--success);">Ready</span></div>
          <div><strong style="color: #a1a1aa;">Last Run:</strong> <span>${lastRunText}</span></div>
          <div><strong style="color: #a1a1aa;">Schedule:</strong> <span>${schedText}</span></div>
        </div>
      </div>

      <div class="conn-actions" style="margin-top: 1.25rem;">
        <button class="btn primary btn-backup" onclick="runBackup('${conn.id}')">Backup Now</button>
        <button class="btn secondary" onclick="dryRun('${conn.id}')">Dry Run</button>
        <button class="btn secondary" onclick="editConnection('${conn.id}')">Edit</button>
        <button class="btn danger" onclick="deleteConnection('${conn.id}', '${conn.name}')">Delete</button>
      </div>
    `;

    grid.appendChild(card);
  });

  // Gate Backup Now buttons based on GitHub config
  await refreshGithubGating();
}

async function dryRun(id) {
  try {
    const result = await window.api.dryRunBackup(id);
    
    document.getElementById('dryRunModalTitle').textContent = `🔍 Dry-Run Preview — ${result.connectionName}`;
    document.getElementById('dryRunDbType').textContent = result.type;
    document.getElementById('dryRunTotalRows').textContent = `${result.totalRows} rows`;
    document.getElementById('dryRunPayloadSize').textContent = `~${result.estimatedSizeMB} MB`;

    const tbody = document.getElementById('dryRunTableBody');
    tbody.innerHTML = '';

    // Sort descending by row count
    const sortedTables = Object.entries(result.tables).sort((a, b) => b[1] - a[1]);

    sortedTables.forEach(([tbl, count]) => {
      const tr = document.createElement('tr');
      const isLarge = count > 50000;
      tr.innerHTML = `
        <td style="padding: 0.6rem 1rem;"><code>${tbl}</code> ${isLarge ? '<span style="font-size: 0.7rem; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 4px; margin-left: 0.5rem;">Large Table</span>' : ''}</td>
        <td style="padding: 0.6rem 1rem; text-align: right; font-weight: 600;">${count.toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });

    const btnRunFromDryRun = document.getElementById('btnRunBackupFromDryRun');
    btnRunFromDryRun.onclick = () => {
      document.getElementById('dryRunModal').classList.remove('active');
      runBackup(id);
    };

    document.getElementById('dryRunModal').classList.add('active');
  } catch (err) {
    showNotification('Dry-run Failed', err.message, 'error');
  }
}

async function deleteConnection(id, name) {
  if (confirm(`Are you sure you want to delete connection "${name}"?\n\nThis will only remove the connection configuration from Backpack. Your GitHub backup commits will not be affected.`)) {
    await window.api.deleteConnection(id);
    await loadConnections();
  }
}

async function runBackup(id) {
  const card = document.querySelector(`[data-card-id="${id}"]`);
  const statusEl = card?.querySelector('.conn-status');
  const backupBtn = card?.querySelector('.btn-backup');
  const connections = await window.api.getConnections();
  const conn = connections.find(c => c.id === id);

  if (backupBtn) {
    backupBtn.disabled = true;
    backupBtn.style.opacity = '0.5';
    backupBtn.textContent = 'Running...';
  }

  if (statusEl) {
    statusEl.textContent = '⏳ Running Backup...';
    statusEl.style.color = '#f59e0b';
  }

  try {
    await window.api.runBackup(id);
    if (statusEl) {
      statusEl.textContent = 'Ready (Success)';
      statusEl.style.color = 'var(--success)';
    }
    showNotification('Backup Complete', `${conn?.name || 'Database'} snapshot pushed to GitHub`, 'success');
    await loadConnections();
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = 'Failed';
      statusEl.style.color = 'var(--danger)';
    }
    showNotification('Backup Failed', err.message, 'error');
  } finally {
    if (backupBtn) {
      backupBtn.disabled = false;
      backupBtn.style.opacity = '1';
      backupBtn.textContent = 'Backup Now';
    }
  }
}

async function editConnection(id) {
  const connections = await window.api.getConnections();
  const conn = connections.find(c => c.id === id);
  if (!conn) return;

  document.getElementById('modalTitle').textContent = 'Edit Connection';
  document.getElementById('connId').value = conn.id;
  document.getElementById('connName').value = conn.name;
  document.getElementById('connType').value = conn.type;
  document.getElementById('connSecret').value = '';
  document.getElementById('connSecret').placeholder = '(Encrypted Secret Preserved — enter new value to overwrite)';
  document.getElementById('connectionModal').classList.add('active');
}

// (deleteConnection with name + confirmation is defined above)

async function loadRestoreConnections() {
  const select = document.getElementById('restoreSelectConn');
  select.innerHTML = '';
  const connections = await window.api.getConnections();
  connections.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.name} (${c.type})`;
    select.appendChild(opt);
  });
}

document.getElementById('btnFetchSnapshots').addEventListener('click', async () => {
  const connName = document.getElementById('restoreSelectConn').value;
  if (!connName) return alert('Select a connection first');

  // Guard: require GitHub to be configured before fetching
  try {
    const config = await window.api.getGitHubConfig();
    if (!config.ownerRepo || !config.hasToken) {
      alert('⚠️ GitHub repository and access token must be configured in Settings before fetching snapshots.');
      document.querySelector('.nav-btn[data-tab="settings"]')?.click();
      return;
    }
  } catch (e) {
    alert('Unable to check GitHub configuration. Please verify Settings.');
    return;
  }

  try {
    const snapshots = await window.api.getSnapshotHistory(connName);
    const tbody = document.getElementById('snapshotsTableBody');
    tbody.innerHTML = '';
    document.getElementById('snapshotResultsContainer').style.display = 'block';

    if (snapshots.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No snapshots found for ${connName}.</td></tr>`;
      return;
    }

    snapshots.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><code>${s.name}</code></td>
        <td>${s.sizeMB} MB</td>
        <td>
          <button class="btn primary" onclick="generateRestoreSQL('${s.path}')">Generate SQL Replay</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    alert(`Failed fetching snapshots: ${err.message}`);
  }
});

async function generateRestoreSQL(path) {
  const password = prompt('Enter AES payload decryption password (leave blank if unencrypted):') || '';
  const dialect = prompt('Select SQL dialect (postgres or mysql):', 'postgres') || 'postgres';

  try {
    const sql = await window.api.generateRestoreSQL(path, dialect, password);
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restore-${Date.now()}.sql`;
    a.click();
    alert('SQL Replay script generated and downloaded successfully!');
  } catch (err) {
    alert(`Failed generating restore SQL: ${err.message}`);
  }
}

async function loadLogs() {
  const tbody = document.getElementById('logsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const logs = await window.api.getLogs();

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No backup logs available.</td></tr>`;
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    const statusColor = log.status === 'success' ? 'var(--success)' : 'var(--danger)';
    tr.innerHTML = `
      <td>${new Date(log.timestamp).toLocaleString()}</td>
      <td><strong>${log.connectionName}</strong></td>
      <td><span class="badge ${log.type}">${log.type}</span></td>
      <td style="color: ${statusColor}; font-weight: 600;">${log.status}</td>
      <td>${log.totalRows !== undefined ? `${log.totalRows} rows (${log.tablesCount} tables)` : '-'}</td>
      <td>${log.sizeMB ? `${log.sizeMB} MB` : '-'}</td>
      <td>${log.durationMs} ms</td>
    `;
    tbody.appendChild(tr);
  });
}
