import os
import json
import re
import urllib.parse
from mitmproxy import http
from datetime import datetime

# === Configuration ===
RULES_PATH = "rules/combined_rules.json"
LOG_PATH = "logs/events.json"

class PrivacyRules:
    def __init__(self, rules_path=RULES_PATH):
        self.rules_path = rules_path
        self.load_rules()
    
    def load_rules(self):
        """Load and compile all rules from centralized file"""
        if not os.path.exists(self.rules_path):
            raise FileNotFoundError(f"Rules file not found at: {self.rules_path}")
        
        with open(self.rules_path, "r") as f:
            try:
                self.rules = json.load(f)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in rules file: {e}")
        
        # Load tracker domains
        self.tracker_domains = set(self.rules.get("tracker_domains", []))
        
        # Load fingerprinting domains
        self.fingerprinting_domains = set(self.rules.get("fingerprinting_domains", []))
        
        # Load PII patterns
        self.pii_patterns = [p.lower() for p in self.rules.get("pii_patterns", [])]
        
        # Compile regex patterns from rules
        self.pii_regex_patterns = {}
        pii_regex = self.rules.get("pii_regex_patterns", {})
        for name, pattern in pii_regex.items():
            try:
                self.pii_regex_patterns[name] = re.compile(pattern, re.IGNORECASE)
            except re.error as e:
                print(f"Warning: Invalid regex pattern for {name}: {e}")
        
        # Load suspicious form fields
        self.suspicious_form_fields = self.rules.get("suspicious_form_fields", [])
        
        # Load tracking parameters  
        self.tracking_parameters = self.rules.get("tracking_parameters", [])
        
        # Load actions
        self.proxy_action = self.rules.get("actions", {}).get("proxy", "log")
        
        # Fingerprinting detection patterns
        self.fingerprinting_url_patterns = [
            "fingerprint", "fp-collect", "device-id", "browser-id", "client-id",
            "visitor-id", "canvas-hash", "webgl-hash", "digital-fingerprint"
        ]
        
        self.fingerprinting_params = [
            "canvas_hash", "webgl_vendor", "webgl_renderer", "screen_resolution",
            "timezone_offset", "browser_plugins", "font_list", "hardware_concurrency",
            "device_memory", "user_agent_hash", "audio_hash", "client_rects",
            "touch_support", "webgl_params", "canvas_fingerprint", "audio_fingerprint"
        ]
        
        self.suspicious_domain_patterns = [
            "googletourist", "googleanalytic", "facebookcdn", "twitterapi",
            "amazonapi", "microsoftapi"
        ]
        
        print(f"📋 Loaded rules: {len(self.tracker_domains)} tracker domains, "
              f"{len(self.pii_patterns)} PII patterns, {len(self.pii_regex_patterns)} regex patterns, "
              f"{len(self.fingerprinting_domains)} fingerprinting domains")
    
    def is_tracker_domain(self, hostname):
        """Check if hostname is a known tracker"""
        hostname = hostname.lower()
        return any(hostname == d or hostname.endswith(f".{d}") for d in self.tracker_domains)
    
    def detect_fingerprinting(self, url, body, headers):
        """Detect fingerprinting attempts in requests"""
        url_lower = url.lower()
        body_lower = body.lower() if body else ""
        hostname = url_lower.split('/')[2] if '//' in url_lower else url_lower.split('/')[0]
        
        # Check if request is to a known fingerprinting service
        for domain in self.fingerprinting_domains:
            if domain in hostname:
                return True, f"fingerprinting_service_{domain}"
        
        # Check for suspicious domain patterns
        for pattern in self.suspicious_domain_patterns:
            if pattern in hostname and not any(legit in hostname for legit in ['google.com', 'facebook.com', 'twitter.com']):
                return True, f"suspicious_domain_{pattern}"
        
        # Check URL for fingerprinting patterns
        for pattern in self.fingerprinting_url_patterns:
            if pattern in url_lower:
                return True, f"fingerprinting_url_{pattern}"
        
        # Check request body for fingerprinting parameters
        detected_params = []
        for param in self.fingerprinting_params:
            if param in body_lower:
                detected_params.append(param)
        
        if detected_params:
            return True, f"fingerprinting_params_{','.join(detected_params[:3])}"
        
        # Check for suspicious parameter combinations
        fingerprint_indicators = ["canvas", "webgl", "screen", "plugin", "font", "audio"]
        indicator_count = sum(1 for indicator in fingerprint_indicators if indicator in body_lower)
        
        if indicator_count >= 3:  # 3+ indicators suggests fingerprinting
            return True, f"fingerprinting_indicators_{indicator_count}"
        
        return False, None
    
    def detect_pii(self, content, content_type=""):
        """Enhanced PII detection using centralized rules"""
        detected_pii = []
        content_lower = content.lower()
        
        # Check basic patterns from rules
        for pattern in self.pii_patterns:
            if pattern in content_lower:
                detected_pii.append(pattern.replace('=', ''))
        
        # Check regex patterns from rules
        for pii_type, regex in self.pii_regex_patterns.items():
            if regex.search(content):
                detected_pii.append(pii_type)
        
        # Form field analysis
        if 'application/x-www-form-urlencoded' in content_type or 'multipart/form-data' in content_type:
            try:
                parsed_data = urllib.parse.parse_qs(content)
                for field_name in parsed_data.keys():
                    field_lower = field_name.lower()
                    # Check against suspicious form fields from rules
                    for suspicious_field in self.suspicious_form_fields:
                        if suspicious_field in field_lower:
                            detected_pii.append(f"form_field_{field_lower}")
                            break
                    # Legacy checks
                    if any(keyword in field_lower for keyword in ['email', 'phone', 'address', 'name', 'birth', 'ssn']):
                        detected_pii.append(f"form_field_{field_lower}")
            except:
                pass
        
        return list(set(detected_pii))  # Remove duplicates
    
    def detect_tracking_parameters(self, url):
        """Detect tracking parameters in URLs"""
        detected_params = []
        url_lower = url.lower()
        
        for param in self.tracking_parameters:
            if f"{param}=" in url_lower or f"&{param}=" in url_lower:
                detected_params.append(param)
        
        return detected_params
    
    def sanitize_request_body(self, body, content_type):
        """Remove or replace PII data in request bodies"""
        if not body:
            return body
        
        try:
            if 'application/x-www-form-urlencoded' in content_type:
                parsed_data = urllib.parse.parse_qs(body.decode('utf-8', errors='ignore'))
                for field_name, values in parsed_data.items():
                    field_lower = field_name.lower()
                    # Check against suspicious form fields
                    should_redact = any(suspicious in field_lower for suspicious in self.suspicious_form_fields)
                    if should_redact or any(keyword in field_lower for keyword in ['email', 'phone', 'address', 'ssn', 'credit']):
                        parsed_data[field_name] = ['[REDACTED]']
                return urllib.parse.urlencode(parsed_data, doseq=True).encode('utf-8')
        except:
            pass
        
        # For other content types, use regex replacement
        body_str = body.decode('utf-8', errors='ignore')
        for pii_type, regex in self.pii_regex_patterns.items():
            body_str = regex.sub('[REDACTED]', body_str)
        
        return body_str.encode('utf-8')

