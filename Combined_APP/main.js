// State Management
function checkInitialStatus() {
    updateStatusIndicators();
    if (!state.poiIPs.mainIP || !state.poiIPs.auxIP) {
        createMessage('Please configure POI IP addresses first', 'warning');
    }
}

function updateStatusIndicators() {
    const checkStatus = async (ip) => {
        try {
            await fetch(`http://${ip}/status`, { timeout: 2000 });
            return 'online';
        } catch {
            return 'offline';
        }
    };

    Promise.all([
        checkStatus(state.poiIPs.mainIP),
        checkStatus(state.poiIPs.auxIP)
    ]).then(([mainStatus, auxStatus]) => {
        document.getElementById('mainStatus').className = `status-indicator ${mainStatus}`;
        document.getElementById('auxStatus').className = `status-indicator ${auxStatus}`;
    });
}

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
    state.settings = { ...state.settings, ...saved.settings };
    
    // Update UI elements
    document.getElementById('routerIpInput').value = state.poiIPs.subnet + "1";
    document.getElementById('pixelInput').value = state.settings.pixels;
}

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
  });
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
    if (!state.poiIPs.mainIP || !state.poiIPs.auxIP) {
        createMessage('Configure IP addresses first', 'warning');
        return;
    }
    
    try {
        await Promise.all([
            fetch(`http://${state.poiIPs.mainIP}/pattern?patternChooserChange=${pattern}`),
            fetch(`http://${state.poiIPs.auxIP}/pattern?patternChooserChange=${pattern}`)
        ]);
        createMessage(`Pattern ${pattern} activated`);
    } catch (error) {
        console.error('Pattern change failed:', error);
        createMessage('Pattern change failed - check POI connections', 'error');
        updateStatusIndicators();
    }
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
      fetch(`http://${state.poiIPs.mainIP}${endpoint}`),
      fetch(`http://${state.poiIPs.auxIP}${endpoint}`)
    ]);
    createMessage('Settings updated on both POIs');
  } catch (error) {
    console.error('Error updating POIs:', error);
    createMessage('Error updating settings', 'error');
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    init();
    initializePatternControls();
    initializeSync();
    initializeSliders();
    setupImageHandlers();  // Initialize image handling upfront
});
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
        initializePatternControls();
        initializeSync();
    } else if (tabName === 'images') {
        setupImageHandlers();
        refreshAllImages();
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

// Danger Zone Functions
function submitRouterMode() {
    const routerMode = document.getElementById('routerModeCheckbox').checked;
    state.poiIPs.routerMode = routerMode;
    
    // Send to both POIs
    Promise.all([
        fetch(`http://${state.poiIPs.mainIP}/mode?router=${routerMode ? 1 : 0}`),
        fetch(`http://${state.poiIPs.auxIP}/mode?router=${routerMode ? 1 : 0}`)
    ]).then(() => {
        createMessage('Router mode updated successfully');
        saveState();
    }).catch(error => {
        console.error('Error updating router mode:', error);
        createMessage('Failed to update router mode', 'error');
    });
}

function submitChannel() {
    const channel = document.getElementById('channelInput').value;
    if (!channel || channel < 1 || channel > 13) {
        showError('channelError', 'Invalid channel (1-13)');
        return;
    }

    Promise.all([
        fetch(`http://${state.poiIPs.mainIP}/channel?num=${channel}`, { method: 'POST' }),
        fetch(`http://${state.poiIPs.auxIP}/channel?num=${channel}`, { method: 'POST' })
    ]).then(() => {
        createMessage(`Channel updated to ${channel}`);
        saveState();
    }).catch(error => {
        console.error('Channel update failed:', error);
        createMessage('Channel update failed', 'error');
    });
}

function submitRouter() {
    const ssid = document.getElementById('routerInput').value;
    const password = document.getElementById('passwordInput').value;
    
    if (!ssid || !password) {
        showError('routerError', 'Both fields required');
        return;
    }

    const formData = new URLSearchParams();
    formData.append('ssid', ssid);
    formData.append('pass', password);

    Promise.all([
        fetch(`http://${state.poiIPs.mainIP}/wifi`, {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }),
        fetch(`http://${state.poiIPs.auxIP}/wifi`, {
            method: 'POST',
            body: formData,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        })
    ]).then(() => {
        createMessage('Router credentials updated');
        saveState();
    }).catch(error => {
        console.error('Router update failed:', error);
        createMessage('Failed to update router', 'error');
    });
}

// Unified Event Listeners
function initializeEventListeners() {
    // Danger Zone controls
    document.getElementById('routerModeCheckbox').addEventListener('change', submitRouterMode);
    document.getElementById('channelInput').nextElementSibling.addEventListener('click', submitChannel);
    document.querySelector('[onclick="submitRouter()"]').addEventListener('click', submitRouter);

  // Danger Zone controls
  document.getElementById('routerModeCheckbox').addEventListener('change', submitRouterMode);
  document.getElementById('channelInput').nextElementSibling.addEventListener('click', submitChannel);
  document.querySelector('[onclick="submitRouter()"]').addEventListener('click', submitRouter);
}

