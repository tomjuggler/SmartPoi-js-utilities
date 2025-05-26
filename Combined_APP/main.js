// Image Management Functions
function refreshAllImages(fullRefresh = false) {
    if (fullRefresh) {
        createBlackImages('mainImageGrid', state.poiIPs.mainIP);
        createBlackImages('auxImageGrid', state.poiIPs.auxIP);
    } else {
        // Just update image sizes
        document.querySelectorAll('.poi-image').forEach(img => {
            img.style.width = `${state.settings.pixels}px`;
            img.style.height = `${state.settings.pixels}px`;
        });
    }
}

function createBlackImages(containerId, ip) {
    const container = document.getElementById(containerId);
    
    // Clear existing images
    container.innerHTML = '';

    for (let i = 0; i < 62; i++) {
        const char = getCharFromIndex(i);
        const fileName = char + '.bin';
        
        const imgElement = document.createElement('img');
        imgElement.className = 'poi-image';
        imgElement.style.width = `${state.settings.pixels}px`;
        imgElement.style.height = `${state.settings.pixels}px`;
        imgElement.alt = fileName;

        imgElement.addEventListener('click', function() {
            decompressAndDisplay(ip, fileName);
        });

        imgElement.addEventListener('dragover', handleDragOver);
        imgElement.addEventListener('drop', (event) => handleImageDrop(event, ip));

        container.appendChild(imgElement);
    }
}

function getCharFromIndex(index) {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return characters.charAt(index);
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

async function decompressAndDisplay(ip, fileName) {
    try {
        const response = await fetch(`http://${ip}/edit?file=${fileName}`);
        const arrayBuffer = await response.arrayBuffer();
        const binaryData = new Uint8Array(arrayBuffer);
        const imageUrl = await decompress(binaryData);
        const rotatedImageUrl = await rotateImage90(imageUrl);

        // Create new image element
        const imgElement = document.createElement('img');
        imgElement.className = 'poi-image';
        imgElement.src = rotatedImageUrl;
        imgElement.alt = fileName;
        imgElement.style.width = `${state.settings.pixels}px`;
        imgElement.style.height = `${state.settings.pixels}px`;

        // Find and replace existing image
        const containerId = ip === state.poiIPs.mainIP ? 'mainImageGrid' : 'auxImageGrid';
        const container = document.getElementById(containerId);
        const existingImages = container.getElementsByClassName('poi-image');
        
        Array.from(existingImages).forEach(img => {
            if (img.alt === fileName) {
                img.parentNode.replaceChild(imgElement, img);
            }
        });

    } catch (error) {
        console.error(`Error decompressing and displaying ${fileName}:`, error);
        if (retryCount < MAX_RETRY_COUNT) {
            retryCount++;
            decompressAndDisplay(ip, fileName);
        } else {
            console.error(`Max retries exceeded for ${fileName}`);
            retryCount = 0;
        }
    }
}

async function decompress(binaryData) {
    const width = state.settings.pixels;
    const height = Math.ceil(binaryData.length / width);
    const image = new Jimp(width, height);

    let dataIndex = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (dataIndex < binaryData.length) {
                const encodedValue = binaryData[dataIndex];
                const r = ((encodedValue & 0xE0) >> 5) << 3;
                const g = ((encodedValue & 0x1C) >> 2) << 3;
                const b = (encodedValue & 0x03) << 6;
                image.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
                dataIndex++;
            }
        }
    }
    return image.getBase64Async(Jimp.MIME_PNG);
}

async function rotateImage90(imageUrl) {
    return new Promise((resolve, reject) => {
        Jimp.read(imageUrl, (err, image) => {
            if (err) reject(err);
            image.rotate(90).getBase64Async(Jimp.MIME_PNG)
                .then(resolve)
                .catch(reject);
        });
    });
}

async function fetchDataWithRetry(url) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;
            console.log(`Retrying... Attempt ${attempt}/${maxRetries}`);
        } catch (error) {
            console.error('Fetch error:', error);
            if (attempt === maxRetries) throw error;
        }
    }
}

function handleImageDrop(event, ip) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        handleImageUpload(files[0], ip);
    }
}

