const net = require('node:net');
const { app, BrowserWindow, dialog } = require('electron');

let mainWindow;
let appUrl;

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(startApp).catch((error) => {
    console.error('Unable to start Mochi-Puff:', error);
    dialog.showErrorBox('Mochi-Puff could not start', error.message);
    app.quit();
  });
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Could not determine an available local port.'));
        return;
      }
      probe.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

async function waitForServer(url) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`Local server returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Mochi-Puff's local server did not start: ${lastError?.message || 'unknown error'}`);
}

async function startApp() {
  const port = await getAvailablePort();
  appUrl = `http://127.0.0.1:${port}`;
  process.env.PORT = String(port);
  process.env.HOST = '127.0.0.1';
  process.env.MOCHI_USER_DATA_DIR = app.getPath('userData');
  require('../server.js');
  await waitForServer(appUrl);

  createWindow();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1150,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: 'Mochi-Puff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.loadURL(appUrl);
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && appUrl) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
