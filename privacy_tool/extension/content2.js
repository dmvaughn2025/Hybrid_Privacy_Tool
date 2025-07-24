console.log("🚀 Enhanced Privacy Tool - Content script injected");

let currentSessionId = null;
let detectionCounts = {
    fingerprinting: 0,
    storage: 0,
    pii: 0
};

// ========== Enhanced Reporting Function ==========
function reportFinding(type, detail, extra_data = {}) {
    const payload = {
        timestamp: new Date().toISOString(),
        type: type,
        detail: detail,
        url: window.location.hostname,
        visited_site: window.location.hostname,
        session: currentSessionId || "no-session-debug",
        source: "extension",
        ...extra_data
    };

    // Update local counts for badge
    detectionCounts[type] = (detectionCounts[type] || 0) + 1;
    updateExtensionBadge();

    // ENHANCED: Always log to console for debugging
    console.log(`🔍 PRIVACY DETECTION: ${type.toUpperCase()} - ${detail}`, payload);

    // Try to send to server (will work if server is running)
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
        console.log("⚠️ Server logging failed (but detection still works):", err.message);
    });
}

// ========== Extension Badge Updates ==========
function updateExtensionBadge() {
    const total = Object.values(detectionCounts).reduce((sum, count) => sum + count, 0);
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    if (api && api.runtime) {
        api.runtime.sendMessage({
            type: "UPDATE_BADGE",
            count: total,
            hostname: window.location.hostname
        }).catch(err => {
            console.log("Badge update failed:", err);
        });
    }
}

// ========== ENHANCED Storage Detection ==========
function monitorStorageAPIs() {
    console.log("💾 Setting up ENHANCED storage API monitoring...");

    // 1. LOCALSTORAGE
    try {
        if (window.localStorage) {
            const storage = window.localStorage;
            const methods = ['getItem', 'setItem', 'removeItem', 'clear'];
            
            methods.forEach(method => {
                const original = storage[method];
                storage[method] = function(...args) {
                    console.log(`💾 STORAGE DETECTED: localStorage.${method}`, args[0] ? `key: ${args[0]}` : '');
                    reportFinding("storage", `LocalStorage ${method} accessed`, {
                        storage_type: 'localStorage',
                        operation: method,
                        key: args[0] || null
                    });
                    return original.apply(this, args);
                };
            });
            console.log("✅ LocalStorage monitoring enabled");
        }
    } catch (e) {
        console.error("❌ Error setting up localStorage monitoring:", e);
    }

    // 2. SESSIONSTORAGE
    try {
        if (window.sessionStorage) {
            const storage = window.sessionStorage;
            const methods = ['getItem', 'setItem', 'removeItem', 'clear'];
            
            methods.forEach(method => {
                const original = storage[method];
                storage[method] = function(...args) {
                    console.log(`💾 STORAGE DETECTED: sessionStorage.${method}`, args[0] ? `key: ${args[0]}` : '');
                    reportFinding("storage", `SessionStorage ${method} accessed`, {
                        storage_type: 'sessionStorage',
                        operation: method,
                        key: args[0] || null
                    });
                    return original.apply(this, args);
                };
            });
            console.log("✅ SessionStorage monitoring enabled");
        }
    } catch (e) {
        console.error("❌ Error setting up sessionStorage monitoring:", e);
    }

    // 3. COOKIES
    try {
        const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
        
        if (originalCookieDescriptor) {
            Object.defineProperty(document, 'cookie', {
                get: function() {
                    console.log(`🍪 STORAGE DETECTED: document.cookie READ`);
                    reportFinding("storage", "Cookie read access", {
                        storage_type: 'cookie',
                        operation: 'read'
                    });
                    return originalCookieDescriptor.get.call(this);
                },
                set: function(value) {
                    console.log(`🍪 STORAGE DETECTED: document.cookie WRITE`);
                    reportFinding("storage", "Cookie write access", {
                        storage_type: 'cookie',
                        operation: 'write',
                        cookie_name: value.split('=')[0]
                    });
                    return originalCookieDescriptor.set.call(this, value);
                },
                configurable: true
            });
            console.log("✅ Cookie monitoring enabled");
        }
    } catch (e) {
        console.error("❌ Error setting up cookie monitoring:", e);
    }

    // 4. INDEXEDDB
    try {
        if (window.indexedDB) {
            const originalOpen = window.indexedDB.open;
            window.indexedDB.open = function(...args) {
                console.log(`💾 STORAGE DETECTED: indexedDB.open`, args[0]);
                reportFinding("storage", "IndexedDB database opened", {
                    storage_type: 'indexedDB',
                    operation: 'open',
                    database: args[0]
                });
                return originalOpen.apply(this, args);
            };
            console.log("✅ IndexedDB monitoring enabled");
        }
    } catch (e) {
        console.error("❌ Error setting up IndexedDB monitoring:", e);
    }
}