const MAX_RETRY_COUNT = 3;
let retryCount = 0;

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
    wsStrip: true,
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
    fetchInitialPixels();
    refreshAllImages();
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
    state.wsStrip = saved.wsStrip !== undefined ? saved.wsStrip : true;
    state.poiIPs = { ...state.poiIPs, ...saved.poiIPs };
    state.settings = { ...state.settings, ...saved.settings };
    
    // Initialize WS/APA indicator
    document.getElementById('ws_apa_indicator').textContent = 
        `Current: ${state.wsStrip ? 'WS2812' : 'APA102'}`;
    
    // Update UI elements with persisted state
    // Initialize router IP input
    const routerInput = document.getElementById('routerIpInput');
    routerInput.placeholder = '192.168.1.1';
    if (state.poiIPs.subnet) {
        routerInput.value = state.poiIPs.subnet + "1";
    }
    
    // Initialize manual IP inputs
    const mainIpInput = document.getElementById('manualMainIp');
    const auxIpInput = document.getElementById('manualAuxIp');
    mainIpInput.placeholder = state.poiIPs.mainIP || '192.168.1.x';
    auxIpInput.placeholder = state.poiIPs.auxIP || '192.168.1.x';
    document.getElementById('pixelInput').value = state.settings.pixels;
    document.getElementById('currentPx').textContent = `Current px: ${state.settings.pixels}`;
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
        wsStrip: state.wsStrip,
        poiIPs: state.poiIPs,
        settings: state.settings
    }));
}

// Image handling core functions
async function updatePixelsOnBoth() {
  const pixels = document.getElementById('pixelInput').value;
  if (!pixels || pixels < 1 || pixels > 1000) {
    createMessage('Invalid pixel value (1-1000)', 'error');
    return;
  }
  
  try {
    const [mainRes, auxRes] = await Promise.all([
      fetch(`http://${state.poiIPs.mainIP}/pixels?num=${pixels}`),
      fetch(`http://${state.poiIPs.auxIP}/pixels?num=${pixels}`)
    ]);
    
    if (!mainRes.ok || !auxRes.ok) throw new Error('Pixel update failed');
    
    state.settings.pixels = parseInt(pixels, 10);
    document.getElementById('pixelInput').value = state.settings.pixels;
    document.getElementById('currentPx').textContent = `Current px: ${state.settings.pixels}`;
    saveState();
    
    createMessage(`Pixels updated to ${state.settings.pixels}`);
    refreshAllImages(true); // Force full refresh
  } catch (error) {
    console.error('Pixel update failed:', error);
    createMessage('Failed to update pixels', 'error');
  }
}

async function getFilesAndDisplay() {
  getFilesOne();
  getFilesTwo();
}

async function getFilesOne() {
  const indicator = document.getElementById('get-files-one-indicator');
  try {
    indicator.textContent = "Fetching images...";
    const response = await fetch(`http://${state.poiIPs.mainIP}/list?dir=/`);
    const files = await response.json();
    const imageFiles = files.filter(f => f.name.endsWith('.bin')).map(f => f.name);
    
    for (const fileName of imageFiles) {
      await decompressAndDisplay(state.poiIPs.mainIP, fileName);
    }
    indicator.textContent = "Images fetched successfully";
  } catch (error) {
    console.error('Error fetching main images:', error);
    indicator.textContent = "Failed to fetch images";
  }
}

async function getFilesTwo() {
  const indicator = document.getElementById('get-files-two-indicator');
  try {
    indicator.textContent = "Fetching images...";
    const response = await fetch(`http://${state.poiIPs.auxIP}/list?dir=/`);
    const files = await response.json();
    const imageFiles = files.filter(f => f.name.endsWith('.bin')).map(f => f.name);
    
    for (const fileName of imageFiles) {
      await decompressAndDisplay(state.poiIPs.auxIP, fileName);
    }
    indicator.textContent = "Images fetched successfully";
  } catch (error) {
    console.error('Error fetching aux images:', error);
    indicator.textContent = "Failed to fetch images";
  }
}

// Add to init function
async function fetchInitialPixels() {
  try {
    const mainPixels = await fetchNumberOfPixels(state.poiIPs.mainIP);
    const auxPixels = await fetchNumberOfPixels(state.poiIPs.auxIP);
    
    // Always show current state, even if values differ between POIs
    state.settings.pixels = mainPixels || state.settings.pixels;
    document.getElementById('pixelInput').value = state.settings.pixels;
    document.getElementById('currentPx').textContent = `Current px: ${state.settings.pixels}`;
    
    if (mainPixels !== auxPixels) {
      createMessage('Warning: Main and Aux POIs have different pixel counts!', 'warning');
    }
  } catch (error) {
    console.error('Error fetching initial pixels:', error);
  }
}

