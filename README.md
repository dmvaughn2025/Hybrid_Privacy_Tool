# Hybrid_Privacy_Tool
# Privacy Guard - Advanced Privacy Protection

[![License](https://img.shields.io/badge/license-Open%20Source-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0-green.svg)](manifest.json)
[![Supported Browsers](https://img.shields.io/badge/browsers-Firefox%20%7C%20Chrome-orange.svg)](#installation)

**Privacy Guard** is a comprehensive privacy protection tool that combines a browser extension with an intelligent proxy to provide real-time protection against tracking, fingerprinting, and personal data extraction.

## 🚀 Features

### 🛡️ **Multi-Layer Protection**
- **Tracker Blocking**: Blocks 52,602+ known tracking domains with auto-updating lists
- **Fingerprinting Detection**: Advanced detection of canvas, WebGL, audio, and device fingerprinting
- **PII Monitoring**: Real-time detection of personal information extraction attempts
- **Storage Abuse Protection**: Monitors and controls local storage access patterns

### 📊 **Real-Time Monitoring**
- **Live Dashboard**: Browser extension popup with current session statistics
- **Badge Counter**: Visual indicator showing threats blocked on current page
- **Detailed Logging**: Comprehensive JSON event logs for privacy analysis
- **Session Tracking**: Per-site session management with privacy timeline

### 🔄 **Auto-Updating Intelligence**
- **Dynamic Rule Updates**: Automatically pulls latest tracker lists from:
  - DuckDuckGo Tracker Radar
  - EasyPrivacy Lists
  - Disconnect.me Database
- **24-Hour Update Cycle**: Keeps protection current with emerging threats
- **Backup Management**: Maintains 5 previous rule versions for rollback

### 🎯 **Advanced Detection**
- **Form Analysis**: Detects PII in form submissions (emails, phones, addresses, SSNs)
- **URL Parameter Scanning**: Identifies tracking parameters (UTM, GCLID, FBCLID, etc.)
- **Cross-Site Tracking**: Prevents user identification across different domains
- **API Fingerprinting**: Monitors 78+ browser APIs commonly used for fingerprinting

## 🏗️ Architecture

Privacy Guard uses a dual-component architecture for maximum protection coverage:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Browser        │    │  Python Proxy   │    │  Local API      │
│  Extension      │◄──►│  (mitmproxy)    │◄──►│  Server         │
│                 │    │                 │    │  (port 8081)    │
│  • Content      │    │  • Request      │    │  • Event        │
│    Scripts      │    │    Inspection   │    │    Logging      │
│  • Background   │    │  • Domain       │    │  • Data         │
│    Scripts      │    │    Filtering    │    │    Aggregation  │
│  • Popup UI     │    │  • PII Detection│    │  • Analytics    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Extension Components**
- **Content Scripts**: Inject privacy monitoring directly into web pages
- **Background Scripts**: Handle request blocking and session management
- **Popup Interface**: Real-time privacy dashboard and controls
- **Badge System**: Visual threat counter on browser toolbar

### **Proxy Components**
- **Traffic Interception**: Analyzes all HTTP/HTTPS requests before they reach websites
- **Pattern Matching**: Uses sophisticated regex and domain matching for threat detection
- **Response Modification**: Can sanitize or block malicious content in real-time

## 📦 Installation

### **Prerequisites**
- Python 3.8+ with pip
- Modern web browser (Firefox 57+ or Chrome 88+)
- Administrative permissions for proxy installation

### **Quick Setup**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/privacy-guard.git
   cd privacy-guard
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Update privacy rules**
   ```bash
   python update_trackers.py
   ```

4. **Start the proxy server**
   ```bash
   python proxy.py
   ```

5. **Install browser extension**
   - **Firefox**: Go to `about:debugging` → Load Temporary Add-on → Select `manifest.json`
   - **Chrome**: Go to `chrome://extensions/` → Developer mode → Load unpacked → Select project folder

### **Configure Browser Proxy** (Optional for enhanced protection)
- **HTTP Proxy**: `localhost:8080`
- **HTTPS Proxy**: `localhost:8080`

## 🎮 Usage

### **Basic Operation**
1. **Browse Normally**: Privacy Guard works automatically in the background
2. **Check Status**: Click the extension icon to view current page protection stats
3. **View Details**: Numbers show blocked trackers, detected fingerprinting, PII extractions, and storage access

### **Dashboard Overview**
The popup dashboard displays:
- **Current Site**: Domain being analyzed
- **Tracker Count**: Number of tracking requests blocked
- **Fingerprint Attempts**: Canvas, WebGL, and device fingerprinting detected
- **Storage Access**: Local storage and cookie monitoring
- **PII Detections**: Personal information extraction attempts

### **Advanced Controls**
- **Right-click Menu**: "Clear Privacy Session Data" to reset site tracking
- **Logs Access**: Event logs stored in `logs/events.json` for detailed analysis
- **Custom Rules**: Modify `rules/combined_rules.json` for personalized protection

## 🔧 Configuration

### **Privacy Rules** (`rules/combined_rules.json`)
```json
{
  "version": "3.0",
  "tracker_domains": [...],
  "fingerprinting_domains": [...],
  "pii_patterns": [...],
  "actions": {
    "proxy": "sanitize",
    "extension": "block"
  }
}
```

### **Proxy Actions**
- **`log`**: Monitor and record threats without blocking
- **`sanitize`**: Remove tracking parameters while allowing requests
- **`block`**: Completely block malicious requests

### **Extension Permissions**
- **`webRequest`**: Monitor network requests for privacy threats
- **`storage`**: Save session data and configuration locally
- **`activeTab`**: Access current page for real-time analysis
- **`contextMenus`**: Provide right-click privacy controls

## 📈 Privacy Intelligence

### **Detection Capabilities**

| Category | Detection Method | Examples |
|----------|------------------|----------|
| **Trackers** | Domain-based blocking | Google Analytics, Facebook Pixel, Amazon tracking |
| **Fingerprinting** | API usage monitoring | Canvas fingerprinting, WebGL profiling, Audio context |
| **PII Extraction** | Form analysis & regex | Email harvesting, phone collection, address scraping |
| **Storage Abuse** | LocalStorage monitoring | Excessive cookie creation, storage-based tracking |

### **Rule Sources**
- **52,602+ Tracker Domains** from leading privacy organizations
- **78 Fingerprinting APIs** based on browser security research
- **71 PII Patterns** covering common personal data types
- **40 Tracking Parameters** from major advertising platforms

## 🔒 Privacy & Security

- **Local Processing**: All analysis happens on your device
- **No Data Upload**: Privacy findings are stored locally only
- **Open Source**: Complete transparency in privacy protection methods
- **Configurable**: Adjust protection levels to match your privacy needs

## 🛠️ Development

### **Project Structure**
```
privacy-guard/
├── manifest.json          # Extension manifest
├── background.js          # Extension background scripts
├── content.js            # Page injection scripts
├── popup.html/js         # Extension popup interface
├── proxy.py              # Python traffic interceptor
├── update_trackers.py    # Rule update automation
├── rules/
│   └── combined_rules.json # Privacy protection rules
├── logs/
│   └── events.json       # Privacy event logging
└── icons/                # Extension icons
```

### **Contributing**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Implement changes with tests
4. Submit a pull request with detailed description

### **Testing**
```bash
# Test proxy functionality
python -m pytest tests/

# Validate extension in browser
# Load extension in developer mode and check console logs
```

## 📊 Analytics & Reporting

Privacy Guard maintains detailed analytics about your browsing privacy:

- **Threat Timeline**: Chronological view of privacy threats encountered
- **Site Analysis**: Per-domain breakdown of tracking and fingerprinting attempts
- **PII Leakage Reports**: Analysis of personal data sharing patterns
- **Protection Efficacy**: Statistics on threats blocked vs. detected

Access logs at: `logs/events.json` or through the extension popup dashboard.

## ⚠️ Known Limitations

- **HTTPS Proxy**: Requires certificate installation for full HTTPS interception
- **Performance Impact**: Minimal but measurable latency on network requests
- **Site Compatibility**: Some sites may not function properly with aggressive blocking enabled
- **Mobile Support**: Currently desktop browsers only

## 🆘 Support

### **Common Issues**
- **Extension not loading**: Check browser developer mode is enabled
- **Proxy connection failed**: Verify Python server is running on port 8080
- **No detections showing**: Ensure content scripts are injecting properly

### **Debug Mode**
Enable verbose logging by setting `console.log` level in browser developer tools.

## 📜 License

This project is licensed under the Open Source License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **DuckDuckGo**: Tracker Radar database
- **EasyList**: Privacy filter lists
- **Disconnect.me**: Tracker identification
- **Mozilla**: Web API security research
- **Electronic Frontier Foundation**: Privacy advocacy and research

---

**Note**: Privacy Guard is designed for educational and personal privacy protection purposes. Users are responsible for compliance with applicable laws and website terms of service.

**Version**: 2.0 | **Last Updated**: July 2025
