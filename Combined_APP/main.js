// Shared Image Processing Function
async function processImageFile(file) {
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
            try {
                const image = await Jimp.read(event.target.result);
                const rotatedImage = image.rotate(-90);
                const rotatedWidth = rotatedImage.bitmap.width;
                const rotatedHeight = rotatedImage.bitmap.height;
                
                const aspectRatio = rotatedWidth / (state.wsStrip ? rotatedHeight/2 : rotatedHeight);
                const targetHeight = Math.floor(state.settings.pixels / aspectRatio);
                
                const processed = rotatedImage.resize(
                    state.settings.pixels,  // width
                    targetHeight            // height
                );

                const binaryData = [];
                processed.scan(0, 0, processed.bitmap.width, processed.bitmap.height, 
                    (x, y, idx) => {
                        const r = processed.bitmap.data[idx];
                        const g = processed.bitmap.data[idx + 1];
                        const b = processed.bitmap.data[idx + 2];
                        const encoded = ((r & 0xE0) | ((g & 0xE0) >> 3) | (b >> 6));
                        binaryData.push(encoded);
                    }
                );

                resolve(new Uint8Array(binaryData));
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsDataURL(file);
    });
}

// Image Upload Handler
async function handleImageUpload(file, ip, targetFileName) {
    // Validate target filename first
    if (!/^[a-zA-Z0-9-_.]{1,50}\.bin$/i.test(targetFileName)) {
        createMessage('Invalid target tile filename', 'error');
        return;
    }
    
    if (!/^[a-zA-Z0-9-_.]{1,50}\.bin$/i.test(targetFileName)) {
        createMessage('Invalid target tile filename', 'error');
        return;
    }

    // Store original pattern and turn off LEDs for upload
    let originalPattern;
    try {
        originalPattern = await fetch(`http://${ip}/returnsettings`)
            .then(res => res.text())
            .then(data => data.split(',').pop().trim());
        
        await fetch(`http://${ip}/pattern?patternChooserChange=7`);
    } catch (error) {
        console.error('Error preparing for upload:', error);
        createMessage('Failed to initialize upload', 'error');
        return;
    }

    try {
        const binaryData = await processImageFile(file);
        
        const formData = new FormData();
        formData.append('file', new Blob([binaryData], {
            type: 'application/octet-stream'
        }), targetFileName);

        const uploadResponse = await fetch(`http://${ip}/edit`, {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }
        
        createMessage(`Image ${targetFileName} uploaded successfully`);
        decompressAndDisplay(ip, targetFileName);
    } catch (error) {
        console.error('Upload failed:', error);
        createMessage(`Upload failed: ${error.message}`, 'error');
    } finally {
        // Restore original pattern
        try {
            await fetch(`http://${ip}/pattern?patternChooserChange=${originalPattern}`);
        } catch (error) {
            console.error('Failed to restore pattern:', error);
        }
    }
}

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
    container.innerHTML = '';

    for (let i = 0; i < 62; i++) {
        const char = getCharFromIndex(i);
        const fileName = char + '.bin';
        
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper draggable-file';
        wrapper.draggable = true;
        wrapper.dataset.fileName = fileName;
        
        const imgElement = document.createElement('img');
        imgElement.className = 'poi-image';
        imgElement.alt = fileName;
        imgElement.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        imgElement.title = fileName;

        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'bin-filename';
        fileNameSpan.textContent = fileName;

        wrapper.appendChild(imgElement);
        wrapper.appendChild(fileNameSpan);
        
        // Drag handlers
        wrapper.addEventListener('dragstart', handleDragStart);
        wrapper.addEventListener('dragover', handleDragOver);
        wrapper.addEventListener('drop', handleDrop);
        wrapper.addEventListener('dragend', handleDragEnd);

        // Click handler for preview
        wrapper.addEventListener('click', function() {
            decompressAndDisplay(ip, fileName);
        });

        container.appendChild(wrapper);
    }
}

function getCharFromIndex(index) {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return characters.charAt(index);
}

