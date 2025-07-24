// Firefox Production Storage Detection - Working Version
console.log("🦊✅ Firefox Production Storage Detection Starting...");

(function() {
    'use strict';
    
    function injectProductionScript() {
        console.log("💉 Injecting production storage detection...");
        
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                console.log("🦊✅ Production storage detection running in page context");
                
                // === DETECTION COUNTERS ===
                window.privacyDetectionCounts = {
                    storage: 0,
                    fingerprinting: 0,
                    trackers: 0,
                    pii: 0
                };
                
                // === WORKING STORAGE HOOKS (Prototype Method) ===
                function setupProductionStorageHooks() {
                    console.log("🔧 Setting up production storage hooks using prototype method...");
                    
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
                            console.log("🔍 PRIVACY DETECTION: STORAGE - " + storageType + " write detected");
                            
                            // Increment counter
                            window.privacyDetectionCounts.storage++;
                            
                            // Send to server
                            fetch("http://localhost:8081/log", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    timestamp: new Date().toISOString(),
                                    type: "storage",
                                    detail: storageType + ".setItem",
                                    url: window.location.hostname,
                                    session: "firefox-prod-" + Date.now(),
                                    storage_type: storageType,
                                    operation: "setItem",
                                    key: key,
                                    source: "extension"
                                })
                            }).then(response => response.json())
                            .then(data => console.log("✅ Logged to server:", data.status || "success"))
                            .catch(e => console.log("⚠️ Server logging failed:", e.message));
                            
                            return originalLocalSetItem.call(this, key, value);
                        };
                        
                        // Hook Storage.prototype.getItem
                        Storage.prototype.getItem = function(key) {
                            const storageType = this === localStorage ? 'localStorage' : 'sessionStorage';
                            
                            console.log("🎯 STORAGE DETECTED: " + storageType + ".getItem('" + key + "')");
                            console.log("🔍 PRIVACY DETECTION: STORAGE - " + storageType + " read detected");
                            
                            // Increment counter
                            window.privacyDetectionCounts.storage++;
                            
                            return originalLocalGetItem.call(this, key);
                        };
                        
                        // Hook Storage.prototype.removeItem
                        Storage.prototype.removeItem = function(key) {
                            const storageType = this === localStorage ? 'localStorage' : 'sessionStorage';
                            
                            console.log("🎯 STORAGE DETECTED: " + storageType + ".removeItem('" + key + "')");
                            console.log("🔍 PRIVACY DETECTION: STORAGE - " + storageType + " remove detected");
                            
                            window.privacyDetectionCounts.storage++;
                            
                            return originalLocalRemoveItem.call(this, key);
                        };
                        
                        // Hook Storage.prototype.clear
                        Storage.prototype.clear = function() {
                            const storageType = this === localStorage ? 'localStorage' : 'sessionStorage';
                            
                            console.log("🎯 STORAGE DETECTED: " + storageType + ".clear()");
                            console.log("🔍 PRIVACY DETECTION: STORAGE - " + storageType + " clear detected");
                            
                            window.privacyDetectionCounts.storage++;
                            
                            return originalLocalClear.call(this);
                        };
                        
                        console.log("✅ Production storage hooks installed successfully");
                        
                        // Immediate verification
                        console.log("🧪 Verifying hooks with test operation...");
                        localStorage.setItem('production-hook-test', 'verification');
                        localStorage.getItem('production-hook-test');
                        localStorage.removeItem('production-hook-test');
                        
                    } catch (error) {
                        console.error("❌ Production storage hook installation failed:", error);
                    }
                }
                
                // === FINGERPRINTING HOOKS ===
                function setupFingerprintingHooks() {
                    console.log("🔍 Setting up fingerprinting detection...");
                    
                    try {
                        // Canvas fingerprinting
                        const originalGetContext = HTMLCanvasElement.prototype.getContext;
                        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                            if (type === "2d" || type === "webgl" || type === "webgl2") {
                                console.log("🎯 FINGERPRINTING DETECTED: Canvas " + type + " context accessed");
                                console.log("🔍 PRIVACY DETECTION: FINGERPRINTING - canvas context");
                                window.privacyDetectionCounts.fingerprinting++;
                            }
                            return originalGetContext.call(this, type, ...args);
                        };
                        
                        // Navigator properties
                        ['userAgent', 'language', 'platform'].forEach(function(prop) {
                            if (prop in navigator) {
                                let accessed = false;
                                const originalValue = navigator[prop];
                                
                                try {
                                    Object.defineProperty(navigator, prop, {
                                        get: function() {
                                            if (!accessed) {
                                                accessed = true;
                                                console.log("🎯 FINGERPRINTING DETECTED: navigator." + prop + " accessed");
                                                window.privacyDetectionCounts.fingerprinting++;
                                            }
                                            return originalValue;
                                        },
                                        configurable: true
                                    });
                                } catch (e) {
                                    console.log("⚠️ Could not monitor navigator." + prop);
                                }
                            }
                        });
                        
                        console.log("✅ Fingerprinting hooks installed");
                        
                    } catch (error) {
                        console.error("❌ Fingerprinting hook setup failed:", error);
                    }
                }
                
                // === TEST FUNCTIONS ===
                window.firefoxTest = function() {
                    console.log("🧪 FIREFOX PRODUCTION TEST STARTING...");
                    console.log("Current detection counts:", window.privacyDetectionCounts);
                    
                    console.log("📝 Testing localStorage operations...");
                    localStorage.setItem('firefox-prod-test-1', 'value-1');
                    localStorage.setItem('firefox-prod-test-2', 'value-2');
                    localStorage.getItem('firefox-prod-test-1');
                    localStorage.getItem('firefox-prod-test-2');
                    localStorage.removeItem('firefox-prod-test-1');
                    
                    console.log("📝 Testing sessionStorage operations...");
                    sessionStorage.setItem('firefox-session-test', 'session-value');
                    sessionStorage.getItem('firefox-session-test');
                    sessionStorage.removeItem('firefox-session-test');
                    
                    console.log("📝 Testing fingerprinting...");
                    const ua = navigator.userAgent;
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    console.log("🎉 PRODUCTION TEST COMPLETED!");
                    console.log("Final detection counts:", window.privacyDetectionCounts);
                    console.log("Total storage detections:", window.privacyDetectionCounts.storage);
                    console.log("Total fingerprinting detections:", window.privacyDetectionCounts.fingerprinting);
                    
                    if (window.privacyDetectionCounts.storage > 0) {
                        console.log("✅ SUCCESS: Storage detection is working!");
                    }
                    if (window.privacyDetectionCounts.fingerprinting > 0) {
                        console.log("✅ SUCCESS: Fingerprinting detection is working!");
                    }
                };
                
                window.firefoxStatus = function() {
                    console.log("📊 FIREFOX PRODUCTION STATUS:");
                    console.log("- URL:", window.location.href);
                    console.log("- Total storage detections:", window.privacyDetectionCounts.storage);
                    console.log("- Total fingerprinting detections:", window.privacyDetectionCounts.fingerprinting);
                    console.log("- Storage hooks active:", Storage.prototype.setItem.toString().includes('STORAGE DETECTED'));
                    console.log("- Current localStorage keys:", Object.keys(localStorage));
                    console.log("- Current sessionStorage keys:", Object.keys(sessionStorage));
                };
                
                window.firefoxClearCounts = function() {
                    window.privacyDetectionCounts = { storage: 0, fingerprinting: 0, trackers: 0, pii: 0 };
                    console.log("🗑️ Detection counts cleared");
                };
                
                window.firefoxRealTimeTest = function() {
                    console.log("⚡ Real-time storage activity monitor starting...");
                    console.log("Current storage activity will be logged as it happens...");
                    console.log("Check console for STORAGE DETECTED messages");
                    console.log("Current count: " + window.privacyDetectionCounts.storage);
                };
                
                // === INITIALIZE PRODUCTION HOOKS ===
                setupProductionStorageHooks();
                setupFingerprintingHooks();
                
                // Report initial status
                setTimeout(function() {
                    console.log("📊 INITIAL STATUS REPORT:");
                    console.log("- Storage detections so far:", window.privacyDetectionCounts.storage);
                    console.log("- Fingerprinting detections so far:", window.privacyDetectionCounts.fingerprinting);
                    
                    if (window.privacyDetectionCounts.storage > 0) {
                        console.log("✅ Website is already using storage - detection working!");
                    } else {
                        console.log("ℹ️ No storage activity detected yet - hooks are ready");
                    }
                }, 2000);
                
                console.log("✅ Firefox production privacy detection ready!");
                console.log("🧪 Available commands:");
                console.log("   - window.firefoxTest() - Run test suite");
                console.log("   - window.firefoxStatus() - Check current status");
                console.log("   - window.firefoxRealTimeTest() - Monitor real-time activity");
                console.log("   - window.firefoxClearCounts() - Reset counters");
                
            })();
        `;
        
        try {
            document.head.appendChild(script);
            console.log("✅ Production script injected successfully");
        } catch (error) {
            console.error("❌ Production script injection failed:", error);
        }
    }
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectProductionScript);
    } else {
        injectProductionScript();
    }
    
    setTimeout(injectProductionScript, 100);
    
})();

console.log("🦊✅ Firefox production storage detection script loaded");
