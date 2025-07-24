// Enhanced background.js - CORS-Fixed with API proxy functionality

const sessionMap = {};
const tabDetectionCounts = {};
const tabUpdateTimers = {};
const API_BASE_URL = 'http://localhost:8081';

function generateSessionId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Normalize hostname function
function normalizeHostname(hostname) {
    return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
}

// Update badge with threat count
function updateBadge(tabId, count) {
    const text = count > 0 ? count.toString() : '';
    const color = count > 10 ? '#d32f2f' : count > 0 ? '#ff9800' : '#4caf50';
    
    browser.browserAction.setBadgeText({
        text: text,
        tabId: tabId
    });
    
    browser.browserAction.setBadgeBackgroundColor({
        color: color,
        tabId: tabId
    });

    // Update title to show current count
    const title = count > 0 ? 
        `Privacy Guard - ${count} threats detected` : 
        'Privacy Guard - No threats detected';
    
    browser.browserAction.setTitle({
        title: title,
        tabId: tabId
    });
}

// Fetch privacy data from API (used by popup and badge updates)
async function fetchPrivacyData(hostname) {
    try {
        const normalizedHostname = normalizeHostname(hostname);
        console.log(`🌐 [Background] Fetching data for: ${normalizedHostname}`);
        
        const response = await fetch(`${API_BASE_URL}/current/${normalizedHostname}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`📊 [Background] API response for ${normalizedHostname}:`, data);
            return { success: true, data: data };
        } else {
            console.error(`❌ [Background] API error ${response.status} for ${normalizedHostname}`);
            return { success: false, error: `API returned ${response.status}` };
        }
    } catch (error) {
        console.error('❌ [Background] Failed to fetch privacy data:', error);
        return { success: false, error: error.message };
    }
}

// Calculate total threat count from privacy data
function calculateThreatCount(data) {
    if (!data) return 0;
    return (data.tracker || 0) + (data.fingerprinting || 0) + 
           (data.storage || 0) + (data.pii || 0);
}

// Periodically update badge for active tab
async function updateTabBadge(tabId, hostname) {
    if (!hostname) return;
    
    try {
        const result = await fetchPrivacyData(hostname);
        if (result.success) {
            const threatCount = calculateThreatCount(result.data);
            updateBadge(tabId, threatCount);
            
            // Store count for this tab
            tabDetectionCounts[tabId] = threatCount;
            
            // Show browser notification for significant threats
            if (threatCount >= 10 && threatCount % 10 === 0) {
                showThreatNotification(hostname, threatCount);
            }
            
            console.log(`🔢 [Background] Updated badge for tab ${tabId}: ${threatCount} threats`);
        } else {
            console.log(`⚠️ [Background] Could not update badge for ${hostname}: ${result.error}`);
        }
        
    } catch (error) {
        console.log('❌ [Background] Error updating tab badge:', error);
    }
}

// Show browser notification for high threat levels
function showThreatNotification(hostname, count) {
    try {
        browser.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-48.png',
            title: 'Privacy Guard Alert',
            message: `${count} privacy threats detected on ${hostname}. Click extension for details.`
        });
    } catch (error) {
        console.log('❌ [Background] Notification failed:', error);
    }
}

// Set up periodic updates for a tab
function setupTabMonitoring(tabId, hostname) {
    // Clear existing timer
    if (tabUpdateTimers[tabId]) {
        clearInterval(tabUpdateTimers[tabId]);
    }
    
    // Initial update
    updateTabBadge(tabId, hostname);
    
    // Set up periodic updates every 5 seconds
    tabUpdateTimers[tabId] = setInterval(() => {
        updateTabBadge(tabId, hostname);
    }, 5000);
    
    console.log(`👁️ [Background] Started monitoring tab ${tabId} for ${hostname}`);
}

// Tab update listener
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url && tab.url.startsWith("http")) {
        const url = new URL(tab.url);
        const hostname = url.hostname;
        const normalizedHostname = normalizeHostname(hostname);

        // Create session if not already present
        if (!sessionMap[normalizedHostname]) {
            sessionMap[normalizedHostname] = generateSessionId();
            console.log(`🆔 [Background] New session for ${normalizedHostname}: ${sessionMap[normalizedHostname]}`);
        }

        // Reset detection counts for this tab
        tabDetectionCounts[tabId] = 0;
        updateBadge(tabId, 0);

        // Start monitoring this tab
        setupTabMonitoring(tabId, hostname);
    }
});

// Clean up when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
    delete tabDetectionCounts[tabId];
    if (tabUpdateTimers[tabId]) {
        clearInterval(tabUpdateTimers[tabId]);
        delete tabUpdateTimers[tabId];
    }
    console.log(`🗑️ [Background] Cleaned up tab ${tabId}`);
});

// Clean up when tabs change
browser.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await browser.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.startsWith('http')) {
            const url = new URL(tab.url);
            setupTabMonitoring(activeInfo.tabId, url.hostname);
        }
    } catch (error) {
        console.log('❌ [Background] Error on tab activation:', error);
    }
});

// Block known tracking domains
browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        const url = new URL(details.url);
        const hostname = url.hostname.toLowerCase();
        
        // Load tracking domains from rules (simplified list)
        const knownTrackers = [
            'doubleclick.net', 'google-analytics.com', 'googletagmanager.com',
            'facebook.net', 'scorecardresearch.com', 'quantserve.com',
            'moatads.com', 'outbrain.com', 'taboola.com', 'criteo.com',
            'adsystem.com', 'amazon-adsystem.com', 'bing.com'
        ];
        
        const isTracker = knownTrackers.some(tracker => 
            hostname === tracker || hostname.endsWith('.' + tracker)
        );
        
        if (isTracker) {
            console.log(`🚫 [Background] Blocked tracking request: ${hostname}`);
            
            // Trigger immediate badge update for this tab
            if (details.tabId && details.tabId !== -1) {
                browser.tabs.get(details.tabId).then(tab => {
                    if (tab.url && tab.url.startsWith('http')) {
                        const tabUrl = new URL(tab.url);
                        updateTabBadge(details.tabId, tabUrl.hostname);
                    }
                }).catch(e => console.log('❌ [Background] Error getting tab:', e));
            }
            
            return { cancel: true };
        }
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);

// Inject session ID into headers
browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        if (!details.url.startsWith('http')) return;
        
        const url = new URL(details.url);
        const normalizedHostname = normalizeHostname(url.hostname);
        const sessionId = sessionMap[normalizedHostname];

        if (!sessionId) return;

        const requestHeaders = details.requestHeaders || [];
        requestHeaders.push({
            name: "X-PrivacyProxy-Session",
            value: sessionId,
        });

        return { requestHeaders };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
);

// Enhanced message handling with API proxy functionality
browser.runtime.onMessage.addListener(async (message, sender) => {
    const tabId = sender.tab ? sender.tab.id : null;
    
    console.log(`📨 [Background] Received message:`, message);
    
    switch (message.type) {
        case "GET_SESSION_ID":
            const normalizedHostname = normalizeHostname(message.hostname);
            const sessionId = sessionMap[normalizedHostname] || null;
            console.log(`🔑 [Background] Session ID for ${message.hostname}: ${sessionId}`);
            return Promise.resolve({ sessionId });
            
        case "GET_PRIVACY_DATA":
            // This is the new API proxy functionality for the popup
            console.log(`📡 [Background] API proxy request for ${message.hostname}`);
            try {
                const result = await fetchPrivacyData(message.hostname);
                console.log(`📤 [Background] Sending privacy data to popup:`, result);
                return Promise.resolve(result);
            } catch (error) {
                console.error(`❌ [Background] API proxy error:`, error);
                return Promise.resolve({ 
                    success: false, 
                    error: `Background script error: ${error.message}` 
                });
            }
            
        case "UPDATE_BADGE":
            if (tabId && message.count !== undefined) {
                updateBadge(tabId, message.count);
            }
            return Promise.resolve({ success: true });
            
        case "GET_TAB_STATS":
            if (tabId && tabDetectionCounts[tabId] !== undefined) {
                return Promise.resolve({ 
                    count: tabDetectionCounts[tabId],
                    session_id: await getCurrentSessionId(tabId)
                });
            }
            return Promise.resolve({ count: 0, session_id: null });
            
        default:
            console.log(`⚠️ [Background] Unknown message type: ${message.type}`);
            return Promise.resolve({ error: "Unknown message type" });
    }
});

// Helper function to get current session ID for a tab
async function getCurrentSessionId(tabId) {
    try {
        const tab = await browser.tabs.get(tabId);
        if (tab && tab.url) {
            const url = new URL(tab.url);
            const normalizedHostname = normalizeHostname(url.hostname);
            return sessionMap[normalizedHostname] || null;
        }
    } catch (error) {
        console.log('❌ [Background] Error getting session ID:', error);
    }
    return null;
}

// Context menu for clearing data
browser.contextMenus.create({
    id: "privacy-tool-clear-session",
    title: "Clear Privacy Session Data",
    contexts: ["page"]
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "privacy-tool-clear-session" && tab) {
        const url = new URL(tab.url);
        const normalizedHostname = normalizeHostname(url.hostname);
        
        delete sessionMap[normalizedHostname];
        if (tab.id !== undefined) {
            tabDetectionCounts[tab.id] = 0;
            updateBadge(tab.id, 0);
        }
        
        console.log(`🗑️ [Background] Cleared session data for ${normalizedHostname}`);
    }
});

// Initialize badge for existing tabs
browser.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
        if (tab.id !== undefined && tab.url && tab.url.startsWith('http')) {
            const url = new URL(tab.url);
            setupTabMonitoring(tab.id, url.hostname);
        }
    });
});

console.log("🚀 [Background] Privacy Tool background script with API proxy initialized");
