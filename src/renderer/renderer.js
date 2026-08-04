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
    });
  });

  // Modal Handling
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

  // Save Connection Form
  connForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('connId').value || Date.now().toString();
    const name = document.getElementById('connName').value.trim();
    const type = document.getElementById('connType').value;
    const secret = document.getElementById('connSecret').value.trim();

    try {
      await window.api.saveConnection({ id, name, type, secret });
      modal.classList.remove('active');
      await loadConnections();
    } catch (err) {
      alert(`Error saving connection: ${err.message}`);
    }
  });

  // Test Connection in Modal
  document.getElementById('btnTestConn').addEventListener('click', async () => {
    const type = document.getElementById('connType').value;
    const secret = document.getElementById('connSecret').value.trim();
    if (!secret) return alert('Please provide a connection secret first.');

    try {
      await window.api.testConnection({ type, secret });
      alert('Database Connection Successful!');
    } catch (err) {
      alert(`Connection Failed: ${err.message}`);
    }
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
        <button class="btn secondary" onclick="editConnection('${conn.id}')">Edit</button>
        <button class="btn danger" onclick="deleteConnection('${conn.id}')">Delete</button>
      </div>
    `;

    grid.appendChild(card);
  });
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

async function loadLogs() {
  const tbody = document.getElementById('logsTableBody');
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
