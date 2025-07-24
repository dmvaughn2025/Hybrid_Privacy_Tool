// popup.js - CORS-Fixed Privacy Guard Extension Popup

let currentHostname = null;
let currentSessionId = null;

// DOM elements
const elements = {
    currentSite: document.getElementById('current-site'),
    summary: document.getElementById('summary'),
    trackerCount: document.getElementById('tracker-count'),
    fingerprintCount: document.getElementById('fingerprint-count'),
    storageCount: document.getElementById('storage-count'),
    piiCount: document.getElementById('pii-count')
};

// Get current tab hostname
async function getCurrentTab() {
    return new Promise((resolve) => {
        browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                resolve(tabs[0]);
            } else {
                resolve(null);
            }
        });
    });
}

// Normalize hostname (remove www. prefix)
function normalizeHostname(hostname) {
    if (hostname.startsWith('www.')) {
        return hostname.substring(4);
    }
    return hostname;
}

// Initialize popup with current tab data
async function initializePopup() {
    try {
        console.log('🔍 Initializing popup...');
        
        const tab = await getCurrentTab();
        if (!tab || !tab.url || !tab.url.startsWith('http')) {
            elements.currentSite.textContent = 'Not available for this page';
            elements.summary.textContent = 'Privacy monitoring not available for this page type.';
            return;
        }

        const url = new URL(tab.url);
        const rawHostname = url.hostname;
        currentHostname = normalizeHostname(rawHostname);
        
        elements.currentSite.textContent = currentHostname;
        
        console.log('🌐 Raw hostname:', rawHostname);
        console.log('🌐 Normalized hostname:', currentHostname);

        // Get session ID from background script
        try {
            const sessionResponse = await browser.runtime.sendMessage({
                type: "GET_SESSION_ID",
                hostname: currentHostname
            });
            
            if (sessionResponse && sessionResponse.sessionId) {
                currentSessionId = sessionResponse.sessionId;
                console.log('🔑 Session ID:', currentSessionId);
            }
        } catch (e) {
            console.log('⚠️ Session ID request failed:', e);
        }

        await loadPrivacyData();
        
    } catch (error) {
        console.error('❌ Failed to initialize popup:', error);
        showError('Failed to initialize privacy data');
    }
}

// Load privacy data via background script (avoiding CORS)
async function loadPrivacyData() {
    if (!currentHostname) return;

    try {
        console.log('📡 Requesting privacy data for hostname:', currentHostname);
        
        // Request data from background script instead of direct API call
        const response = await browser.runtime.sendMessage({
            type: "GET_PRIVACY_DATA",
            hostname: currentHostname
        });

        console.log('📥 Received response from background script:', response);

        if (response && response.success) {
            updateUI(response.data);
        } else if (response && response.error) {
            console.error('❌ Background script error:', response.error);
            showError('Unable to load privacy data: ' + response.error);
        } else {
            console.log('📭 No data available, showing default state');
            updateUI({
                tracker: 0, fingerprinting: 0, storage: 0, pii: 0,
                summary: 'No privacy issues detected'
            });
        }
        
    } catch (error) {
        console.error('❌ Failed to load privacy data:', error);
        showError('Unable to communicate with background script.');
    }
}

// Update UI with privacy data
function updateUI(data) {
    console.log('🎨 Updating UI with data:', data);
    
    // Update counts
    elements.trackerCount.textContent = data.tracker || 0;
    elements.fingerprintCount.textContent = data.fingerprinting || 0;
    elements.storageCount.textContent = data.storage || 0;
    elements.piiCount.textContent = data.pii || 0;

    // Update summary
    const summary = data.summary || generateSummary(data);
    elements.summary.textContent = summary;

    console.log('✅ UI updated successfully');
}

// Generate summary if not provided
function generateSummary(data) {
    const parts = [];
    
    if (data.tracker > 0) {
        parts.push(`${data.tracker} trackers detected`);
    }
    
    if (data.pii > 0) {
        const piiTypes = data.pii_types || [];
        if (piiTypes.length > 0) {
            parts.push(`PII extracted: ${piiTypes.slice(0, 3).join(', ')}`);
        } else {
            parts.push('PII extraction detected');
        }
    }
    
    if (data.fingerprinting > 0) {
        parts.push('fingerprinting detected');
    }
    
    if (data.storage > 0) {
        parts.push('local storage accessed');
    }
    
    if (parts.length === 0) {
        return 'No privacy issues detected';
    }
    
    return parts.join(', ').charAt(0).toUpperCase() + parts.join(', ').slice(1);
}

// Show error state
function showError(message = 'Unable to load privacy data') {
    elements.summary.textContent = message;
    console.error('❌ Error state:', message);
}

// Initialize popup when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Popup DOM loaded, initializing...');
    await initializePopup();
});

// Add refresh functionality (click summary to refresh)
elements.summary.addEventListener('click', async () => {
    console.log('🔄 Manual refresh triggered');
    elements.summary.textContent = 'Refreshing...';
    await loadPrivacyData();
});

// Listen for updates from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PRIVACY_DATA_UPDATE' && message.hostname === currentHostname) {
        console.log('🔔 Received real-time update:', message.data);
        updateUI(message.data);
    }
});