// ========== ENHANCED Fingerprinting Detection ==========
function monitorFingerprintingAPIs() {
    console.log("🔍 Setting up fingerprinting API monitoring...");

    // CANVAS FINGERPRINTING
    try {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            if (type === "2d" || type === "webgl" || type === "webgl2") {
                console.log(`🎨 FINGERPRINTING DETECTED: Canvas ${type} context accessed`);
                reportFinding("fingerprinting", `Canvas ${type} context accessed for potential fingerprinting`, {
                    api: `canvas.getContext(${type})`,
                    fingerprint_category: 'canvas'
                });
            }
            return originalGetContext.call(this, type, ...args);
        };

        // Canvas data extraction methods
        if (HTMLCanvasElement.prototype.toDataURL) {
            const original = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(...args) {
                console.log(`🎨 FINGERPRINTING DETECTED: Canvas toDataURL called`);
                reportFinding("fingerprinting", `Canvas toDataURL called - likely fingerprinting`, {
                    api: `canvas.toDataURL`,
                    fingerprint_category: 'canvas'
                });
                return original.apply(this, args);
            };
        }

        console.log("✅ Canvas fingerprinting hooks installed");
    } catch (e) {
        console.error("❌ Error setting up canvas monitoring:", e);
    }

    // NAVIGATOR PROPERTIES
    try {
        const sensitiveNavProps = ['userAgent', 'language', 'platform'];

        sensitiveNavProps.forEach(prop => {
            if (prop in navigator) {
                let accessed = false;
                const originalValue = navigator[prop];
                
                Object.defineProperty(navigator, prop, {
                    get: function() {
                        if (!accessed) {
                            accessed = true;
                            console.log(`🧭 FINGERPRINTING DETECTED: Navigator.${prop} accessed`);
                            reportFinding("fingerprinting", `Navigator.${prop} accessed for browser fingerprinting`, {
                                api: `navigator.${prop}`,
                                fingerprint_category: 'navigator'
                            });
                        }
                        return originalValue;
                    },
                    configurable: true
                });
            }
        });
        console.log("✅ Navigator fingerprinting hooks installed");
    } catch (e) {
        console.error("❌ Error setting up navigator monitoring:", e);
    }
}

// ========== Enhanced Form Monitoring for PII ==========
function monitorFormSubmissions() {
    console.log("📝 Setting up form monitoring...");
    
    document.addEventListener('submit', function(event) {
        const form = event.target;
        if (form.tagName !== 'FORM') return;

        const formData = new FormData(form);
        const piiDetected = [];
        
        for (let [name, value] of formData.entries()) {
            const nameStr = String(name).toLowerCase();
            const valueStr = String(value);
            
            if (nameStr.includes('email') && value.includes('@')) {
                piiDetected.push('email');
            } else if (nameStr.includes('phone') || /\d{3}[-\s]?\d{3}[-\s]?\d{4}/.test(valueStr)) {
                piiDetected.push('phone');
            } else if (nameStr.includes('name') && valueStr.length > 1) {
                piiDetected.push('name');
            }
        }
        
        if (piiDetected.length > 0) {
            console.log(`📝 PII DETECTED: Form submission with ${piiDetected.join(', ')}`);
            reportFinding("pii", `Form submission with PII: ${piiDetected.join(', ')}`, {
                pii_types: piiDetected,
                form_action: form.action || 'same-page'
            });
        }
    });

    console.log("✅ Form monitoring enabled");
}

