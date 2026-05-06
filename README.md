# MSWD Clients (Electron + Vite)

## Build

- Dev (Vite only): `npm run dev`
- Dev (Vite + Electron): `npm run start`
- Package installer (Windows NSIS): `npm run dist`

## Database location

The app uses SQLite (`mswdclients.db`).

- **Packaged app (installed)**: saved per Windows user in Electron `userData`:
  - `C:\Users\<YOU>\AppData\Roaming\MSWD Clients\mswdclients.db`
- **Development**: saved in the project folder:
  - `.\database\mswdclients.local.db`

### Override DB location (optional)

You can force a specific DB file path using an environment variable:

- PowerShell example:
  - `setx MSWD_DB_PATH "D:\MSWD\mswdclients.db"`

Restart the app after setting the variable.

### Show the current DB file path

From the renderer (DevTools console), you can call:

- `window.api.getDbPath()`

## First run behavior

If the DB file does not exist yet, the app starts with an empty DB and creates the tables automatically.