function handleDragOver(e) {
  e.preventDefault();
  const dragging = document.querySelector('.dragging');
  if (!dragging) return;

  // Get the closest valid drop container
  const container = e.currentTarget.closest('.image-grid-container, #fileListContainer');
  if (!container || !container.appendChild) return;

  const afterElement = getDragAfterElement(container, e.clientY);
  
  if (container && dragging && container instanceof Node && dragging instanceof Node) {
    if (afterElement && afterElement.parentNode === container) {
      container.insertBefore(dragging, afterElement);
    } else if (dragging.parentNode !== container) {
      container.appendChild(dragging);
    }
  }
}

async function decompressAndDisplay(ip, fileName) {
    try {
        // Update validation to match filename rules exactly
        if (!/^[a-zA-Z0-9-_.]{1,50}\.bin$/i.test(fileName)) {
            console.error(`Invalid filename format: ${fileName}`);
            createMessage('Invalid image filename format', 'error');
            return;
        }
        
        const response = await fetch(`http://${ip}/edit?file=${encodeURIComponent(fileName)}`);
        const arrayBuffer = await response.arrayBuffer();
        const binaryData = new Uint8Array(arrayBuffer);
        const imageUrl = await decompress(binaryData);
        const rotatedImageUrl = await rotateImage90(imageUrl);

        // Create new image element
        const imgElement = document.createElement('img');
        imgElement.className = 'poi-image';
        imgElement.src = rotatedImageUrl;
        imgElement.alt = fileName;

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
        // Get the closest image-wrapper ancestor of the drop target
        const dropTarget = event.target.closest('.image-wrapper');
        let targetFileName = dropTarget?.dataset?.fileName;

        // Only use tile filename if dropping on a valid tile
        if (dropTarget && targetFileName) {
            handleImageUpload(files[0], ip, targetFileName);
        }
        // Optional: Add else case here if you want different behavior for grid drops
    }
}

function generateNewFilename(containerId) {
    // This function is only used for initial grid creation now
    const container = document.getElementById(containerId);
    const existingFiles = new Set(
        Array.from(container.querySelectorAll('.image-wrapper'))
            .map(el => el.dataset.fileName)
            .filter(Boolean)
    );
    
    // Only create numbered names if the title starts with a number
    const numbers = Array.from({length: 100}, (_, i) => i);
    for (const num of numbers) {
        const testName = `${num}.bin`;
        if (!existingFiles.has(testName)) {
            return testName;
        }
    }
    return `${Date.now()}.bin`; // fallback with timestamp
}

function sanitizeFileName(name) {
    // Only sanitize - keep original numbers and names
    const base = name.replace(/\.bin$/i, '')
                     .replace(/[^a-zA-Z0-9-_.]/g, '') // Allow periods
                     .substring(0, 50);
    return `${base}.bin`;
}

function validateFileName(name) {
    return /^[a-zA-Z0-9-_.]{1,50}\.bin$/i.test(name) ? name : null;
}

const MAX_RETRY_COUNT = 3;
const UPLOAD_BIN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
let retryCount = 0;

function generateUploadBinFilename(index) {
    const char = UPLOAD_BIN_CHARS.charAt(index);
    return `${char}.bin`;
}

// Upload Bin Handlers
async function verifyPoiConnection(ip) {
  for(let attempt = 1; attempt <= state.upload.config.POI_CHECK_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `http://${ip}/get-pixels`,
        state.upload.config.POI_CHECK_TIMEOUT
      );
      
      if(response.ok) {
        return true;
      }
    } catch(error) {
      if(attempt === state.upload.config.POI_CHECK_RETRIES) {
        return false;
      }
      await delay(state.upload.config.RETRY_BACKOFF[attempt-1]);
    }
  }
  return false;
}

async function restoreOriginalPatterns(mainAvailable = true, auxAvailable = true) {
  const restoreTasks = [];
  if(mainAvailable) restoreTasks.push(setPatternSafe(originalPattern, state.poiIPs.mainIP));
  if(auxAvailable) restoreTasks.push(setPatternSafe(originalPattern, state.poiIPs.auxIP));
  
  await Promise.allSettled(restoreTasks);
  await delay(1000); // Final safety delay
}

