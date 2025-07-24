// Fixed Storage + Session Integration - Working Prototype Method
console.log("🦊🔗 Fixed Session-Integrated Privacy Detection Starting...");

let currentSessionId = null;
let detectionCounts = {
    fingerprinting: 0,
    storage: 0,
    pii: 0
};

// ========== PROPER REPORTING FUNCTION (matches your original) ==========
function reportFinding(type, detail, extra_data = {}) {
    if (!currentSessionId) {
        console.warn("No session ID available, skipping log.");
        return;
    }

    const payload = {
        timestamp: new Date().toISOString(),
        type: type,
        detail: detail,
        url: window.location.hostname,
        visited_site: window.location.hostname,
        session: currentSessionId,  // ← Using REAL session ID
        source: "extension",
        ...extra_data
    };

    // Update local counts for badge
    detectionCounts[type] = (detectionCounts[type] || 0) + 1;
    updateExtensionBadge();

    console.log(`🔍 Privacy finding: ${type} - ${detail}`, payload);

    fetch("http://localhost:8081/log", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("✅ Successfully logged privacy event:", data);
    })
    .catch(err => {
        console.error("❌ Failed to report privacy finding:", err);
    });
}

// ========== EXTENSION BADGE UPDATES (matches your original) ==========
function updateExtensionBadge() {
    const total = Object.values(detectionCounts).reduce((sum, count) => sum + count, 0);
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    if (api && api.runtime) {
        api.runtime.sendMessage({
            type: "UPDATE_BADGE",
            count: total,
            hostname: window.location.hostname
        }).catch(err => {
            console.log("Background script communication failed:", err);
        });
    }
}

// ========== SESSION ID RETRIEVAL (matches your original) ==========
function initializePrivacyMonitoring() {
    console.log("🔧 Initializing privacy monitoring with proper session integration...");
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    if (!api || !api.runtime) {
        console.warn("Browser extension API not available");
        return;
    }

    api.runtime.sendMessage({
        type: "GET_SESSION_ID",
        hostname: window.location.hostname
    }).then(response => {
        if (response && response.sessionId) {
            currentSessionId = response.sessionId;
            console.log("🔑 Received session ID:", currentSessionId);
            startMonitoring();
        } else {
            console.warn("❌ No session ID received");
        }
    }).catch(error => {
        console.error("❌ Failed to get session ID:", error);
    });
}