// ========== Session ID Retrieval ==========
function initializePrivacyMonitoring() {
    console.log("🔧 Initializing privacy monitoring...");
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    if (api && api.runtime) {
        api.runtime.sendMessage({
            type: "GET_SESSION_ID",
            hostname: window.location.hostname
        }).then(response => {
            if (response && response.sessionId) {
                currentSessionId = response.sessionId;
                console.log("🔑 Received session ID:", currentSessionId);
            } else {
                console.warn("No session ID received - using debug mode");
                currentSessionId = "debug-" + Date.now();
            }
        }).catch(error => {
            console.warn("Failed to get session ID - using debug mode:", error);
            currentSessionId = "debug-" + Date.now();
        });
    } else {
        console.warn("No extension API - using debug mode");
        currentSessionId = "debug-" + Date.now();
    }
    
    // Always start monitoring regardless of session ID
    setTimeout(startMonitoring, 100);
}

// ========== Main Monitoring Initialization ==========
function startMonitoring() {
    console.log("🚀 Starting comprehensive privacy monitoring...");
    
    try {
        monitorFingerprintingAPIs();
        console.log("✅ Fingerprinting API monitoring enabled");
    } catch (e) {
        console.error("❌ Error setting up fingerprinting monitoring:", e);
    }
    
    try {
        monitorStorageAPIs();
        console.log("✅ Storage API monitoring enabled");
    } catch (e) {
        console.error("❌ Error setting up storage monitoring:", e);
    }
    
    try {
        monitorFormSubmissions();
        console.log("✅ Form monitoring enabled");
    } catch (e) {
        console.error("❌ Error setting up form monitoring:", e);
    }
    
    console.log("🎯 Privacy monitoring is now ACTIVE!");
}

// ========== ALWAYS AVAILABLE Debug Functions ==========
window.privacyDebug = {
    testStorage: function() {
        console.log("🧪 Running storage tests...");
        try {
            localStorage.setItem('test-key', 'test-value');
            localStorage.getItem('test-key');
            sessionStorage.setItem('session-test', 'session-value');
            sessionStorage.getItem('session-test');
            document.cookie = "test-cookie=test-value";
            const cookies = document.cookie; // This should trigger read detection
            console.log("🧪 Storage tests completed successfully");
        } catch (e) {
            console.error("🧪 Storage test failed:", e);
        }
    },
    
    testFingerprinting: function() {
        console.log("🧪 Running fingerprinting tests...");
        try {
            const ua = navigator.userAgent;
            const lang = navigator.language;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            console.log("🧪 Fingerprinting tests completed");
        } catch (e) {
            console.error("🧪 Fingerprinting test failed:", e);
        }
    },
    
    reportTest: function() {
        reportFinding("fingerprinting", "Manual test", { test: true });
    },
    
    getStatus: function() {
        console.log("🔍 Privacy Tool Status:");
        console.log("Session ID:", currentSessionId);
        console.log("Detection counts:", detectionCounts);
        console.log("Current URL:", window.location.href);
    }
};

// ========== Initialize Everything ==========
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePrivacyMonitoring);
} else {
    initializePrivacyMonitoring();
}

window.addEventListener('load', () => {
    console.log("📄 Page fully loaded, privacy monitoring active");
    updateExtensionBadge();
});

console.log("🔒 Enhanced Privacy Tool content script loaded successfully");
console.log("🧪 Debug functions available: window.privacyDebug.testStorage()");
