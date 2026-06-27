const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

// Disable SUID sandbox on Linux to prevent the chrome-sandbox error in AppImages/sandboxed environments
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

let mainWindow = null;
let serverProcess = null;
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
const useVite = process.argv.includes('--vite');
const SERVER_PORT = process.env.PORT || 3001;

let serverReady = false;

function getApiPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'api');
  }
  return path.join(process.resourcesPath, 'api');
}

function findDevkitArm() {
  const apiPath = getApiPath();
  const searchPaths = [];
  if (process.platform === 'win32') {
    searchPaths.push(
      path.join(apiPath, 'buildTools', 'windows', 'devkitpro', 'devkitARM'),
      path.join(apiPath, '..', 'buildTools', 'windows', 'devkitpro', 'devkitARM')
    );
  } else {
    searchPaths.push(
      path.join(apiPath, 'buildTools', 'linux', 'devkitpro', 'devkitARM'),
      path.join(apiPath, '..', 'buildTools', 'linux', 'devkitpro', 'devkitARM')
    );
  }
  return searchPaths.find(p => p && fs.existsSync(p)) || '';
}

function findDevkitPro() {
  const apiPath = getApiPath();
  const searchPaths = [];
  if (process.platform === 'win32') {
    searchPaths.push(
      path.join(apiPath, 'buildTools', 'windows', 'devkitpro'),
      path.join(apiPath, '..', 'buildTools', 'windows', 'devkitpro')
    );
  } else {
    searchPaths.push(
      path.join(apiPath, 'buildTools', 'linux', 'devkitpro'),
      path.join(apiPath, '..', 'buildTools', 'linux', 'devkitpro')
    );
  }
  return searchPaths.find(p => p && fs.existsSync(p)) || '';
}

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(getApiPath(), 'server.js');
    if (!fs.existsSync(serverPath)) {
      console.error('Server script not found at:', serverPath);
      reject(new Error('Server script not found at ' + serverPath));
      return;
    }

    const downloadsDir = isDev
      ? path.join(getApiPath(), 'downloads')
      : path.join(app.getPath('userData'), 'downloads');

    const env = {
      ...process.env,
      PORT: String(SERVER_PORT),
      NODE_ENV: isDev ? 'development' : 'production',
      DEVKITARM: findDevkitArm(),
      DEVKITPRO: findDevkitPro(),
      DOWNLOADS_DIR: downloadsDir,
    };

    serverProcess = fork(serverPath, [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[server] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[server] ${data.toString().trim()}`);
    });

    serverProcess.on('message', (msg) => {
      if (msg === 'ready' || (msg && msg.type === 'ready')) {
        resolve();
      }
    });

    serverProcess.on('error', (err) => {
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
      serverProcess = null;
      // Auto-restart on unexpected exit (non-zero code)
      if (code !== 0 && !app.isQuitting) {
        console.log('[server] Restarting server in 1 second...');
        setTimeout(() => {
          startServer().then(() => {
            console.log('Server restarted successfully.');
            if (mainWindow) navigateToApp();
          }).catch(err => {
            console.error('Failed to restart server:', err);
          });
        }, 1000);
      }
    });

    setTimeout(() => resolve(), 3000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'PxGBA - Game Boy Advance Game Studio',
    icon: path.join(__dirname, '..', 'public', 'icon-512.png'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  if (isDev && useVite) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'right' });
  } else {
    // Show a loading screen immediately while the server starts
    mainWindow.loadURL(
      'data:text/html,<html><body style="background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="color:#94a3b8;font-family:sans-serif;font-weight:300;font-size:1.5rem">PxGBA</h1><p style="color:#64748b;font-family:sans-serif;font-size:0.875rem">Loading...</p></div></body></html>'
    );
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'right' });
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function navigateToApp(retries = 3) {
  if (!mainWindow) return;
  const url = isDev && useVite ? 'http://localhost:5173' : `http://localhost:${SERVER_PORT}`;
  mainWindow.loadURL(url).catch(err => {
    console.error(`Failed to load app (${retries} retries left):`, err);
    if (retries > 0) {
      setTimeout(() => navigateToApp(retries - 1), 1500);
    } else {
      mainWindow.loadURL(
        'data:text/html,<html><body style="background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p style="color:#ef4444;font-family:sans-serif">Failed to load app. Check console for details.</p></body></html>'
      );
    }
  });
}

app.whenReady().then(() => {
  // Show the window immediately with a loading screen
  createWindow();

  // Start the backend server in background (non-blocking)
  startServer().then(() => {
    serverReady = true;
    console.log(`Server started on port ${SERVER_PORT}`);
    // Once the server is ready, load the frontend from it
    navigateToApp();
  }).catch(err => {
    console.error('Failed to start server:', err);
    if (mainWindow) {
      mainWindow.loadURL(
        'data:text/html,<html><body style="background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p style="color:#ef4444;font-family:sans-serif">Server failed to start. Check console.</p></body></html>'
      );
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.isQuitting = false;

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
