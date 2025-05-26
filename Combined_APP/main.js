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
            await fetch(`http://${ip}/status`, { mode: 'no-cors' });
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

// IP Setting Functions
function setMainIp() {
    if (!state.poiIPs.routerMode) {
        createMessage('Enable Router Mode first!', 'warning');
        return;
    }
    const ip = document.getElementById('manualMainIp').value;
    if (validateIP(ip)) {
        state.poiIPs.mainIP = ip;
        saveState();
        createMessage(`Main IP set to ${ip}`);
        updateStatusIndicators();
    } else {
        showError('mainIpError', 'Invalid IP format');
    }
}

function setAuxIp() {
    if (!state.poiIPs.routerMode) {
        createMessage('Enable Router Mode first!', 'warning');
        return;
    }
    const ip = document.getElementById('manualAuxIp').value;
    if (validateIP(ip)) {
        state.poiIPs.auxIP = ip;
        saveState();
        createMessage(`Aux IP set to ${ip}`);
        updateStatusIndicators();
    } else {
        showError('auxIpError', 'Invalid IP format');
    }
}

function validateIP(ip) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
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
function showLoadingState(show) {
  document.getElementById('spinner').style.display = show ? 'block' : 'none';
  document.getElementById('counter').style.display = show ? 'block' : 'none';
}

function isValidIP(ip) {
  return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
}

