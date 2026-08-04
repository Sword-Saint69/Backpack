document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tabs
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabPages = document.querySelectorAll('.tab-page');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      navBtns.forEach(b => b.classList.remove('active'));
      tabPages.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');

      if (targetTab === 'logs') loadLogs();
      if (targetTab === 'restore') loadRestoreConnections();
    });
  });

  document.getElementById('btnOpenCommunityModal')?.addEventListener('click', () => {
    alert('🍉 Create Community Dialog Triggered! (registry.watermelon.sh/r/create-community.json)');
  });

  document.getElementById('btnOpenDialogStack')?.addEventListener('click', () => {
    alert('📚 Dialog Stack Component Triggered! (registry.watermelon.sh/r/dialog-stack.json)');
  });

  document.getElementById('btnOpenUniswapDialog')?.addEventListener('click', () => {
    alert('🔄 Uniswap Dialog Component Triggered! (registry.watermelon.sh/r/uniswap-dialog.json)');
  });
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

  // Load Data
  await loadGitHubConfig();
  await loadConnections();

  // Settings Form
  const githubForm = document.getElementById('githubForm');
  githubForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const repo = document.getElementById('ghRepo').value.trim();
    const branch = document.getElementById('ghBranch').value.trim();
    const token = document.getElementById('ghToken').value.trim();

    try {
      await window.api.saveGitHubConfig({ repo, branch, token });
      alert('GitHub settings saved successfully!');
      await loadGitHubConfig();
    } catch (err) {
      alert(`Error saving GitHub settings: ${err.message}`);
    }
  });

  document.getElementById('btnTestGitHub').addEventListener('click', async () => {
    try {
      await window.api.testGitHubConnection();
      alert('GitHub Connection Successful!');
    } catch (err) {
      alert(`GitHub Connection Failed: ${err.message}`);
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
    if (config.ownerRepo && config.hasToken) {
      document.getElementById('ghRepo').value = config.ownerRepo;
      document.getElementById('ghBranch').value = config.branch || 'main';
      statusBox.innerHTML = `
        <span class="status-indicator success"></span>
        <span class="status-text">Target: ${config.ownerRepo}</span>
      `;
    } else {
      statusBox.innerHTML = `
        <span class="status-indicator warning"></span>
        <span class="status-text">GitHub target unconfigured</span>
      `;
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadConnections() {
  const grid = document.getElementById('connectionsGrid');
  grid.innerHTML = '';
  const connections = await window.api.getConnections();

  if (connections.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted);">No database connections yet. Click "+ Add Connection" to get started.</p>`;
    return;
  }

  connections.forEach(conn => {
    const card = document.createElement('div');
    card.className = 'card conn-card';
    card.setAttribute('data-card-id', conn.id);

    card.innerHTML = `
      <div>
        <div class="conn-header">
          <h3>${conn.name}</h3>
          <span class="badge ${conn.type}">${conn.type}</span>
        </div>
        <p class="conn-status" style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Ready</p>
      </div>

      <div class="conn-actions">
        <button class="btn primary btn-backup" onclick="runBackup('${conn.id}')">Backup Now</button>
        <button class="btn secondary" onclick="dryRun('${conn.id}')">Dry Run</button>
        <button class="btn secondary" onclick="editConnection('${conn.id}')">Edit</button>
        <button class="btn danger" onclick="deleteConnection('${conn.id}')">Delete</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

async function dryRun(id) {
  try {
    const result = await window.api.dryRunBackup(id);
    let details = `🔍 Dry-Run Preview for ${result.connectionName}:\n\n`;
    details += `• Database Type: ${result.type}\n`;
    details += `• Total Tables/Collections: ${result.tablesCount}\n`;
    details += `• Total Document/Row Count: ${result.totalRows}\n`;
    details += `• Estimated Payload Size: ~${result.estimatedSizeMB} MB\n\n`;
    details += `Table Breakdown:\n`;
    for (const [tbl, count] of Object.entries(result.tables)) {
      details += `  - ${tbl}: ${count} rows\n`;
    }
    alert(details);
  } catch (err) {
    alert(`Dry-run preview failed: ${err.message}`);
  }
}

async function runBackup(id) {
  try {
    await window.api.runBackup(id);
    alert('Backup completed successfully!');
  } catch (err) {
    alert(`Backup failed: ${err.message}`);
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

async function deleteConnection(id) {
  if (confirm('Are you sure you want to delete this connection?')) {
    await window.api.deleteConnection(id);
    await loadConnections();
  }
}

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
