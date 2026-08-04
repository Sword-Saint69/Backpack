# Backpack — Zero-Cost Database Backup Desktop App

> **Pack up your databases. Back them up to GitHub, free.**

Backpack is a cross-platform desktop application built with Electron & Node.js that automatically exports data from PostgreSQL, MySQL, Firebase Firestore, and SQLite databases, and pushes versioned point-in-time snapshots directly to a GitHub repository.

---

## 🌟 Key Features

- **Zero-Cost Storage**: Uses GitHub public or private repositories as free, versioned point-in-time backup storage.
- **Multi-Database Support**: PostgreSQL / NeonDB, MySQL, Firebase Firestore, and SQLite.
- **Automated Scheduling**: In-app cron-style scheduler (`hourly`, `daily`, `weekly`, or `custom cron`) with background tray icon execution and system startup launch.
- **Client-Side AES Encryption**: Optional AES-256-GCM encryption of database payloads at rest before committing to public or shared GitHub repositories.
- **Gzip Compression**: Built-in Gzip compression (`.json.gz`) to reduce transfer and storage sizes by ~70-80%.
- **Dry-Run Preview**: Preview table/collection document counts and estimated payload size (MB) without committing or pushing.
- **Selective Backup**: Pick specific tables/collections instead of full dumps.
- **Restore Wizard**: Browse snapshot commit history from GitHub, decrypt payloads, and auto-generate SQL `INSERT` replay scripts for PostgreSQL/MySQL.
- **Safe by Default**: Connection credentials and GitHub PAT tokens are encrypted at rest via OS Keychain (`safeStorage`).

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation & Launch

```bash
# Clone the repository
git clone https://github.com/Sword-Saint69/Backpack.git
cd Backpack

# Install dependencies
npm install

# Start Backpack Desktop App
npm run start
```

---

## 🔒 Security Model

1. **Local Keychain Encryption**: All connection credentials and GitHub tokens are encrypted on disk via Electron's `safeStorage` API backed by macOS Keychain, Windows DPAPI, or Linux Secret Service.
2. **Context Isolation**: Renderer UI runs in a sandboxed environment (`contextIsolation: true`, `nodeIntegration: false`) and never receives raw decrypted secrets.
3. **Fine-Grained Scope**: Works with GitHub fine-grained Personal Access Tokens (PAT) scoped strictly to `Contents: Read and write` on your backup repository.

---

## 📦 Project Architecture

```
d:/Backpack/
├── auto-push.ps1          # Automatic version bumper & release script
├── package.json           # App configuration & dependencies
├── src/
│   ├── main.js            # Electron main process & IPC handlers
│   ├── preload.js         # ContextBridge security isolation window
│   ├── store.js           # safeStorage encrypted electron-store wrapper
│   ├── adapters/          # Pluggable Database Adapters
│   │   ├── index.js       # Adapter registry
│   │   ├── postgres.js    # PostgreSQL / NeonDB
│   │   ├── mysql.js       # MySQL
│   │   ├── firebase.js    # Firebase Firestore
│   │   └── sqlite.js      # SQLite
│   ├── lib/
│   │   ├── backupRunner.js# Backup orchestrator & manifest synthesizer
│   │   ├── github.js      # Octokit Contents API uploader & chunker
│   │   ├── scheduler.js   # node-cron unattended scheduling
│   │   ├── crypto.js      # AES-256-GCM encryption/decryption
│   │   ├── notifier.js    # Desktop OS notifications
│   │   └── restoreEngine.js# Snapshot history browser & SQL generator
│   └── renderer/          # Modern Dark Glassmorphism UI
│       ├── index.html
│       ├── styles.css
│       └── renderer.js
```

---

## 📜 License

ISC License.