function setupImageHandlers() {
    // Initialize image grids with current IPs
    createBlackImages('mainImageGrid', state.poiIPs.mainIP);
    createBlackImages('auxImageGrid', state.poiIPs.auxIP);

    // Add drag/drop handlers to containers
    document.querySelectorAll('.image-grid-container').forEach(grid => {
        grid.addEventListener('dragover', handleDragOver);
        grid.addEventListener('drop', (event) => handleImageDrop(event, 
            grid.id === 'mainImageGrid' ? state.poiIPs.mainIP : state.poiIPs.auxIP
        ));
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
    
    // Calculate exact thumb position
    const sliderWidth = speedSlider.offsetWidth;
    const thumbPosition = (e.target.value / speedSlider.max) * sliderWidth;
    speedTooltip.style.left = `${thumbPosition}px`;
    
    updateBothPOIs(`/intervalChange?interval=${value}`);
  });

  // Brightness Slider
  brightnessSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    brightnessTooltip.textContent = value;
    brightnessTooltip.style.opacity = '1';
    
    // Calculate exact thumb position
    const sliderWidth = brightnessSlider.offsetWidth;
    const range = brightnessSlider.max - brightnessSlider.min;
    const thumbPosition = ((value - brightnessSlider.min) / range) * sliderWidth;
    brightnessTooltip.style.left = `${thumbPosition}px`;
    
    updateBothPOIs(`/brightness?brt=${value}`);
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
    try {
        const response = await fetch(`http://${ip}/returnsettings`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.text();
        const parts = data.split(',').map(p => p.trim());
        
        // Get fresh pixel count from dedicated endpoint
        const pixels = await fetchNumberOfPixels(ip);
        
        return {
            router: parts[0] || 'N/A',
            password: parts[1] || 'N/A',
            channel: parts[2] || 'N/A',
            pattern: parts[parts.length - 1] || 'N/A',
            pixels: pixels || '?'
        };
    } catch (error) {
        console.error('Fetch settings failed:', error);
        return {
            router: 'N/A',
            password: 'N/A',
            channel: 'N/A',
            pattern: 'N/A',
            pixels: '?'
        };
    }
    
    // Try to get pixels separately to avoid failing entire request
    try {
        baseFields.pixels = await fetchNumberOfPixels(ip);
    } catch (error) {
        console.error('Failed to fetch pixels:', error);
        baseFields.pixels = '?';
    }
    
    return baseFields;
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

            // Update Main POI Display
            document.getElementById('router').textContent = mainData.router;
            document.getElementById('password').textContent = mainData.password;
            document.getElementById('channel').textContent = mainData.channel;
            document.getElementById('pattern').textContent = mainData.pattern;
            document.getElementById('pixels').textContent = mainData.pixels;

            // Update Aux POI Display
            document.getElementById('routerTwo').textContent = auxData.router;
            document.getElementById('passwordTwo').textContent = auxData.password;
            document.getElementById('channelTwo').textContent = auxData.channel;
            document.getElementById('patternTwo').textContent = auxData.pattern;
            document.getElementById('pixelsTwo').textContent = auxData.pixels;

            // Update input placeholders
            document.getElementById('routerInput').placeholder = mainData.router;
            document.getElementById('passwordInput').placeholder = mainData.password;

            // Update Main POI display
            // Update Main POI
            if (mainData) {
                // Direct DOM updates first
                document.getElementById('router').textContent = mainData.router;
                document.getElementById('password').textContent = mainData.password;
                document.getElementById('channel').textContent = mainData.channel;
                document.getElementById('pattern').textContent = mainData.pattern;
                document.getElementById('pixels').textContent = mainData.pixels || '?';

                // Then update state
                state.settings.router = mainData.router;
                state.settings.password = mainData.password;
                state.settings.channel = mainData.channel;
                state.settings.pattern = mainData.pattern;
                state.settings.pixels = await fetchNumberOfPixels(state.poiIPs.mainIP);
                
                // Update input placeholders
                document.getElementById('routerInput').placeholder = state.settings.router;
                document.getElementById('passwordInput').placeholder = state.settings.password;
            }

            // Update Aux POI 
            if (auxData) {
                state.settings.routerTwo = auxData.router;
                state.settings.passwordTwo = auxData.password;
                state.settings.channelTwo = auxData.channel;
                state.settings.patternTwo = auxData.pattern;
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
  // WS2812/APA102 toggle handler
  document.getElementById('ws_apaBtn').addEventListener('click', function() {
    state.wsStrip = !state.wsStrip;
    const indicator = document.getElementById('ws_apa_indicator');
    indicator.textContent = `Current: ${state.wsStrip ? 'WS2812' : 'APA102'}`;
    createMessage(`Switched to ${state.wsStrip ? 'WS2812 (compressed)' : 'APA102 (raw)'} mode`);
    saveState();
  });

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