# Initialize rules
privacy_rules = PrivacyRules()

# === Log Event to File ===
def log_event(event_data):
    os.makedirs("logs", exist_ok=True)
    try:
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(event_data) + "\n")
    except Exception as e:
        print(f"Logging failed: {e}")

# === Request Interception ===
def request(flow: http.HTTPFlow) -> None:
    host = flow.request.host.lower()
    url = flow.request.pretty_url.lower()
    body = flow.request.content.decode(errors="ignore") if flow.request.content else ""
    content_type = flow.request.headers.get("Content-Type", "").lower()
    session_id = flow.request.headers.get("X-PrivacyProxy-Session", "").strip()

    # Get page context from Referer header
    referer = flow.request.headers.get("Referer", "").lower()
    visited_site = ""
    if "://" in referer:
        visited_site = referer.split("://")[1].split("/")[0]
        if visited_site.startswith("www."):
            visited_site = visited_site[4:]

    # Enhanced detection using centralized rules
    matched_domain = privacy_rules.is_tracker_domain(host)
    detected_pii = privacy_rules.detect_pii(body, content_type)
    tracking_params = privacy_rules.detect_tracking_parameters(url)
    has_pii = len(detected_pii) > 0
    
    # NEW: Enhanced fingerprinting detection
    is_fingerprinting, fingerprint_detail = privacy_rules.detect_fingerprinting(url, body, flow.request.headers)

    # Log all threats: trackers, PII, fingerprinting
    if matched_domain or has_pii or tracking_params or is_fingerprinting:
        print(f"\n🔍 Intercepted at: {datetime.now()}")
        print(f"Visited Site: {visited_site or 'Unknown'}")
        print(f"Request Host: {host}")
        print(f"Tracker Domain: {matched_domain}")
        print(f"PII Detected: {detected_pii}")
        print(f"Tracking Params: {tracking_params}")
        print(f"Fingerprinting: {is_fingerprinting} ({fingerprint_detail})")
        print(f"Content Type: {content_type}\n")

        # Log tracker/PII event
        if matched_domain or has_pii or tracking_params:
            log_event({
                "timestamp": datetime.now().isoformat(),
                "visited_site": visited_site or "unknown",
                "hostname": host,
                "url": url,
                "tracker": matched_domain,
                "pii": has_pii,
                "pii_types": detected_pii,
                "tracking_parameters": tracking_params,
                "session": session_id,
                "fingerprinting": False,
                "storage": False,
                "source": "proxy",
                "method": flow.request.method,
                "content_type": content_type
            })
        
        # Log separate fingerprinting event
        if is_fingerprinting:
            log_event({
                "timestamp": datetime.now().isoformat(),
                "visited_site": visited_site or "unknown",
                "hostname": host,
                "url": url,
                "tracker": False,
                "pii": False,
                "pii_types": [],
                "session": session_id,
                "fingerprinting": True,
                "fingerprint_type": fingerprint_detail,
                "storage": False,
                "source": "proxy",
                "method": flow.request.method,
                "content_type": content_type
            })

        # Handle actions based on rules
        if privacy_rules.proxy_action == "block" and matched_domain:
            flow.response = http.Response.make(
                403,
                b"Blocked by Privacy Tool - Tracking domain detected.",
                {"Content-Type": "text/plain"}
            )
            return

        # Sanitize PII in requests to third parties
        if has_pii and matched_domain:
            print(f"🛡️ Sanitizing PII in request to {host}")
            flow.request.content = privacy_rules.sanitize_request_body(flow.request.content, content_type)
            # Update content-length header
            flow.request.headers["Content-Length"] = str(len(flow.request.content))

# === Response Interception ===
def response(flow: http.HTTPFlow) -> None:
    """Analyze responses for tracking pixels, scripts, etc."""
    if flow.response.status_code == 200:
        content_type = flow.response.headers.get("Content-Type", "").lower()
        
        # Check for tracking pixels (1x1 images)
        if "image" in content_type and len(flow.response.content) < 100:
            session_id = flow.request.headers.get("X-PrivacyProxy-Session", "").strip()
            referer = flow.request.headers.get("Referer", "").lower()
            visited_site = ""
            if "://" in referer:
                visited_site = referer.split("://")[1].split("/")[0]
                if visited_site.startswith("www."):
                    visited_site = visited_site[4:]
            
            log_event({
                "timestamp": datetime.now().isoformat(),
                "visited_site": visited_site or "unknown",
                "hostname": flow.request.host.lower(),
                "url": flow.request.pretty_url.lower(),
                "tracker": True,
                "pii": False,
                "pii_types": [],
                "session": session_id,
                "fingerprinting": False,
                "storage": False,
                "source": "proxy",
                "method": "tracking_pixel",
                "content_type": content_type
            })
