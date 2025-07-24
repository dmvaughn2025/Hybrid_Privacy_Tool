from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta

LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs", "events.json")

app = Flask(__name__)

# Enable CORS for all routes and origins
CORS(app, resources={
    r"/*": {
        "origins": ["moz-extension://*", "chrome-extension://*", "*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# === Unified event processing ===
def normalize_event(event):
    """Normalize events from different sources (proxy vs extension)"""
    normalized = {
        "timestamp": event.get("timestamp", datetime.now().isoformat()),
        "visited_site": event.get("visited_site", event.get("url", "unknown")).lower().strip(),
        "hostname": event.get("hostname", event.get("url", "unknown")).lower(),
        "session": event.get("session", ""),
        "tracker": event.get("tracker", False),
        "pii": event.get("pii", False),
        "pii_types": event.get("pii_types", []),
        "fingerprinting": event.get("fingerprinting", False),
        "storage": event.get("storage", False),
        "source": event.get("source", "extension"),
        "detail": event.get("detail", ""),
        "type": event.get("type", "")
    }
    
    # Handle extension-specific event types
    if normalized["type"] == "fingerprinting":
        normalized["fingerprinting"] = True
    elif normalized["type"] == "storage":
        normalized["storage"] = True
    elif normalized["type"] == "pii":
        normalized["pii"] = True
    
    # Clean up visited_site
    if normalized["visited_site"].startswith("www."):
        normalized["visited_site"] = normalized["visited_site"][4:]
    
    return normalized

# === Load and aggregate site statistics ===
def load_site_stats(hours_limit=24):
    """Load site statistics with optional time filtering"""
    if not os.path.exists(LOG_PATH):
        print(f"[ERROR] Log file not found: {LOG_PATH}")
        return {}

    print(f"[INFO] Reading from: {LOG_PATH}")
    stats = defaultdict(lambda: {
        "tracker": 0, 
        "pii": 0, 
        "fingerprinting": 0, 
        "storage": 0,
        "trackers": set(),
        "pii_types": set(),
        "fingerprint_apis": set(),
        "storage_methods": set(),
        "last_seen": None,
        "sessions": set(),
        "unique_events": set()  # Track unique events to avoid duplicates
    })
    
    cutoff_time = datetime.now() - timedelta(hours=hours_limit) if hours_limit else None
    
    with open(LOG_PATH, "r") as f:
        for line in f:
            try:
                event = json.loads(line.strip())
                event = normalize_event(event)
                
                # Time filtering
                if cutoff_time:
                    try:
                        event_time = datetime.fromisoformat(event["timestamp"].replace('Z', '+00:00'))
                        if event_time < cutoff_time:
                            continue
                    except:
                        continue
                
                site = event["visited_site"]
                site_stats = stats[site]
                
                # Create unique event identifier to avoid duplicates
                event_key = f"{event['hostname']}_{event['type']}_{event.get('detail', '')}"
                
                # Skip if we've already counted this exact event
                if event_key in site_stats["unique_events"]:
                    continue
                
                site_stats["unique_events"].add(event_key)
                
                # Update counters and details
                if event["tracker"]:
                    site_stats["tracker"] += 1
                    site_stats["trackers"].add(event["hostname"])
                
                if event["pii"]:
                    site_stats["pii"] += 1
                    site_stats["pii_types"].update(event.get("pii_types", []))
                
                if event["fingerprinting"]:
                    site_stats["fingerprinting"] += 1
                    site_stats["fingerprint_apis"].add(event.get("detail", "unknown"))
                
                if event["storage"]:
                    site_stats["storage"] += 1
                    site_stats["storage_methods"].add(event.get("detail", "unknown"))
                
                # Track sessions and timing
                if event["session"]:
                    site_stats["sessions"].add(event["session"])
                site_stats["last_seen"] = event["timestamp"]
                
            except Exception as e:
                print(f"[Error] Failed to parse line: {line.strip()}")
                print(f"Reason: {e}")
                continue

    # Convert sets to lists for JSON serialization and remove unique_events
    for site_stats in stats.values():
        site_stats["trackers"] = list(site_stats["trackers"])
        site_stats["pii_types"] = list(site_stats["pii_types"])
        site_stats["fingerprint_apis"] = list(site_stats["fingerprint_apis"])
        site_stats["storage_methods"] = list(site_stats["storage_methods"])
        site_stats["sessions"] = list(site_stats["sessions"])
        site_stats["session_count"] = len(site_stats["sessions"])
        del site_stats["unique_events"]  # Remove from output

    print(f"\n🔍 Detected {len(stats)} sites in last {hours_limit} hours:")
    for site_key, site_data in stats.items():
        total = site_data["tracker"] + site_data["pii"] + site_data["fingerprinting"] + site_data["storage"]
        print(f"  - [{site_key}]: {total} threats")
    return dict(stats)

def generate_site_summary(site_data):
    """Generate a human-readable summary for the site"""
    parts = []
    
    if site_data["tracker"] > 0:
        parts.append(f"{site_data['tracker']} trackers detected")
    
    if site_data["pii"] > 0:
        pii_types = site_data.get("pii_types", [])
        if pii_types:
            parts.append(f"PII extracted: {', '.join(pii_types[:3])}")
        else:
            parts.append("PII extraction detected")
    
    if site_data["fingerprinting"] > 0:
        parts.append("fingerprinting detected")
    
    if site_data["storage"] > 0:
        parts.append("local storage accessed")
    
    if not parts:
        return "No privacy issues detected"
    
    return ", ".join(parts).capitalize()

@app.route("/latest")
def latest():
    """Get latest site statistics (last 24 hours)"""
    print(f"[API] /latest endpoint called")
    stats = load_site_stats(24)
    print(f"[API] Returning stats for {len(stats)} sites")
    return jsonify(stats)

@app.route("/current/<hostname>")
def current_site_session(hostname):
    """Get current session data for active browsing"""
    print(f"[API] /current/{hostname} endpoint called")
    
    # Normalize hostname
    normalized_hostname = hostname.lower()
    if normalized_hostname.startswith("www."):
        normalized_hostname = normalized_hostname[4:]
    
    stats = load_site_stats(1)  # Last hour only
    
    # Try both original and normalized hostname
    site_data = stats.get(hostname.lower(), stats.get(normalized_hostname, {
        "tracker": 0, "pii": 0, "fingerprinting": 0, "storage": 0,
        "trackers": [], "pii_types": [], "fingerprint_apis": [], 
        "storage_methods": [], "sessions": [], "session_count": 0
    }))
    
    # Add summary message
    site_data["summary"] = generate_site_summary(site_data)
    
    print(f"[API] Returning data for {hostname}: {site_data}")
    return jsonify(site_data)

@app.route("/log", methods=["POST", "OPTIONS"])
def log_event():
    """Accept events from browser extension"""
    # Handle preflight OPTIONS request
    if request.method == "OPTIONS":
        return "", 200
    
    try:
        event = request.get_json()
        if not event:
            return jsonify({"error": "No JSON data provided"}), 400

        print(f"[API] Received event: {event}")

        # Normalize and enhance event
        enhanced_event = normalize_event(event)
        enhanced_event["timestamp"] = datetime.now().isoformat()
        enhanced_event["source"] = "extension"

        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(enhanced_event) + "\n")

        print(f"[API] Logged event: {enhanced_event}")
        return jsonify({"status": "logged", "normalized": enhanced_event}), 200

    except Exception as e:
        print(f"[API] Error logging event: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/clear", methods=["POST", "OPTIONS"])
def clear_logs():
    """Clear event logs (for testing)"""
    if request.method == "OPTIONS":
        return "", 200
        
    try:
        if os.path.exists(LOG_PATH):
            os.remove(LOG_PATH)
        print("[API] Logs cleared")
        return jsonify({"status": "cleared"}), 200
    except Exception as e:
        print(f"[API] Error clearing logs: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/debug/<hostname>")
def debug_site(hostname):
    """Debug endpoint to see raw data for a site"""
    print(f"[DEBUG] Debug endpoint called for {hostname}")
    
    if not os.path.exists(LOG_PATH):
        return jsonify({"error": "No log file found"})
    
    events = []
    with open(LOG_PATH, "r") as f:
        for line in f:
            try:
                event = json.loads(line.strip())
                if hostname.lower() in event.get("visited_site", "").lower() or \
                   hostname.lower() in event.get("hostname", "").lower():
                    events.append(event)
            except:
                continue
    
    return jsonify({
        "hostname": hostname,
        "total_events": len(events),
        "recent_events": events[-10:],  # Last 10 events
        "log_file": LOG_PATH
    })

if __name__ == "__main__":
    print("[SERVER] Starting Privacy Guard Flask API with enhanced CORS...")
    print(f"[SERVER] Log file: {LOG_PATH}")
    app.run(host='127.0.0.1', port=8081, debug=True)
