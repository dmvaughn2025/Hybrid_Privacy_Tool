console.log("Enhanced Privacy Tool - Content script injected");

let currentSessionId = null;
let detectionCounts = {
    fingerprinting: 0,
    storage: 0,
    pii: 0
};

// ========== Enhanced Reporting Function ==========
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
        session: currentSessionId,
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
        console.log("Successfully logged privacy event:", data);
    })
    .catch(err => {
        console.error("Failed to report privacy finding:", err);
    });
}

// ========== Extension Badge Updates ==========
function updateExtensionBadge() {
    const total = Object.values(detectionCounts).reduce((sum, count) => sum + count, 0);
    
    // Send message to background script to update badge
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.runtime.sendMessage({
            type: "UPDATE_BADGE",
            count: total,
            hostname: window.location.hostname
        }).catch(err => {
            console.log("Background script communication failed:", err);
        });
    }
}

// ========== Session ID Retrieval ==========
function initializePrivacyMonitoring() {
    if (typeof browser === 'undefined' || !browser.runtime) {
        console.warn("Browser extension API not available");
        return;
    }

    browser.runtime.sendMessage({
        type: "GET_SESSION_ID",
        hostname: window.location.hostname
    }).then(response => {
        if (response && response.sessionId) {
            currentSessionId = response.sessionId;
            console.log("Received session ID:", currentSessionId);
            startMonitoring();
        } else {
            console.warn("No session ID received");
        }
    }).catch(error => {
        console.error("Failed to get session ID:", error);
    });
}

// ========== Enhanced Form Monitoring for PII ==========
function monitorFormSubmissions() {
    // Monitor form submissions
    document.addEventListener('submit', function(event) {
        const form = event.target;
        if (form.tagName !== 'FORM') return;

        const formData = new FormData(form);
        const piiDetected = [];
        
        for (let [name, value] of formData.entries()) {
            const nameStr = String(name).toLowerCase();
            const valueStr = String(value).toLowerCase();
            
            // Check field names
            if (nameStr.includes('email') && value.includes('@')) {
                piiDetected.push('email');
            } else if (nameStr.includes('phone') || /\d{3}[-\s]?\d{3}[-\s]?\d{4}/.test(valueStr)) {
                piiDetected.push('phone');
            } else if (nameStr.includes('address') || nameStr.includes('street')) {
                piiDetected.push('address');
            } else if (nameStr.includes('name') && valueStr.length > 1) {
                piiDetected.push('name');
            } else if (nameStr.includes('ssn') || /\d{3}-?\d{2}-?\d{4}/.test(valueStr)) {
                piiDetected.push('ssn');
            } else if (nameStr.includes('birth') || nameStr.includes('dob')) {
                piiDetected.push('birthdate');
            }
        }
        
        if (piiDetected.length > 0) {
            reportFinding("pii", `Form submission with PII: ${piiDetected.join(', ')}`, {
                pii_types: piiDetected,
                form_action: form.action || 'same-page',
                form_method: form.method || 'GET'
            });
        }
    });

    // Monitor input changes for real-time detection
    document.addEventListener('input', function(event) {
        const input = event.target;
        if (input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') return;
        
        const name = input.name?.toLowerCase() || '';
        const value = input.value || '';
        
        if (name.includes('email') && value.includes('@') && value.includes('.')) {
            reportFinding("pii", "Email input detected", { pii_types: ['email'] });
        }
    });
}

// ========== Comprehensive Storage Monitoring ==========
function monitorStorageAPIs() {
    // localStorage monitoring
    if (typeof Storage !== 'undefined') {
        ['localStorage', 'sessionStorage'].forEach(storageType => {
            const storage = window[storageType];
            if (!storage) return;

            const methods = ['setItem', 'getItem', 'removeItem', 'clear'];
            methods.forEach(method => {
                const original = storage[method];
                storage[method] = function(...args) {
                    const operation = `${storageType}.${method}`;
                    const key = args[0] || 'unknown';
                    
                    reportFinding("storage", `${operation}(${key})`, {
                        storage_type: storageType,
                        operation: method,
                        key: key
                    });
                    
                    return original.apply(this, args);
                };
            });
        });
    }

    // Cookie monitoring
    const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
        get: function() {
            reportFinding("storage", "document.cookie read", {
                storage_type: 'cookie',
                operation: 'read'
            });
            return originalCookieDescriptor.get.call(this);
        },
        set: function(value) {
            reportFinding("storage", "document.cookie write", {
                storage_type: 'cookie',
                operation: 'write',
                cookie_data: value.split('=')[0] // Log only cookie name for privacy
            });
            return originalCookieDescriptor.set.call(this, value);
        }
    });

    // IndexedDB monitoring
    if (window.indexedDB) {
        const originalOpen = window.indexedDB.open;
        window.indexedDB.open = function(...args) {
            reportFinding("storage", "IndexedDB access", {
                storage_type: 'indexedDB',
                operation: 'open',
                database: args[0]
            });
            return originalOpen.apply(this, args);
        };
    }

    // Window.name monitoring (used for cross-domain storage)
    let windowNameAccessed = false;
    Object.defineProperty(window, 'name', {
        get: function() {
            if (!windowNameAccessed) {
                windowNameAccessed = true;
                reportFinding("storage", "window.name access", {
                    storage_type: 'window_name',
                    operation: 'read'
                });
            }
            return this._name || '';
        },
        set: function(value) {
            reportFinding("storage", "window.name write", {
                storage_type: 'window_name',
                operation: 'write'
            });
            this._name = value;
        }
    });
}