let originalPattern; // Will store the original pattern during upload

async function fetchOriginalPattern() {
  try {
    const response = await fetch(`http://${state.poiIPs.mainIP}/returnsettings`);
    if (response.ok) {
      const data = await response.text();
      const parts = data.split(',');
      originalPattern = parts[parts.length - 1].trim();
    }
  } catch (error) {
    originalPattern = 1;
  }
}

async function setPatternSafe(pattern, ip) {
  await fetchWithTimeout(`http://${ip}/pattern?patternChooserChange=${pattern}`, 5000);
  await delay(500); // Allow flash write cycle
}

async function fetchWithTimeout(resource, timeout=5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, { signal: controller.signal });
  clearTimeout(id);
  return response;
}

// Upload Bin Handlers
async function handleUpload() {
    if (!state.upload.orderedFiles.length) {
        createMessage('Please select at least one file', 'warning');
        return;
    }

    try {
        createMessage('Starting upload process...', 'info');
        
        // Verify POI connections
        const [mainAvailable, auxAvailable] = await Promise.all([
            verifyPoiConnection(state.poiIPs.mainIP),
            verifyPoiConnection(state.poiIPs.auxIP)
        ]);

        if (!mainAvailable && !auxAvailable) {
            throw new Error("Both POIs are unavailable - upload cannot proceed");
        }

        // Store original patterns
        await fetchOriginalPattern();

        // Set upload patterns
        const patternTasks = [];
        if (mainAvailable) patternTasks.push(setPatternSafe(7, state.poiIPs.mainIP));
        if (auxAvailable) patternTasks.push(setPatternSafe(7, state.poiIPs.auxIP));
        await Promise.all(patternTasks);
        await delay(state.upload.config.INTER_POI_DELAY);

        // Process files with new naming convention
        const uploadTasks = [];
        const filesToUpload = state.upload.orderedFiles.map((file, index) => ({
            file,
            targetName: generateUploadBinFilename(index)
        }));

        if (mainAvailable) {
            uploadTasks.push(
                processPoiWithBackoff(filesToUpload, state.poiIPs.mainIP, "Main POI")
                    .then(() => createMessage("Main POI upload complete"))
            );
        }
        if (auxAvailable) {
            uploadTasks.push(
                processPoiWithBackoff(filesToUpload, state.poiIPs.auxIP, "Aux POI")
                    .then(() => createMessage("Aux POI upload complete"))
            );
        }

        await Promise.all(uploadTasks);
        
        // Restore original patterns
        await restoreOriginalPatterns(mainAvailable, auxAvailable);
        
        createMessage(`Upload completed to ${mainAvailable ? 'Main POI' : ''}${auxAvailable ? ' and Aux POI' : ''}`);

    } catch (error) {
        handleCriticalError(error);
    } finally {
        state.upload.orderedFiles = [];
        document.getElementById('fileListContainer').innerHTML = '';
        document.getElementById('uploadFileInput').value = '';
    }
}

function logBatchCompletion(batchNumber, totalBatches, label) {
  const progress = `${batchNumber}/${totalBatches} batches`;
  createMessage(`${label}: Completed ${progress} (${batchNumber * state.upload.config.BATCH_SIZE} files)`);
}

async function processPoiWithBackoff(filesToUpload, ip, label) {
    const batchCount = Math.ceil(filesToUpload.length / state.upload.config.BATCH_SIZE);
    
    for(let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
        const batchStart = batchIndex * state.upload.config.BATCH_SIZE;
        const batchFiles = filesToUpload.slice(batchStart, batchStart + state.upload.config.BATCH_SIZE);
        
        await processBatch(batchFiles, ip, label, batchIndex+1, batchCount);
        
        if(batchIndex < batchCount - 1) {
            await delay(state.upload.config.INTER_BATCH_DELAY);
        }
    }
}

