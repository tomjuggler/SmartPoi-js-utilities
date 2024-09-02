const { app, BrowserWindow, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked'); // Updated import

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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
