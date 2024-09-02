const { app, BrowserWindow, Menu, screen } = require('electron'); // Updated import
app.setName('smartPoi-js-utilities');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked'); // Updated import

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize; // Get screen size

  const iconPath = process.platform === 'darwin' ? path.join(__dirname, 'build/icon.icns') :
                   process.platform === 'win32' ? path.join(__dirname, 'build/icon.ico') :
                   path.join(__dirname, 'build/icon.png'); // Default for Linux

  const win = new BrowserWindow({
    width: width, // Set width to screen width
    height: height, // Set height to screen height
    title: 'SmartPoi-js-utilities',
    icon: iconPath, // Set platform-specific icon
    resizable: true, // Make window resizable
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html'); // Load index.html on launch

  // Create a custom menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'Menu',
      submenu: [
        {
          label: 'Back to Main Menu',
          click: () => {
            win.loadFile('index.html');
          }
        },
        {
          label: 'Show README',
          click: () => {
            const readmePath = path.join(__dirname, 'README.MD');
            fs.readFile(readmePath, 'utf-8', (err, data) => {
              if (err) {
                console.error('Failed to read README.MD:', err);
                return;
              }
              const htmlContent = marked.parse(data); // Use marked.parse
              const readmeWindow = new BrowserWindow({
                width: 800,
                height: 600,
                resizable: true, // Make README window resizable
                webPreferences: {
                  nodeIntegration: true,
                  contextIsolation: false
                }
              });
              readmeWindow.loadFile('readme.html');
              readmeWindow.webContents.on('did-finish-load', () => {
                readmeWindow.webContents.send('load-readme', htmlContent);
              });
            });
          }
        },
        { role: 'reload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ]);

  // Set the application menu
  Menu.setApplicationMenu(menu);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