function initializeNetworkDiscovery() {
    document.getElementById('discoverBtn').addEventListener('click', async () => {
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const response = await fetch(`http://${ip}/`, { 
                signal: controller.signal,
                mode: 'no-cors'
            });
            clearTimeout(timeoutId);
            
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
async function updatePixelsOnBoth() {
  const pixels = document.getElementById('pixelInput').value;
  try {
    await Promise.all([
      fetch(`http://${state.poiIPs.mainIP}/pixels?num=${pixels}`),
      fetch(`http://${state.poiIPs.auxIP}/pixels?num=${pixels}`)
    ]);
    createMessage(`Pixels updated to ${pixels}`);
    refreshAllImages();
  } catch (error) {
    console.error('Pixel update failed:', error);
    createMessage('Failed to update pixels', 'error');
  }
}

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
async function submitPattern(pattern) {
  try {
    await Promise.all([
      fetch(`http://${state.poiIPs.mainIP}/pattern?patternChooserChange=${pattern}`),
      fetch(`http://${state.poiIPs.auxIP}/pattern?patternChooserChange=${pattern}`)
    ]);
    highlightActiveButton(pattern);
    createMessage(`Pattern ${pattern} activated`);
  } catch (error) {
    console.error('Pattern change failed:', error);
    createMessage('Pattern sync failed', 'error');
  }
}

function initializePatternControls() {
  document.querySelectorAll('.pattern-buttons button').forEach(button => {
    button.addEventListener('click', handlePatternSelection);
  });
}

function handlePatternSelection(event) {
    const pattern = event.target.dataset.pattern;
    submitPattern(pattern);
    highlightActiveButton(pattern);
}

function highlightActiveButton(pattern) {
  document.querySelectorAll('.pattern-buttons button').forEach(btn => {
    if (btn && pattern && pattern >= 1 && pattern <= 7) {
      btn.classList.toggle('active', btn.dataset.pattern === pattern.toString());
    }
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
      fetch(`http://${state.poiIPs.mainIP}/resetimagetouse`),
      fetch(`http://${state.poiIPs.auxIP}/resetimagetouse`)
    ]);
    createMessage('Both POIs synchronized successfully');
  });
}

// Slider Controls
function initializeSliders() {
    const speedSlider = document.getElementById('speedSlider');
    const brightnessSlider = document.getElementById('brightnessSlider');
    const speedTooltip = document.getElementById('speedTooltip');
    const brightnessTooltip = document.getElementById('brightnessTooltip');

    if (!speedSlider || !brightnessSlider || !speedTooltip || !brightnessTooltip) {
        console.error('Slider elements not found in DOM');
        return;
    }

    // Initialize slider positions from state
    const initialSpeed = valueToSlider(state.settings.speed);
    const initialBrightness = state.settings.brightness;

    speedSlider.value = initialSpeed;
    brightnessSlider.value = initialBrightness;

    // Set initial tooltip values
    speedTooltip.textContent = `${sliderToValue(initialSpeed).toFixed(1)}s`;
    brightnessTooltip.textContent = initialBrightness;

    // Speed Slider
  speedSlider.addEventListener('input', (e) => {
    const value = sliderToValue(e.target.value);
    speedTooltip.textContent = `${value.toFixed(1)}s`;
    speedTooltip.style.opacity = '1';
    const percent = (e.target.value / 100);
    speedTooltip.style.left = `calc(${percent * 100}% - ${percent * 20}px)`;
    updateBothPOIs(`/intervalChange?interval=${value}`);
  });

  // Brightness Slider
  brightnessSlider.addEventListener('input', (e) => {
    brightnessTooltip.textContent = e.target.value;
    brightnessTooltip.style.opacity = '1';
    const percent = ((e.target.value - 20) / (255 - 20)) * 100;
    brightnessTooltip.style.left = `calc(${percent}% - ${percent * 0.2}px)`;
    updateBothPOIs(`/brightness?brt=${e.target.value}`);
  });
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

// Utility Functions
function createMessage(message, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = message;
  
  const container = document.getElementById('messages') || document.body;
  container.prepend(messageDiv);
  
  setTimeout(() => messageDiv.remove(), 5000);
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => element.style.display = 'none', 3000);
}
async function fetchNumberOfPixels(ip) {
    try {
        const response = await fetch(`http://${ip}/get-pixels`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return parseInt(await response.text(), 10);
    } catch (error) {
        console.error(`Error fetching pixels from ${ip}:`, error);
        return null;
    }
}

function sliderToValue(sliderPercent) {
    return sliderPercent <= 50 ? 
        0.5 + Math.floor((sliderPercent / 50) * 60) * 0.5 : 
        30 * Math.pow(1800 / 30, (sliderPercent - 50) / 50);
}

function valueToSlider(value) {
    return value <= 30 ? 
        ((value - 0.5) / 29.5) * 50 * (30 / 29.5) : 
        50 + (Math.log(value / 30) / Math.log(60)) * 50;
}

async function sendRequest(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.text();
        } catch (error) {
            if (attempt === retries) {
                createMessage(`Request failed: ${error.message}`, 'error');
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const savedIPs = JSON.parse(localStorage.getItem('poiIPs') || '{}');
    
    if (savedIPs.routerMode) {
        document.getElementById('routerModeCheckbox').checked = true;
        state.poiIPs.mainIP = savedIPs.mainIP || "192.168.1.1";
        state.poiIPs.auxIP = savedIPs.auxIP || "192.168.1.78";
    }

    init();
    initializePatternControls();
    initializeSync();
    setupImageHandlers();
    
    // Initialize sliders after DOM is ready
    setTimeout(() => {
        initializeSliders();
    }, 100);

    // Initialize slider positions from state
    const speedSlider = document.getElementById('speedSlider');
    const brightnessSlider = document.getElementById('brightnessSlider');
    speedSlider.value = valueToSlider(state.settings.speed);
    brightnessSlider.value = state.settings.brightness;


});

async function fetchSettings(ip) {
    const response = await fetch(`http://${ip}/returnsettings`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.text();
    const parts = data.split(',');
    
    return {
        router: parts[0]?.trim() || 'N/A',
        password: parts[1]?.trim() || 'N/A',
        channel: parts[2]?.trim() || 'N/A',
        pattern: parts[parts.length - 1]?.trim() || 'N/A',
        pixels: await fetchNumberOfPixels(ip)
    };
}
// Slider conversion functions
function sliderToValue(sliderPercent) {
    if (sliderPercent <= 50) {
        return 0.5 + Math.floor((sliderPercent / 50) * 60) * 0.5;
    }
    return 30 * Math.pow(1800 / 30, (sliderPercent - 50) / 50);
}

function valueToSlider(value) {
    if (value <= 30) {
        return ((value - 0.5) / 29.5) * 50 * (30 / 29.5);
    }
    return 50 + (Math.log(value / 30) / Math.log(60)) * 50;
}

// Modal Dialog Functions
// Fetch Button Handler
function initializeFetchButton() {
    document.getElementById('fetchBtn').addEventListener('click', async () => {
        try {
            createMessage('Fetching settings...', 'info');
            
            const [mainData, auxData] = await Promise.all([
                fetchSettings(state.poiIPs.mainIP),
                fetchSettings(state.poiIPs.auxIP)
            ]);

            // Update Main POI display
            // Update Main POI
            if (mainData) {
                const data = mainData;
                const parts = data.split(',');
                
                state.settings.router = parts[0].trim();
                state.settings.password = parts[1].trim();
                state.settings.channel = parts[2].trim();
                state.settings.pattern = parts[parts.length-1].trim();
                state.settings.pixels = await fetchNumberOfPixels(state.poiIPs.mainIP);

                document.getElementById('router').textContent = state.settings.router;
                document.getElementById('password').textContent = state.settings.password;
                document.getElementById('channel').textContent = state.settings.channel;
                document.getElementById('pattern').textContent = state.settings.pattern;
                document.getElementById('pixels').textContent = state.settings.pixels || '?';
                
                // Update input placeholders
                document.getElementById('routerInput').placeholder = state.settings.router;
                document.getElementById('passwordInput').placeholder = state.settings.password;
            }

            // Update Aux POI 
            if (auxData) {
                const data = auxData;
                const parts = data.split(',');
                
                state.settings.routerTwo = parts[0].trim();
                state.settings.passwordTwo = parts[1].trim();
                state.settings.channelTwo = parts[2].trim();
                state.settings.patternTwo = parts[parts.length-1].trim();
                state.settings.pixelsTwo = await fetchNumberOfPixels(state.poiIPs.auxIP);

                document.getElementById('routerTwo').textContent = state.settings.routerTwo;
                document.getElementById('passwordTwo').textContent = state.settings.passwordTwo;
                document.getElementById('channelTwo').textContent = state.settings.channelTwo;
                document.getElementById('patternTwo').textContent = state.settings.patternTwo;
                document.getElementById('pixelsTwo').textContent = state.settings.pixelsTwo || '?';
            }
            highlightActiveButton(mainData.pattern);
            // Force UI refresh
            saveState();
            updateStatusIndicators();
            createMessage('Settings updated successfully');
            highlightActiveButton(state.settings.pattern);

        } catch (error) {
            console.error('Fetch error:', error);
            createMessage('Failed to fetch settings - check POI connections', 'error');
            updateStatusIndicators();
            // Update UI with cached state on error
            document.getElementById('router').textContent = state.settings.router;
            document.getElementById('password').textContent = state.settings.password;
            document.getElementById('channel').textContent = state.settings.channel;
            document.getElementById('pattern').textContent = state.settings.pattern;
            document.getElementById('pixels').textContent = state.settings.pixels || '?';
        }
    });
}

function initializeModal() {
    document.querySelectorAll('.poi-image').forEach(img => {
        img.addEventListener('click', () => showModal(img.querySelector('img').src));
    });

    document.querySelector('.close-button').addEventListener('click', () => {
        document.querySelector('.modal-overlay').classList.add('hidden');
    });

    document.querySelector('.delete-button').addEventListener('click', async () => {
        const imageUrl = document.querySelector('.modal-image').src;
        await deleteImage(imageUrl);
        document.querySelector('.modal-overlay').classList.add('hidden');
        refreshAllImages();
    });
}

function showModal(imageSrc) {
    const modal = document.querySelector('.modal-overlay');
    const modalImg = modal.querySelector('.modal-image');
    modalImg.src = imageSrc;
    modal.querySelector('.filename').textContent = imageSrc.split('/').pop();
    modal.classList.remove('hidden');
}

async function deleteImage(imageUrl) {
    try {
        const response = await fetch(imageUrl, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete failed');
        createMessage('Image deleted successfully');
    } catch (error) {
        console.error('Delete error:', error);
        createMessage('Failed to delete image', 'error');
    }
}

// Initialize the application
function init() {
    loadState();
    setupTabNavigation();
    initializeNetworkDiscovery();
    initializeEventListeners();
    initializeModal();
    initializeFetchButton();
    checkInitialStatus();
    
    // Initialize slider positions from state
    const speedSlider = document.getElementById('speedSlider');
    const brightnessSlider = document.getElementById('brightnessSlider');
    if (speedSlider && brightnessSlider) {
        speedSlider.value = valueToSlider(state.settings.speed);
        brightnessSlider.value = state.settings.brightness;
    }
    
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
    
    // Clear STA IPs when disabling router mode
    if (!routerMode) {
        state.poiIPs.mainIP = "192.168.1.1";
        state.poiIPs.auxIP = "192.168.1.78";
    }

    localStorage.setItem('poiIPs', JSON.stringify(state.poiIPs));
    
    // Send to both POIs
    Promise.all([
        fetch(`http://${state.poiIPs.mainIP}/router?router=${routerMode ? 1 : 0}`),
        fetch(`http://${state.poiIPs.auxIP}/router?router=${routerMode ? 1 : 0}`)
    ]).then(() => {
        createMessage('Router mode updated');
        updateStatusIndicators();
    }).catch(error => {
        console.error('Error updating router mode:', error);
        createMessage('Router mode update failed', 'error');
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
  // Add manual IP handlers
  document.getElementById('manualMainIp').addEventListener('change', setMainIp);
  document.getElementById('manualAuxIp').addEventListener('change', setAuxIp);
  
  // Add pattern button handlers
  document.querySelectorAll('.pattern-buttons button').forEach(button => {
    button.addEventListener('click', handlePatternSelection);
  });
    // Danger Zone controls
    document.getElementById('routerModeCheckbox').addEventListener('change', submitRouterMode);
    document.getElementById('channelInput').nextElementSibling.addEventListener('click', submitChannel);
    document.querySelector('[onclick="submitRouter()"]').addEventListener('click', submitRouter);

  // Danger Zone controls
  document.getElementById('routerModeCheckbox').addEventListener('change', submitRouterMode);
  document.getElementById('channelInput').nextElementSibling.addEventListener('click', submitChannel);
  document.querySelector('[onclick="submitRouter()"]').addEventListener('click', submitRouter);
}