async function processBatch(batchFiles, ip, label, batchNumber, totalBatches) {
    const batchPromises = batchFiles.map(async (fileData, fileIndex) => {
        await processFileWithRetry(fileData, ip);
        await delay(state.upload.config.INTER_FILE_DELAY);
    });
    
    await Promise.allSettled(batchPromises);
    logBatchCompletion(batchNumber, totalBatches, label);
}

async function processSingleFile(fileData, ip) {
    try {
        const binaryData = await processImageFile(fileData.file);
        
        const formData = new FormData();
        const blob = new Blob([binaryData], { 
            type: 'application/octet-stream' 
        });
        
        formData.append('file', blob, fileData.targetName);

        const response = await fetch(`http://${ip}/edit`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
    } catch (error) {
        console.error('File processing failed:', error);
        throw error;
    }
}

async function processFileWithRetry(fileData, ip, label) {
    for(let attempt = 1; attempt <= state.upload.config.MAX_RETRIES; attempt++) {
        try {
            await processSingleFile(fileData, ip);
            return; // Success - exit retry loop
        } catch(error) {
            if (attempt === state.upload.config.MAX_RETRIES) {
                throw new Error(`Failed after ${attempt} attempts: ${error.message}`);
            }
            await delay(state.upload.config.RETRY_BACKOFF[attempt-1]);
        }
    }
}

// State Management
function checkInitialStatus() {
    updateStatusIndicators();
    if (!state.poiIPs.mainIP || !state.poiIPs.auxIP) {
        createMessage('Please configure POI IP addresses first', 'warning');
    }
}

function checkStatus(ip) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // Shorter timeout
    
    return fetch(`http://${ip}/get-pixels`, {
        signal: controller.signal,
        mode: 'cors',
        redirect: 'error'
    })
    .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) return 'offline';
        return response.text().then(text => {
            // Verify we actually got pixel data
            const pixels = parseInt(text, 10);
            return !isNaN(pixels) && pixels > 0 ? 'online' : 'offline';
        });
    })
    .catch(error => {
        clearTimeout(timeoutId);
        return 'offline';
    });
}

function updateStatusIndicators() {
    // Set initial state to offline
    const mainElement = document.getElementById('mainStatus');
    const auxElement = document.getElementById('auxStatus');
    
    mainElement.className = 'status-indicator offline';
    mainElement.textContent = 'Main POI: Checking...';
    auxElement.className = 'status-indicator offline';
    auxElement.textContent = 'Aux POI: Checking...';

    Promise.allSettled([
        checkStatus(state.poiIPs.mainIP),
        checkStatus(state.poiIPs.auxIP)
    ]).then(([mainResult, auxResult]) => {
        const mainStatus = mainResult.status === 'fulfilled' ? mainResult.value : 'offline';
        const auxStatus = auxResult.status === 'fulfilled' ? auxResult.value : 'offline';

        mainElement.className = `status-indicator ${mainStatus}`;
        mainElement.textContent = `Main POI: ${mainStatus === 'online' ? 'Online' : 'Offline'}`;
        
        auxElement.className = `status-indicator ${auxStatus}`;
        auxElement.textContent = `Aux POI: ${auxStatus === 'online' ? 'Online' : 'Offline'}`;
    });
}