// ========== Enhanced Fingerprinting Detection ==========
function monitorFingerprintingAPIs() {
    // Canvas fingerprinting
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        if (type === "2d" || type === "webgl" || type === "webgl2") {
            reportFinding("fingerprinting", `Canvas ${type} context accessed`, {
                api: `canvas.getContext(${type})`,
                fingerprint_category: 'canvas'
            });
        }
        return originalGetContext.call(this, type, ...args);
    };

    // Canvas methods that are commonly used for fingerprinting
    const canvasMethods = ['getImageData', 'toDataURL', 'toBlob'];
    canvasMethods.forEach(method => {
        if (CanvasRenderingContext2D.prototype[method]) {
            const original = CanvasRenderingContext2D.prototype[method];
            CanvasRenderingContext2D.prototype[method] = function(...args) {
                reportFinding("fingerprinting", `Canvas ${method} called`, {
                    api: `canvas.${method}`,
                    fingerprint_category: 'canvas'
                });
                return original.apply(this, args);
            };
        }
    });

    // WebGL fingerprinting
    const hookWebGLMethod = (context, method) => {
        if (context && context[method]) {
            const original = context[method];
            context[method] = function(...args) {
                reportFinding("fingerprinting", `WebGL ${method} called`, {
                    api: `webgl.${method}`,
                    fingerprint_category: 'webgl',
                    parameters: args.slice(0, 2) // Log first 2 params only
                });
                return original.apply(this, args);
            };
        }
    };

    // Hook WebGL context creation
    const originalWebGLContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        const context = originalWebGLContext.call(this, type, ...args);
        if ((type === 'webgl' || type === 'webgl2') && context) {
            hookWebGLMethod(context, 'getParameter');
            hookWebGLMethod(context, 'getExtension');
            hookWebGLMethod(context, 'getSupportedExtensions');
        }
        return context;
    };

    // Audio fingerprinting
    const audioContexts = ['AudioContext', 'webkitAudioContext'];
    audioContexts.forEach(contextName => {
        if (window[contextName]) {
            const OriginalAudioContext = window[contextName];
            window[contextName] = function(...args) {
                reportFinding("fingerprinting", `${contextName} created`, {
                    api: contextName,
                    fingerprint_category: 'audio'
                });
                return new OriginalAudioContext(...args);
            };
        }
    });

    // Navigator properties fingerprinting
    const sensitiveNavProps = [
        'userAgent', 'language', 'languages', 'platform', 'hardwareConcurrency',
        'deviceMemory', 'cookieEnabled', 'doNotTrack', 'maxTouchPoints'
    ];
    
    sensitiveNavProps.forEach(prop => {
        if (navigator.hasOwnProperty(prop)) {
            const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, prop) ||
                             Object.getOwnPropertyDescriptor(navigator, prop);
            if (descriptor && descriptor.get) {
                Object.defineProperty(Navigator.prototype, prop, {
                    get: function() {
                        reportFinding("fingerprinting", `navigator.${prop} accessed`, {
                            api: `navigator.${prop}`,
                            fingerprint_category: 'navigator'
                        });
                        return descriptor.get.call(this);
                    }
                });
            }
        }
    });

    // Screen properties
    const screenProps = ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth'];
    screenProps.forEach(prop => {
        const descriptor = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
        if (descriptor && descriptor.get) {
            Object.defineProperty(Screen.prototype, prop, {
                get: function() {
                    reportFinding("fingerprinting", `screen.${prop} accessed`, {
                        api: `screen.${prop}`,
                        fingerprint_category: 'screen'
                    });
                    return descriptor.get.call(this);
                }
            });
        }
    });

    // Font detection via DOM
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        if (tagName.toLowerCase() === 'span' || tagName.toLowerCase() === 'div') {
            // Monitor when elements are used for font measurement
            const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
            const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
            
            let fontDetectionWarned = false;
            Object.defineProperty(element, 'offsetWidth', {
                get: function() {
                    if (this.style.fontFamily && !fontDetectionWarned) {
                        fontDetectionWarned = true;
                        reportFinding("fingerprinting", "Font detection attempt", {
                            api: "element.offsetWidth",
                            fingerprint_category: 'font'
                        });
                    }
                    return originalOffsetWidth.get.call(this);
                }
            });
        }
        return element;
    };
}

