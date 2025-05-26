// State Management
const state = {
    poiIPs: {
        main: "192.168.1.1",
        aux: "192.168.1.78", 
        routerMode: false,
        subnet: ""
    },
    currentTab: "controls",
    patterns: {
        current: 1,
        available: 7
    },
    images: {
        main: [],
        aux: []
    },
    settings: {
        pixels: 120,
        brightness: 20,
        speed: 0.5,
        stripType: "WS2812"
    }
};

// Initialize App
function init() {
    loadState();
    setupTabNavigation();
    setupEventListeners();
    initializeNetworkDiscovery();
    setupImageHandlers();
    checkInitialStatus();
}

// State Persistence
function loadState() {
    const saved = JSON.parse(localStorage.getItem('poiState') || '{}');
    state.poiIPs = { ...state.poiIPs, ...saved.poiIPs };
    state.settings = { ...state.settings, ...saved.settings };
    
    // Update UI elements
    document.getElementById('routerIpInput').value = state.poiIPs.subnet + "1";
    document.getElementById('pixelInput').value = state.settings.pixels;
}

function saveState() {
    localStorage.setItem('poiState', JSON.stringify({
        poiIPs: state.poiIPs,
        settings: state.settings
    }));
}

// Image handling core functions
function setupImageHandlers() {
    // Initialize image grids
    createBlackImages('mainImageGrid', state.poiIPs.main);
    createBlackImages('auxImageGrid', state.poiIPs.aux);

    // Drag and drop handling
    const grids = document.querySelectorAll('.image-grid-container');
    grids.forEach(grid => {
        grid.addEventListener('dragover', handleDragOver);
        grid.addEventListener('drop', handleImageDrop);
    });

    // Button handlers
    document.getElementById('refreshImages').addEventListener('click', refreshAllImages);
    document.getElementById('updatePixels').addEventListener('click', updatePixelsOnBoth);
}

function handleImageDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const targetGrid = event.target.closest('.image-grid-container');
        const ip = targetGrid.id === 'mainImageGrid' ? state.poiIPs.main : state.poiIPs.aux;
        handleImageUpload(files[0], ip);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);
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
// Shared application state
const state = {
    poiOneIP: "192.168.1.1",
    poiTwoIP: "192.168.1.78",
    routerMode: false,
    currentTab: "controls",
    numberOfPixels: 120,
    wsStrip: true,
    currentModalImage: null
};

// Initialize the application
function init() {
    loadPersistedState();
    setupTabNavigation();
    initializeEventListeners();
    checkInitialStatus();
    
    // Load initial tab content
    loadTabContent(state.currentTab);
}

// Tab management
function setupTabNavigation() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            // Update active tab button
            document.querySelectorAll('.tab-button').forEach(btn => 
                btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update tab content
            state.currentTab = button.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(content => 
                content.classList.remove('active'));
            document.getElementById(state.currentTab).classList.add('active');
            
            // Load content if needed
            loadTabContent(state.currentTab);
        });
    });
}

// Load tab-specific content
function loadTabContent(tabName) {
    if (tabName === 'controls') {
        loadControlsTab();
    } else if (tabName === 'images') {
        loadImagesTab();
    }
}

// State management
function loadPersistedState() {
    const savedState = JSON.parse(localStorage.getItem('poiState'));
    if (savedState) {
        Object.assign(state, savedState);
    }
}

function savePersistedState() {
    localStorage.setItem('poiState', JSON.stringify({
        poiOneIP: state.poiOneIP,
        poiTwoIP: state.poiTwoIP,
        routerMode: state.routerMode,
        numberOfPixels: state.numberOfPixels,
        wsStrip: state.wsStrip
    }));
}

// Initialize event listeners
function initializeEventListeners() {
    // Modal controls
    document.querySelector('.close-button').addEventListener('click', () => {
        document.querySelector('.modal-overlay').classList.add('hidden');
    });
    
    document.querySelector('.delete-button').addEventListener('click', () => {
        if (state.currentModalImage) {
            deleteImage(state.currentModalImage);
        }
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', init);
