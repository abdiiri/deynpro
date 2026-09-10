# DeynPro — Offline Electron App

Fully offline, no login, no accounts, no internet required.
All data is stored locally in a SQLite database via `better-sqlite3`.

## Running

```bash
npm install
npm run electron        # build + launch
npm run electron:pack   # package into a distributable
```

## Architecture

```
Renderer (React/Vite)
  └─ window.electronDB  (IPC bridge via preload.cjs)
       └─ Electron Main (main.cjs)
            └─ better-sqlite3 → deynpro.db
```

## Data Location

- **Windows**: `%APPDATA%\DeynPro\deynpro.db`
- **macOS**: `~/Library/Application Support/DeynPro/deynpro.db`
- **Linux**: `~/.config/DeynPro/deynpro.db`

Use the Export/Import feature in Settings to back up or restore your data.