const state = {
    wsStrip: true,
    upload: {
        orderedFiles: [],
        config: {
            BATCH_SIZE: 2,
            INTER_FILE_DELAY: 750,
            INTER_BATCH_DELAY: 1500,
            INTER_POI_DELAY: 3000,
            MAX_RETRIES: 3,
            RETRY_BACKOFF: [500, 1500, 3000],
            POI_CHECK_RETRIES: 2,
            POI_CHECK_TIMEOUT: 3000
        }
    },
    poiIPs: {
        mainIP: "192.168.1.1", 
        auxIP: "192.168.1.78",
        routerMode: false,
        subnet: "",
        savedRouterIPs: {
            main: "",
            aux: ""
        }
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
    initializeUploadHandlers();
    setupTabNavigation();
    initializeNetworkDiscovery();
    setupImageHandlers();
    initializeModal();
    initializeEventListeners();
    initializeSliders();
    checkInitialStatus();
    fetchInitialPixels();
    refreshAllImages();
    
    // Add periodic status checks
    setInterval(updateStatusIndicators, 10000); // Check every 10 seconds
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateStatusIndicators();
    });
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
    const saved = JSON.parse(localStorage.getItem('poiState') || {});
    
    // Load router mode state
    state.poiIPs.routerMode = saved.poiIPs?.routerMode || false;
    state.poiIPs.savedRouterIPs = saved.poiIPs?.savedRouterIPs || {
        main: "192.168.1.1",
        aux: "192.168.1.78"
    };

    // Set IPs based on current mode
    if (state.poiIPs.routerMode) {
        state.poiIPs.mainIP = saved.poiIPs?.mainIP || "192.168.1.1";
        state.poiIPs.auxIP = saved.poiIPs?.auxIP || "192.168.1.78";
    } else {
        state.poiIPs.mainIP = "192.168.1.1";
        state.poiIPs.auxIP = "192.168.1.78";
    }

    // Initialize manual IP inputs with current values
    const mainIpInput = document.getElementById('manualMainIp');
    const auxIpInput = document.getElementById('manualAuxIp');
    
    mainIpInput.value = state.poiIPs.mainIP;
    mainIpInput.placeholder = state.poiIPs.mainIP;
    auxIpInput.value = state.poiIPs.auxIP;
    auxIpInput.placeholder = state.poiIPs.auxIP;

    // Update UI elements
    document.getElementById('routerModeCheckbox').checked = state.poiIPs.routerMode;
    updateNetworkModeDisplay();
    state.wsStrip = saved.wsStrip !== undefined ? saved.wsStrip : true;
    state.poiIPs = { ...state.poiIPs, ...saved.poiIPs };
    state.settings = { ...state.settings, ...saved.settings };
    
    // Load credentials from saved state
    document.getElementById('routerInput').value = saved.settings?.router || '';
    document.getElementById('passwordInput').value = saved.settings?.password || '';
    
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
    
    // Update manual IP inputs
    mainIpInput.placeholder = state.poiIPs.mainIP || '192.168.1.x';
    auxIpInput.placeholder = state.poiIPs.auxIP || '192.168.1.x';
    
    // Update both pixel inputs and displays
    document.getElementById('pixelInput').value = state.settings.pixels;
    document.getElementById('uploadPixelInput').value = state.settings.pixels;
    document.getElementById('currentPx').textContent = `Current px: ${state.settings.pixels}`;
    document.getElementById('uploadCurrentPx').textContent = `Current px: ${state.settings.pixels}`;
}

