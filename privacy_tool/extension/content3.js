console.log("🚀 Privacy Tool - Starting content script");

// ========== IMMEDIATELY CREATE DEBUG FUNCTIONS ==========
window.privacyDebug = {
    testStorage: function() {
        console.log("🧪 TESTING STORAGE ACCESS...");
        
        try {
            console.log("📝 Testing localStorage...");
            localStorage.setItem('privacy-test', 'test-value');
            localStorage.getItem('privacy-test');
            console.log("✅ localStorage test completed");
            
            console.log("📝 Testing sessionStorage...");
            sessionStorage.setItem('privacy-session', 'session-value');
            sessionStorage.getItem('privacy-session');
            console.log("✅ sessionStorage test completed");
            
            console.log("📝 Testing cookies...");
            document.cookie = "privacy-test=cookie-value";
            const cookies = document.cookie;
            console.log("✅ Cookie test completed");
            
            console.log("🎉 ALL STORAGE TESTS COMPLETED SUCCESSFULLY!");
            
        } catch (error) {
            console.error("❌ Storage test failed:", error);
        }
    },
    
    testFingerprinting: function() {
        console.log("🧪 TESTING FINGERPRINTING ACCESS...");
        
        try {
            console.log("📝 Testing navigator.userAgent...");
            const ua = navigator.userAgent;
            
            console.log("📝 Testing navigator.language...");
            const lang = navigator.language;
            
            console.log("📝 Testing canvas...");
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            console.log("🎉 ALL FINGERPRINTING TESTS COMPLETED!");
            
        } catch (error) {
            console.error("❌ Fingerprinting test failed:", error);
        }
    },
    
    checkStatus: function() {
        console.log("📊 PRIVACY TOOL STATUS:");
        console.log("- URL:", window.location.href);
        console.log("- Hostname:", window.location.hostname);
        console.log("- Script loaded:", true);
        console.log("- Debug functions available:", !!window.privacyDebug);
    }
};

console.log("✅ Debug functions created successfully!");
console.log("🔧 Available commands:");
console.log("  - window.privacyDebug.testStorage()");
console.log("  - window.privacyDebug.testFingerprinting()");
console.log("  - window.privacyDebug.checkStatus()");

// ========== SESSION AND REPORTING ==========
let currentSessionId = "debug-" + Date.now();
let detectionCounts = { fingerprinting: 0, storage: 0, pii: 0 };

function reportFinding(type, detail, extra_data = {}) {
    const payload = {
        timestamp: new Date().toISOString(),
        type: type,
        detail: detail,
        url: window.location.hostname,
        session: currentSessionId,
        source: "extension",
        ...extra_data
    };

    detectionCounts[type] = (detectionCounts[type] || 0) + 1;
    
    console.log(`🔍 PRIVACY DETECTION: ${type.toUpperCase()} - ${detail}`);
    console.log("📋 Detection payload:", payload);
    
    // Try to send to server
    fetch("http://localhost:8081/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }).then(response => response.json())
    .then(data => console.log("✅ Logged to server:", data))
    .catch(err => console.log("⚠️ Server not available:", err.message));
}

// ========== STORAGE MONITORING ==========
function setupStorageMonitoring() {
    console.log("💾 Setting up storage monitoring...");
    
    try {
        // LocalStorage
        if (window.localStorage) {
            ['setItem', 'getItem', 'removeItem', 'clear'].forEach(method => {
                const original = localStorage[method];
                localStorage[method] = function(...args) {
                    console.log(`💾 DETECTED: localStorage.${method}(${args[0] || ''})`);
                    reportFinding("storage", `localStorage.${method}`, {
                        storage_type: 'localStorage',
                        operation: method,
                        key: args[0]
                    });
                    return original.apply(this, args);
                };
            });
            console.log("✅ localStorage monitoring active");
        }
        
        // SessionStorage
        if (window.sessionStorage) {
            ['setItem', 'getItem', 'removeItem', 'clear'].forEach(method => {
                const original = sessionStorage[method];
                sessionStorage[method] = function(...args) {
                    console.log(`💾 DETECTED: sessionStorage.${method}(${args[0] || ''})`);
                    reportFinding("storage", `sessionStorage.${method}`, {
                        storage_type: 'sessionStorage',
                        operation: method,
                        key: args[0]
                    });
                    return original.apply(this, args);
                };
            });
            console.log("✅ sessionStorage monitoring active");
        }
        
        // Cookies
        const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
        if (originalDescriptor) {
            Object.defineProperty(document, 'cookie', {
                get: function() {
                    console.log(`🍪 DETECTED: document.cookie READ`);
                    reportFinding("storage", "cookie read", { storage_type: 'cookie', operation: 'read' });
                    return originalDescriptor.get.call(this);
                },
                set: function(value) {
                    console.log(`🍪 DETECTED: document.cookie WRITE`);
                    reportFinding("storage", "cookie write", { storage_type: 'cookie', operation: 'write' });
                    return originalDescriptor.set.call(this, value);
                }
            });
            console.log("✅ Cookie monitoring active");
        }
        
    } catch (error) {
        console.error("❌ Storage monitoring setup failed:", error);
    }
}

// ========== FINGERPRINTING MONITORING ==========
function setupFingerprintingMonitoring() {
    console.log("🔍 Setting up fingerprinting monitoring...");
    
    try {
        // Canvas
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            if (type === "2d" || type === "webgl" || type === "webgl2") {
                console.log(`🎨 DETECTED: Canvas.getContext(${type})`);
                reportFinding("fingerprinting", `canvas.getContext(${type})`, {
                    api: `canvas.getContext`,
                    context_type: type
                });
            }
            return originalGetContext.call(this, type, ...args);
        };
        
        // Canvas toDataURL
        if (HTMLCanvasElement.prototype.toDataURL) {
            const original = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function(...args) {
                console.log(`🎨 DETECTED: Canvas.toDataURL()`);
                reportFinding("fingerprinting", "canvas.toDataURL", { api: "canvas.toDataURL" });
                return original.apply(this, args);
            };
        }
        
        // Navigator properties
        ['userAgent', 'language', 'platform'].forEach(prop => {
            if (prop in navigator) {
                let accessed = false;
                const originalValue = navigator[prop];
                Object.defineProperty(navigator, prop, {
                    get: function() {
                        if (!accessed) {
                            accessed = true;
                            console.log(`🧭 DETECTED: navigator.${prop}`);
                            reportFinding("fingerprinting", `navigator.${prop}`, { api: `navigator.${prop}` });
                        }
                        return originalValue;
                    }
                });
            }
        });
        
        console.log("✅ Fingerprinting monitoring active");
        
    } catch (error) {
        console.error("❌ Fingerprinting monitoring setup failed:", error);
    }
}

// ========== INITIALIZE EVERYTHING ==========
function initialize() {
    console.log("🔧 Initializing privacy monitoring...");
    
    try {
        setupStorageMonitoring();
        setupFingerprintingMonitoring();
        console.log("🎯 Privacy monitoring is ACTIVE!");
        
        // Test that debug functions work
        console.log("🧪 Testing debug function availability...");
        if (window.privacyDebug && window.privacyDebug.checkStatus) {
            console.log("✅ Debug functions are working!");
        } else {
            console.error("❌ Debug functions not available!");
        }
        
    } catch (error) {
        console.error("❌ Initialization failed:", error);
    }
}

// Start immediately and also on DOM ready
initialize();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
}

console.log("🔒 Privacy Tool content script loaded completely");
console.log("🚀 Try: window.privacyDebug.testStorage()");
