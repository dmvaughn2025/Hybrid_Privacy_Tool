// Final popup.js - Shows/hides correct sections

console.log("🚀 Privacy Guard popup starting...");

let currentHostname = null;
let currentSessionId = null;

// DOM elements with correct IDs
const elements = {};

// Initialize popup
async function initializePopup() {
    console.log("🔍 Initializing popup...");
    
    try {
        // Get DOM elements with correct IDs from the HTML
        elements.loading = document.getElementById('loading');
        elements.content = document.getElementById('content');
        elements.currentSite = document.getElementById('current-site');
        elements.statusSummary = document.getElementById('status-summary');
        elements.trackerCount = document.getElementById('tracker-count');
        elements.fingerprintCount = document.getElementById('fingerprint-count');
        elements.storageCount = document.getElementById('storage-count');
        elements.piiCount = document.getElementById('pii-count');
        
        console.log("📋 Elements found:", {
            loading: !!elements.loading,
            content: !!elements.content,
            currentSite: !!elements.currentSite,
            statusSummary: !!elements.statusSummary,
            trackerCount: !!elements.trackerCount,
            fingerprintCount: !!elements.fingerprintCount,
            storageCount: !!elements.storageCount,
            piiCount: !!elements.piiCount
        });
        
        // Get current tab
        console.log("🌐 Getting current tab...");
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        
        if (!tab || !tab.url || !tab.url.startsWith('http')) {
            showError('Not available for this page');
            return;
        }
        
        const url = new URL(tab.url);
        const rawHostname = url.hostname;
        currentHostname = normalizeHostname(rawHostname);
        
        console.log("🌐 Raw hostname:", rawHostname);
        console.log("🌐 Normalized hostname:", currentHostname);
        
        if (elements.currentSite) {
            elements.currentSite.textContent = currentHostname;
        }
        
        // Get session ID
        console.log("🔑 Getting session ID...");
        try {
            const sessionResponse = await browser.runtime.sendMessage({
                type: "GET_SESSION_ID",
                hostname: currentHostname
            });
            
            if (sessionResponse && sessionResponse.sessionId) {
                currentSessionId = sessionResponse.sessionId;
                console.log("🔑 Session ID:", currentSessionId);
            }
        } catch (e) {
            console.log("⚠️ Session ID request failed:", e);
        }
        
        // Load privacy data
        console.log("📡 Loading privacy data...");
        await loadPrivacyData();
        
    } catch (error) {
        console.error("❌ Failed to initialize:", error);
        showError('Failed to initialize privacy data');
    }
}

// Normalize hostname
function normalizeHostname(hostname) {
    return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
}

// Load privacy data via background script
async function loadPrivacyData() {
    if (!currentHostname) {
        showError('No hostname available');
        return;
    }
    
    try {
        console.log("📡 Requesting privacy data for:", currentHostname);
        
        // Request data from background script
        const response = await browser.runtime.sendMessage({
            type: "GET_PRIVACY_DATA",
            hostname: currentHostname
        });
        
        console.log("📥 Received response:", response);
        
        if (response && response.success) {
            console.log("✅ Data received successfully");
            updateUI(response.data);
        } else {
            console.error("❌ Background script error:", response ? response.error : 'No response');
            showError('Unable to load privacy data');
        }
        
    } catch (error) {
        console.error("❌ Failed to load privacy data:", error);
        showError('Communication error');
    }
}

// Update UI with privacy data
function updateUI(data) {
    console.log("🎨 Updating UI with:", data);
    
    // IMPORTANT: Hide loading section and show content section
    if (elements.loading) {
        elements.loading.style.display = 'none';
        console.log("👁️ Hidden loading section");
    }
    if (elements.content) {
        elements.content.style.display = 'block';
        console.log("👁️ Shown content section");
    }
    
    // Update counts
    if (elements.trackerCount) {
        elements.trackerCount.textContent = data.tracker || 0;
        console.log("🔢 Updated tracker count:", data.tracker || 0);
    }
    if (elements.fingerprintCount) {
        elements.fingerprintCount.textContent = data.fingerprinting || 0;
        console.log("🔢 Updated fingerprint count:", data.fingerprinting || 0);
    }
    if (elements.storageCount) {
        elements.storageCount.textContent = data.storage || 0;
        console.log("🔢 Updated storage count:", data.storage || 0);
    }
    if (elements.piiCount) {
        elements.piiCount.textContent = data.pii || 0;
        console.log("🔢 Updated PII count:", data.pii || 0);
    }
    
    // Update summary
    const summary = data.summary || generateSummary(data);
    if (elements.statusSummary) {
        elements.statusSummary.textContent = summary;
        console.log("📝 Updated summary:", summary);
    }
    
    console.log("✅ UI updated successfully");
}

// Generate summary
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
function showError(message) {
    console.error("❌ Error:", message);
    
    // Hide loading, show content with error
    if (elements.loading) {
        elements.loading.style.display = 'none';
    }
    if (elements.content) {
        elements.content.style.display = 'block';
    }
    if (elements.statusSummary) {
        elements.statusSummary.textContent = message;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePopup);
} else {
    initializePopup();
}

console.log("📄 Final popup script loaded");