// ========== WORKING STORAGE DETECTION + SESSION INTEGRATION ==========
function injectWorkingStorageDetection() {
    console.log("💉 Injecting working storage detection with session integration...");
    
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            console.log("💾 Working storage detection running in page context");
            
            // Get access to content script functions via custom events
            function reportStorageToContentScript(type, detail, extra_data = {}) {
                const event = new CustomEvent('privacyDetection', {
                    detail: { type, detail, extra_data }
                });
                document.dispatchEvent(event);
            }
            
            // === WORKING STORAGE HOOKS (Prototype Method) ===
            function setupWorkingStorageHooks() {
                console.log("💾 Setting up working storage hooks using prototype method...");
                
                try {
                    // Store original methods
                    const originalLocalSetItem = Storage.prototype.setItem;
                    const originalLocalGetItem = Storage.prototype.getItem;
                    const originalLocalRemoveItem = Storage.prototype.removeItem;
                    const originalLocalClear = Storage.prototype.clear;
                    
                    // Hook Storage.prototype.setItem (WORKING METHOD)
                    Storage.prototype.setItem = function(key, value) {
                        const storageType = this === localStorage ? 'localStorage' : 'sessionStorage';
                        
                        console.log("🎯 STORAGE DETECTED: " + storageType + ".setItem('" + key + "', '" + value + "')");
                        
                        reportStorageToContentScript("storage", storageType + ".setItem", {
                            storage_type: storageType,
                            operation: "setItem",
                            key: key
                        });
                        
                        return originalLocalSetItem.call(this, key, value);
                    };
                    
                    // Hook Storage.prototype.getItem
                    Storage.prototype.getItem = function(key) {
                        const storageType = this === localStorage ? 'localStorage' : 'sessionStorage';
                        
                        console.log("🎯 STORAGE DETECTED: " + storageType + ".getItem('" + key + "')");
                        
                        reportStorageToContentScript("storage", storageType + ".getItem", {
                            storage_type: storageType,
                            operation: "getItem",
                            key: key
                        });
                        
                        return originalLocalGetItem.call(this, key);
                    };
                    
                    // Hook Storage.prototype.removeItem
                    Storage.prototype.removeItem = function(key) {
                        const storageType = this === localStorage ? 'localStorage' : 'sessionStorage';
                        
                        console.log("🎯 STORAGE DETECTED: " + storageType + ".removeItem('" + key + "')");
                        
                        reportStorageToContentScript("storage", storageType + ".removeItem", {
                            storage_type: storageType,
                            operation: "removeItem",
                            key: key
                        });
                        
                        return originalLocalRemoveItem.call(this, key);
                    };
                    
                    // Hook Storage.prototype.clear
                    Storage.prototype.clear = function() {
                        const storageType = this === localStorage ? 'localStorage' : 'sessionStorage';
                        
                        console.log("🎯 STORAGE DETECTED: " + storageType + ".clear()");
                        
                        reportStorageToContentScript("storage", storageType + ".clear", {
                            storage_type: storageType,
                            operation: "clear"
                        });
                        
                        return originalLocalClear.call(this);
                    };
                    
                    console.log("✅ Working storage hooks with session integration installed");
                    
                    // Immediate verification
                    console.log("🧪 Testing storage hooks...");
                    localStorage.setItem('hook-verification-test', 'verification-value');
                    localStorage.getItem('hook-verification-test');
                    localStorage.removeItem('hook-verification-test');
                    
                } catch (error) {
                    console.error("❌ Storage hook installation failed:", error);
                }
            }
            
            // === WORKING FINGERPRINTING HOOKS ===
            function setupIntegratedFingerprintingHooks() {
                console.log("🔍 Setting up integrated fingerprinting hooks...");
                
                try {
                    // 1. CANVAS FINGERPRINTING
                    const originalGetContext = HTMLCanvasElement.prototype.getContext;
                    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                    
                    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                        if (type === "2d" || type === "webgl" || type === "webgl2") {
                            console.log("🎯 FINGERPRINTING DETECTED: Canvas " + type + " context accessed");
                            reportStorageToContentScript("fingerprinting", "canvas." + type + ".context", {
                                api: "canvas.getContext",
                                context_type: type,
                                fingerprint_category: "canvas"
                            });
                        }
                        return originalGetContext.call(this, type, ...args);
                    };
                    
                    HTMLCanvasElement.prototype.toDataURL = function(...args) {
                        console.log("🎯 FINGERPRINTING DETECTED: Canvas toDataURL called");
                        reportStorageToContentScript("fingerprinting", "canvas.toDataURL", {
                            api: "canvas.toDataURL",
                            fingerprint_category: "canvas"
                        });
                        return originalToDataURL.call(this, ...args);
                    };
                    
                    console.log("✅ Canvas fingerprinting hooks integrated");
                    
                    // 2. NAVIGATOR FINGERPRINTING
                    ['userAgent', 'language', 'platform'].forEach(function(prop) {
                        if (prop in navigator) {
                            let reported = false;
                            const originalValue = navigator[prop];
                            
                            try {
                                Object.defineProperty(navigator, prop, {
                                    get: function() {
                                        if (!reported) {
                                            reported = true;
                                            console.log("🎯 FINGERPRINTING DETECTED: navigator." + prop + " accessed");
                                            reportStorageToContentScript("fingerprinting", "navigator." + prop, {
                                                api: "navigator." + prop,
                                                fingerprint_category: "navigator"
                                            });
                                        }
                                        return originalValue;
                                    },
                                    configurable: true
                                });
                            } catch (e) {
                                console.log("⚠️ Could not monitor navigator." + prop + ":", e.message);
                            }
                        }
                    });
                    
                    console.log("✅ Navigator fingerprinting hooks integrated");
                    
                } catch (error) {
                    console.error("❌ Fingerprinting hook setup failed:", error);
                }
            }
            
            // Initialize everything
            setupWorkingStorageHooks();
            setupIntegratedFingerprintingHooks();
            
            // Auto-test to verify everything works
            setTimeout(function() {
                console.log("🔄 Auto-testing storage + fingerprinting with session integration...");
                
                // Test storage
                localStorage.setItem('auto-test-storage', 'auto-value');
                localStorage.getItem('auto-test-storage');
                
                // Test fingerprinting  
                const autoCanvas = document.createElement('canvas');
                const autoCtx = autoCanvas.getContext('2d');
                const autoUA = navigator.userAgent;
                
                console.log("🔄 Auto-test completed");
            }, 1000);
            
        })();
    `;
    
    try {
        document.head.appendChild(script);
        console.log("✅ Working storage + fingerprinting script injected successfully");
    } catch (error) {
        console.error("❌ Script injection failed:", error);
    }
}

// ========== EVENT LISTENER FOR PAGE CONTEXT COMMUNICATION ==========
function setupPageContextCommunication() {
    document.addEventListener('privacyDetection', function(event) {
        const { type, detail, extra_data } = event.detail;
        console.log(`📨 Received from page context: ${type} - ${detail}`);
        reportFinding(type, detail, extra_data);
    });
    console.log("✅ Page context communication setup complete");
}

// ========== MAIN MONITORING INITIALIZATION ==========
function startMonitoring() {
    console.log("🚀 Starting fixed session-integrated privacy monitoring...");
    
    try {
        setupPageContextCommunication();
        console.log("✅ Page context communication enabled");
    } catch (e) {
        console.error("❌ Error setting up communication:", e);
    }
    
    try {
        injectWorkingStorageDetection();
        console.log("✅ Working storage + fingerprinting detection enabled");
    } catch (e) {
        console.error("❌ Error setting up detection:", e);
    }
    
    console.log("🎯 Fixed session-integrated privacy monitoring is now ACTIVE!");
    console.log(`🔑 Using session ID: ${currentSessionId}`);
}

// ========== MANUAL TEST FUNCTIONS ==========
window.testWorkingIntegration = function() {
    console.log("🧪 TESTING WORKING INTEGRATION...");
    console.log("Current session ID:", currentSessionId);
    console.log("Current detection counts:", detectionCounts);
    
    // Test storage (should work with prototype method)
    localStorage.setItem('working-integration-test', 'test-value');
    localStorage.getItem('working-integration-test');
    
    // Test fingerprinting
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const ua = navigator.userAgent;
    
    setTimeout(() => {
        console.log("🎉 WORKING INTEGRATION TEST COMPLETED!");
        console.log("Final detection counts:", detectionCounts);
        console.log("Session ID used:", currentSessionId);
        
        if (detectionCounts.storage > 0) {
            console.log("✅ SUCCESS: Storage detection working with session integration!");
        } else {
            console.log("❌ PROBLEM: Storage detection not working");
        }
        
        if (detectionCounts.fingerprinting > 0) {
            console.log("✅ SUCCESS: Fingerprinting detection working with session integration!");
        } else {
            console.log("❌ PROBLEM: Fingerprinting detection not working");
        }
    }, 1000);
};

// ========== INITIALIZE EVERYTHING ==========
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePrivacyMonitoring);
} else {
    initializePrivacyMonitoring();
}

window.addEventListener('load', () => {
    console.log("📄 Page fully loaded, fixed session-integrated privacy monitoring active");
    updateExtensionBadge();
});

console.log("🔗 Fixed session-integrated privacy detection script loaded");