// Network Discovery Implementation
function showLoadingState(show) {
  document.getElementById('spinner').style.display = show ? 'block' : 'none';
  document.getElementById('counter').style.display = show ? 'block' : 'none';
  if (!show) document.getElementById('currentIP').textContent = '0'; // Reset counter when done
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
    
    // Add slight delay to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 50));
    
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
    const currentIPElement = document.getElementById('currentIP');
    
    for (const ip of scanOrder) {
        // Update UI with current IP being scanned
        currentIPElement.textContent = ip.split('.').pop(); // Show last octet
        
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
        poiIPs: {
            mainIP: state.poiIPs.mainIP,
            auxIP: state.poiIPs.auxIP,
            routerMode: state.poiIPs.routerMode,
            savedRouterIPs: state.poiIPs.savedRouterIPs,
            subnet: state.poiIPs.subnet
        },
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
  // Remove existing drag handlers first
  document.querySelectorAll('.image-grid-container').forEach(grid => {
    grid.removeEventListener('dragover', handleDragOver);
    grid.removeEventListener('drop', handleImageDrop);
  });

  // Initialize image grids with current IPs
  createBlackImages('mainImageGrid', state.poiIPs.mainIP);
  createBlackImages('auxImageGrid', state.poiIPs.auxIP);

  // Add new drag handlers to containers
  document.querySelectorAll('.image-grid-container').forEach(grid => {
    grid.addEventListener('dragover', handleDragOver);
    grid.addEventListener('drop', (event) => {
      // Use our primary handler that checks for valid tiles
      handleImageDrop(event, grid.id === 'mainImageGrid' 
        ? state.poiIPs.mainIP 
        : state.poiIPs.auxIP
      );
    });
  });
  
  // Button handlers
  document.getElementById('refreshImages').addEventListener('click', refreshAllImages);
  document.getElementById('updatePixels').addEventListener('click', updatePixelsOnBoth);
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
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createFileListItem(file, index) {
    const div = document.createElement('div');
    div.className = 'draggable-file';
    div.draggable = true;
    div.dataset.index = index;
    div.dataset.fileName = file.name;

    // Preview image
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    
    // Filename
    const span = document.createElement('span');
    span.textContent = file.name;
    
    // Drag handle
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '☰';
    
    div.appendChild(img);
    div.appendChild(span);
    div.appendChild(handle);
    
    // Drag & drop handlers
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('drop', handleDrop);
    div.addEventListener('dragend', handleDragEnd);
    
    return div;
}

function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.index);
  e.target.classList.add('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
  const dragging = document.querySelector('.dragging');
  const container = document.getElementById('fileListContainer');
  const afterElement = getDragAfterElement(container, e.clientY);
  
  if (afterElement) {
    container.insertBefore(dragging, afterElement);
  } else {
    // container.appendChild(dragging);
  }
}

function handleDrop(e) {
  e.preventDefault();
  updateFilesOrder();
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
}

function updateFilesOrder() {
  const container = document.getElementById('fileListContainer');
  const currentOrderNames = Array.from(container.children).map(item => item.dataset.fileName);
  state.upload.orderedFiles = currentOrderNames.map(name => 
    state.upload.orderedFiles.find(file => file.name === name)
  ).filter(file => file !== undefined);
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.draggable-file:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleFileInput(e) {
  const container = document.getElementById('fileListContainer');
  container.innerHTML = '';
  state.upload.orderedFiles = Array.from(e.target.files);
  
  state.upload.orderedFiles.forEach((file, index) => {
    const listItem = createFileListItem(file, index);
    container.appendChild(listItem);
  });
}

function initializeDragAndDrop() {
  const container = document.getElementById('fileListContainer');
  
  container.addEventListener('dragover', e => {
    e.preventDefault();
    const dragging = document.querySelector('.dragging');
    const afterElement = getDragAfterElement(container, e.clientY);
    
    if(afterElement) {
      container.insertBefore(dragging, afterElement);
    } else {
      container.appendChild(dragging);
    }
  });

  container.addEventListener('drop', e => {
    e.preventDefault();
    updateFilesOrder();
  });
}

function createMessage(message, type = 'info') {
    const modal = document.getElementById('messageModal');
    modal.textContent = message;
    modal.className = `message-modal ${type}`;
    
    // Add active class with slight delay for transition
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Remove after 2 seconds
    setTimeout(() => {
        modal.classList.remove('active');
    }, 2000);
}

function handleCriticalError(error) {
    console.error('Critical Error:', error);
    createMessage(`Upload failed: ${error.message}`, 'error');
    // Attempt to restore original patterns even on failure
    restoreOriginalPatterns().catch(err => {
        console.error('Failed to restore patterns:', err);
    });
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

function initializeUploadHandlers() {
    // Initialize upload tab inputs with current state
    document.getElementById('uploadPixelInput').value = state.settings.pixels;
    document.getElementById('uploadCurrentPx').textContent = `Current px: ${state.settings.pixels}`;

    // File input handler
    document.getElementById('uploadFileInput').addEventListener('change', function(e) {
        const container = document.getElementById('fileListContainer');
        container.innerHTML = '';
        state.upload.orderedFiles = Array.from(e.target.files);
        state.upload.orderedFiles.forEach((file, index) => {
            container.appendChild(createFileListItem(file, index));
        });
    });

    // Upload button handler - updated to use correct ID
    document.getElementById('uploadBinButton').addEventListener('click', handleUpload);

    // WS/APA toggle handler
    document.getElementById('uploadWsApaBtn').addEventListener('click', function() {
        state.wsStrip = !state.wsStrip;
        const indicator = document.getElementById('uploadWsApaIndicator');
        indicator.textContent = `Current: ${state.wsStrip ? 'WS2812' : 'APA102'}`;
        createMessage(`Switched to ${state.wsStrip ? 'WS2812 (compressed)' : 'APA102 (raw)'} mode`);
        saveState();
    });

    // Pixel update handler
    document.getElementById('uploadUpdatePixelButton').addEventListener('click', function() {
        const pixelInput = document.getElementById('uploadPixelInput').value;
        state.settings.pixels = parseInt(pixelInput, 10);
        updatePixelSize(); // Use the unified update function
        saveState();
    });
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
        // Preserve existing credentials if available
        const currentRouter = document.getElementById('routerInput').value || state.settings.router;
        const currentPassword = document.getElementById('passwordInput').value || state.settings.password;

        const response = await fetch(`http://${ip}/returnsettings`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.text();
        const parts = data.split(',').map(p => p.trim());
        
        // Get fresh pixel count from dedicated endpoint
        const pixels = await fetchNumberOfPixels(ip);
        
        return {
            router: parts[0] || currentRouter,
            password: parts[1] || currentPassword,
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
            // Preserve existing input values
            const currentRouter = document.getElementById('routerInput').value;
            const currentPassword = document.getElementById('passwordInput').value;

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

            // Restore inputs if they were cleared
            document.getElementById('routerInput').value = currentRouter || mainData.router;
            document.getElementById('passwordInput').value = currentPassword || mainData.password;

            // Update state with preserved values
            state.settings.router = document.getElementById('routerInput').value;
            state.settings.password = document.getElementById('passwordInput').value;
            saveState();

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

async function deleteAllImages() {
    if (!confirm('WARNING: This will delete ALL images from both POIs!')) return;
    
    try {
        // Generate all possible image filenames
        const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const filenames = Array.from(characters).map(c => `${c}.bin`);

        // Delete from both POIs
        await Promise.all([
            deleteFromPoi(state.poiIPs.mainIP, filenames),
            deleteFromPoi(state.poiIPs.auxIP, filenames)
        ]);
        
        createMessage('All images deleted from both POIs');
        refreshAllImages(true);
    } catch (error) {
        console.error('Delete all failed:', error);
        createMessage('Failed to delete all images', 'error');
    }
}

async function deleteFromPoi(ip, filenames) {
    return Promise.all(filenames.map(fileName => 
        fetch(`http://${ip}/edit?path=/${fileName}`, {
            method: 'DELETE'
        })
    ));
}

// File List Functions
async function getFileList() {
    try {
        const response = await fetch(`http://${state.poiIPs.mainIP}/list?dir=/`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.text();
        document.getElementById('fileListTextArea').value = data;
        createMessage('Main POI files fetched successfully');
    } catch (error) {
        console.error('Error fetching main files:', error);
        createMessage('Failed to fetch main files', 'error');
    }
}

async function getFileListTwo() {
    try {
        const response = await fetch(`http://${state.poiIPs.auxIP}/list?dir=/`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.text();
        document.getElementById('fileListTextAreatwo').value = data;
        createMessage('Aux POI files fetched successfully');
    } catch (error) {
        console.error('Error fetching aux files:', error);
        createMessage('Failed to fetch aux files', 'error');
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
    
    // Initialize upload tab
    document.getElementById('uploadFileInput').addEventListener('change', handleFileInput);
    document.getElementById('uploadBinButton').addEventListener('click', handleUpload);
    initializeDragAndDrop();
    
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
    } else if (tabName === 'files') {
        // Initialize any list-specific functionality
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
async function submitRouterMode() {
    const routerMode = document.getElementById('routerModeCheckbox').checked;
    
    try {
        // Update both POIs first
        await Promise.all([
            fetch(`http://${state.poiIPs.mainIP}/router?router=${routerMode ? 1 : 0}`),
            fetch(`http://${state.poiIPs.auxIP}/router?router=${routerMode ? 1 : 0}`)
        ]);

        // Update local state
        state.poiIPs.routerMode = routerMode;
        
        const mainIpInput = document.getElementById('manualMainIp');
        const auxIpInput = document.getElementById('manualAuxIp');
        
        if (routerMode) {
            // Restore saved router mode IPs
            state.poiIPs.mainIP = state.poiIPs.savedRouterIPs.main || "192.168.1.1";
            state.poiIPs.auxIP = state.poiIPs.savedRouterIPs.aux || "192.168.1.78";
            
            // Update inputs with saved values
            mainIpInput.value = state.poiIPs.mainIP;
            auxIpInput.value = state.poiIPs.auxIP;
        } else {
            // Save current IPs before switching to AP mode
            state.poiIPs.savedRouterIPs = {
                main: state.poiIPs.mainIP,
                aux: state.poiIPs.auxIP
            };
            // Set hardcoded AP mode IPs
            state.poiIPs.mainIP = "192.168.1.1";
            state.poiIPs.auxIP = "192.168.1.78";
            
            // Clear and reset input fields to defaults
            mainIpInput.value = "192.168.1.1";
            auxIpInput.value = "192.168.1.78";
        }

        saveState();
        updateNetworkModeDisplay();
        createMessage(`Switched to ${routerMode ? 'Router' : 'AP'} mode`);
        updateStatusIndicators();
    } catch (error) {
        console.error('Error updating router mode:', error);
        createMessage('Mode change failed - check POI connections', 'error');
    }
}

function updateNetworkModeDisplay() {
    const modeIndicator = document.getElementById('networkModeIndicator');
    const ipInputs = document.querySelectorAll('.manual-ip-row input');
    
    if (state.poiIPs.routerMode) {
        modeIndicator.textContent = "Router Mode";
        modeIndicator.className = "status-indicator online";
        ipInputs.forEach(input => input.disabled = false);
    } else {
        modeIndicator.textContent = "AP Mode";
        modeIndicator.className = "status-indicator offline";
        ipInputs.forEach(input => {
            input.disabled = true;
            // Force display of default values
            input.value = input.placeholder;
        });
    }
}

function submitChannel() {
    const channelInput = document.getElementById('channelInput');
    const channelValue = parseInt(channelInput.value);

    if (isNaN(channelValue) || channelValue < 1 || channelValue > 13) {
        alert("Invalid channel! WiFi channels must be between 1-13");
        channelInput.value = ""; // Clear invalid input
        return;
    }

    // Handle each request independently
    sendRequest(`http://${state.poiIPs.mainIP}/setting?channel=${channelValue}`)
        .catch(error => console.error('Main Poi channel update failed:', error));
    sendRequest(`http://${state.poiIPs.auxIP}/setting?channel=${channelValue}`)
        .catch(error => console.error('Aux Poi channel update failed:', error));

    setTimeout(() => {
        document.getElementById('fetchBtn').click();
        channelInput.value = "";
    }, 2000);
}

function submitRouter() {
    const routerInput = document.getElementById('routerInput').value;
    const passwordInput = document.getElementById('passwordInput').value;

    // Save to state immediately
    state.settings.router = routerInput;
    state.settings.password = passwordInput;
    saveState();

    // Handle each request independently
    sendRequest(`http://${state.poiIPs.mainIP}/setting?ssid=${routerInput}&pwd=${passwordInput}`)
        .catch(error => console.error('Main Poi router update failed:', error));

    sendRequest(`http://${state.poiIPs.auxIP}/setting?ssid=${routerInput}&pwd=${passwordInput}`)
        .catch(error => console.error('Aux Poi router update failed:', error));

    setTimeout(() => {
        document.getElementById('fetchBtn').click();
        // Preserve the input values after update
        document.getElementById('routerInput').value = routerInput;
        document.getElementById('passwordInput').value = passwordInput;
    }, 2500);
}

// Unified Event Listeners
function initializeEventListeners() {
    document.getElementById('deleteAllButton').addEventListener('click', deleteAllImages);
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