// ========== Request Monitoring ==========
function monitorOutgoingRequests() {
    // Monitor fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        // Check if request is to third-party domain
        const isThirdParty = !urlStr.startsWith(window.location.origin) && 
                           !urlStr.startsWith('/') && 
                           !urlStr.startsWith('./');
        
        if (isThirdParty) {
            reportFinding("tracker", "Third-party fetch request", {
                target_url: urlStr,
                method: options.method || 'GET',
                request_type: 'fetch'
            });
        }
        
        return originalFetch.apply(this, arguments);
    };

    // Monitor XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        const isThirdParty = !urlStr.startsWith(window.location.origin) && 
                           !urlStr.startsWith('/') && 
                           !urlStr.startsWith('./');
        
        if (isThirdParty) {
            reportFinding("tracker", "Third-party XHR request", {
                target_url: urlStr,
                method: method,
                request_type: 'xhr'
            });
        }
        
        return originalXHROpen.apply(this, arguments);
    };
}

// ========== Main Monitoring Initialization ==========
function startMonitoring() {
    console.log("Starting comprehensive privacy monitoring...");
    
    try {
        monitorFingerprintingAPIs();
        console.log("✓ Fingerprinting API monitoring enabled");
    } catch (e) {
        console.error("Error setting up fingerprinting monitoring:", e);
    }
    
    try {
        monitorStorageAPIs();
        console.log("✓ Storage API monitoring enabled");
    } catch (e) {
        console.error("Error setting up storage monitoring:", e);
    }
    
    try {
        monitorFormSubmissions();
        console.log("✓ Form monitoring enabled");
    } catch (e) {
        console.error("Error setting up form monitoring:", e);
    }
    
    try {
        monitorOutgoingRequests();
        console.log("✓ Request monitoring enabled");
    } catch (e) {
        console.error("Error setting up request monitoring:", e);
    }
}

// ========== Initialize Everything ==========
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePrivacyMonitoring);
} else {
    initializePrivacyMonitoring();
}

// Initialize on page load as well for additional coverage
window.addEventListener('load', () => {
    console.log("Page fully loaded, privacy monitoring active");
    updateExtensionBadge();
});
