// State Management
const state = {
    poiIPs: {
        mainIP: "192.168.1.1",
        auxIP: "192.168.1.78",
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
    },
    currentModalImage: null
};

// Initialize App
function init() {
    loadState();
    setupTabNavigation();
    initializeNetworkDiscovery();
    setupImageHandlers();
    initializeModal();
    initializeEventListeners();
    initializeSliders();
    checkInitialStatus();
}

// State Persistence
function loadState() {
    const saved = JSON.parse(localStorage.getItem('poiState') || '{}');
    state.poiIPs = { ...state.poiIPs, ...saved.poiIPs };

// Network Discovery Implementation
function initializeNetworkDiscovery() {
  const discoverBtn = document.getElementById('discoverBtn');
  discoverBtn.addEventListener('click', async () => {
    const routerIp = document.getElementById('routerIpInput').value;
    if (!validateIP(routerIp)) {
      showError('ipError', 'Invalid IP address format!');
      return;
    }

    const octets = routerIp.split('.').slice(0, 3);
    const subnet = octets.join('.') + '.';
    state.poiIPs.subnet = subnet;

    showLoadingState(true);
    
    try {
      const { mainIP, auxIP } = await scanNetwork(subnet);
      state.poiIPs.mainIP = mainIP;
      state.poiIPs.auxIP = auxIP;
      state.poiIPs.routerMode = true;
      saveState();
      updateStatusIndicators();
    } catch (error) {
      showError('result', 'No POI found on this subnet');
    } finally {
      showLoadingState(false);
    }
  }
}

async function scanNetwork(subnet) {
  const scanOrder = generateScanOrder(subnet);
  let foundDevices = [];

  for (const ip of scanOrder) {
    try {
      const response = await fetch(`http://${ip}/`, { timeout: 1500 });
      if (response.ok) {
        foundDevices.push(ip);
        if (foundDevices.length === 2) break;
      }
    } catch (error) {
      // Continue scanning on error
    }
  }
  
  return {
    mainIP: foundDevices[0] || state.poiIPs.mainIP,
    auxIP: foundDevices[1] || state.poiIPs.auxIP
  };
}

function generateScanOrder(subnet) {
  const cachedIPs = JSON.parse(localStorage.getItem('poiIPs') || '{}');
  let scanOrder = [];

  if (cachedIPs.subnet === subnet && cachedIPs.mainIP) {
    const baseIP = cachedIPs.mainIP.split('.').pop();
    let current = parseInt(baseIP, 10);
    let offset = 0;
    
    while (scanOrder.length < 254) {
      const low = current - offset;
      const high = current + offset;
      
      if (low >= 1 && !scanOrder.includes(low)) scanOrder.push(low);
      if (high <= 254 && high !== low && !scanOrder.includes(high)) scanOrder.push(high);
      offset++;
    }
    
    scanOrder = [current, current, current, ...scanOrder.filter(ip => ip !== current)];
  } else {
    scanOrder = Array.from({length: 254}, (_, i) => i + 1);
  }

  return scanOrder.map(octet => `${subnet}${octet}`);
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

// Pattern Handling
function initializePatternControls() {
  document.querySelectorAll('.pattern-buttons button').forEach(button => {
    button.addEventListener('click', async () => {
      const pattern = button.dataset.pattern;
      await setPatternOnBoth(pattern);
      highlightActiveButton(pattern);
    });
  });
}

function highlightActiveButton(pattern) {
  document.querySelectorAll('.pattern-buttons button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pattern === pattern);
  });
}

async function setPatternOnBoth(pattern) {
  await Promise.all([
    fetch(`http://${state.poiIPs.main}/pattern?patternChooserChange=${pattern}`),
    fetch(`http://${state.poiIPs.aux}/pattern?patternChooserChange=${pattern}`)
  ]);
}

// Sync Handling
function initializeSync() {
  document.getElementById('syncButton').addEventListener('click', async () => {
    await Promise.all([
      fetch(`http://${state.poiIPs.main}/resetimagetouse`),
      fetch(`http://${state.poiIPs.aux}/resetimagetouse`)
    ]);
    createMessage('Both POIs synchronized successfully');
  });
}

// Slider Controls
function initializeSliders() {
  const speedSlider = document.getElementById('speedSlider');
  const brightnessSlider = document.getElementById('brightnessSlider');
  
  function debounce(func, timeout = 500) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
  }

  speedSlider.addEventListener('input', debounce(async (e) => {
    const value = sliderToValue(e.target.value);
    await updateBothPOIs(`/intervalChange?interval=${value}`);
  }));

  brightnessSlider.addEventListener('input', debounce(async (e) => {
    await updateBothPOIs(`/brightness?brt=${e.target.value}`);
  }));
}

async function updateBothPOIs(endpoint) {
  try {
    await Promise.all([
      fetch(`http://${state.poiIPs.main}${endpoint}`),
      fetch(`http://${state.poiIPs.aux}${endpoint}`)
    ]);
    createMessage('Settings updated on both POIs');
  } catch (error) {
    console.error('Error updating POIs:', error);
    createMessage('Error updating settings', 'error');
  });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  init();
  initializePatternControls();
  initializeSync();
  initializeSliders();
});
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

// Unified Event Listeners
function initializeEventListeners() {
  // Pattern buttons
  document.querySelectorAll('.pattern-buttons button').forEach(button => {
    button.addEventListener('click', async () => {
      const pattern = button.dataset.pattern;
      await setPatternOnBoth(pattern);
      highlightActiveButton(pattern);
    });
  });

  // Sync button
  document.getElementById('syncButton').addEventListener('click', async () => {
    await Promise.all([
      fetch(`http://${state.poiIPs.mainIP}/resetimagetouse`),
      fetch(`http://${state.poiIPs.auxIP}/resetimagetouse`)
    ]);
    createMessage('Both POIs synchronized successfully');
  });

  // Danger Zone controls
  document.getElementById('routerSubmit').addEventListener('click', submitRouter);
  document.getElementById('channelSubmit').addEventListener('click', submitChannel);
}

