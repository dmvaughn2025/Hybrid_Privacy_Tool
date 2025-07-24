#!/usr/bin/env python3
"""
Enhanced Tracker List Updater for Privacy Guard - Centralized Rules Edition
Downloads and integrates major privacy tracker lists into centralized rules.json
"""

import requests
import json
import re
import time
import shutil
from urllib.parse import urlparse
from datetime import datetime, timedelta

class EnhancedTrackerListUpdater:
    def __init__(self, rules_file="rules/combined_rules.json"):
        self.rules_file = rules_file
        self.new_domains = set()
        self.backup_dir = "rules/backups"
        
    def create_backup(self):
        """Create backup of current rules file"""
        import os
        os.makedirs(self.backup_dir, exist_ok=True)
        
        if os.path.exists(self.rules_file):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = f"{self.backup_dir}/combined_rules_{timestamp}.json"
            shutil.copy2(self.rules_file, backup_file)
            print(f"📁 Created backup: {backup_file}")
            
            # Keep only last 5 backups
            backups = sorted([f for f in os.listdir(self.backup_dir) if f.startswith("combined_rules_")])
            if len(backups) > 5:
                for old_backup in backups[:-5]:
                    os.remove(os.path.join(self.backup_dir, old_backup))
                    print(f"🗑️ Removed old backup: {old_backup}")
    
    def load_existing_rules(self):
        """Load existing rules file"""
        try:
            with open(self.rules_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print("⚠️ Rules file not found, will create new one")
            return self.get_default_rules()
    
    def get_default_rules(self):
        """Return default rules structure"""
        return {
            "version": "3.0",
            "last_updated": datetime.now().isoformat(),
            "auto_update_enabled": True,
            "tracker_domains": [],
            "pii_patterns": [],
            "pii_regex_patterns": {},
            "fingerprinting_apis": [],
            "storage_watch": [],
            "suspicious_form_fields": [],
            "tracking_parameters": [],
            "actions": {"proxy": "sanitize", "extension": "block"},
            "auto_update": {"enabled": True, "last_update": None},
            "statistics": {},
            "metadata": {"created_by": "Privacy Guard Enhanced"}
        }
    
    def download_duckduckgo_trackers(self):
        """Download DuckDuckGo Tracker Radar database"""
        print("📡 Downloading DuckDuckGo Tracker Radar...")
        try:
            response = requests.get(
                "https://staticcdn.duckduckgo.com/trackerblocking/v4/tds.json", 
                timeout=30,
                headers={'User-Agent': 'PrivacyGuard/3.0 (Educational Research)'}
            )
            response.raise_for_status()
            data = response.json()
            
            trackers = data.get("trackers", {})
            added_count = 0
            for domain, info in trackers.items():
                clean_domain = self.extract_main_domain(domain)
                if clean_domain and clean_domain not in self.new_domains:
                    self.new_domains.add(clean_domain)
                    added_count += 1
                    
            print(f"✅ DuckDuckGo: Added {added_count} new domains")
            return True
            
        except Exception as e:
            print(f"❌ Failed to download DuckDuckGo list: {e}")
            return False
    
    def download_disconnect_trackers(self):
        """Download Disconnect.me tracker list"""
        print("📡 Downloading Disconnect.me tracker list...")
        try:
            response = requests.get(
                "https://services.disconnect.me/disconnect-plaintext.json", 
                timeout=30,
                headers={'User-Agent': 'PrivacyGuard/3.0 (Educational Research)'}
            )
            response.raise_for_status()
            data = response.json()
            
            added_count = 0
            # Parse Disconnect's nested structure
            categories = data.get("categories", {})
            for category_name, category_data in categories.items():
                if isinstance(category_data, list):
                    for item in category_data:
                        if isinstance(item, dict):
                            for company, domains in item.items():
                                if isinstance(domains, dict):
                                    for domain_list in domains.values():
                                        if isinstance(domain_list, list):
                                            for domain in domain_list:
                                                clean_domain = self.extract_main_domain(domain)
                                                if clean_domain and clean_domain not in self.new_domains:
                                                    self.new_domains.add(clean_domain)
                                                    added_count += 1
                                                    
            print(f"✅ Disconnect.me: Added {added_count} new domains")
            return True
            
        except Exception as e:
            print(f"❌ Failed to download Disconnect list: {e}")
            return False
    
    def download_easyprivacy_list(self):
        """Download EasyPrivacy filter list"""
        print("📡 Downloading EasyPrivacy list...")
        try:
            response = requests.get(
                "https://easylist.to/easylist/easyprivacy.txt", 
                timeout=30,
                headers={'User-Agent': 'PrivacyGuard/3.0 (Educational Research)'}
            )
            response.raise_for_status()
            content = response.text
            
            added_count = 0
            # Parse AdBlock Plus filter format
            for line in content.split('\n'):
                line = line.strip()
                if line and not line.startswith('!') and not line.startswith('['):
                    # Extract domains from filter rules
                    domain = self.extract_domain_from_filter(line)
                    if domain:
                        clean_domain = self.extract_main_domain(domain)
                        if clean_domain and clean_domain not in self.new_domains:
                            self.new_domains.add(clean_domain)
                            added_count += 1
                            
            print(f"✅ EasyPrivacy: Added {added_count} new domains")
            return True
            
        except Exception as e:
            print(f"❌ Failed to download EasyPrivacy list: {e}")
            return False
    
    def extract_domain_from_filter(self, filter_rule):
        """Extract domain from AdBlock Plus filter rule"""
        # Remove filter syntax
        rule = filter_rule.replace('||', '').replace('^', '').replace('*', '')
        rule = rule.split('$')[0]  # Remove filter options
        
        # Remove paths and parameters
        if '/' in rule:
            rule = rule.split('/')[0]
        if '?' in rule:
            rule = rule.split('?')[0]
        if ':' in rule and not rule.startswith('http'):
            rule = rule.split(':')[0]
            
        # Basic domain validation
        if '.' in rule and not rule.startswith('.') and len(rule) > 3:
            return rule.lower()
        return None
    
    def extract_main_domain(self, domain):
        """Extract main domain from subdomain"""
        if not domain or not isinstance(domain, str):
            return None
            
        domain = domain.lower().strip()
        
        # Remove protocol if present
        if '://' in domain:
            domain = domain.split('://')[1]
        
        # Remove path if present
        if '/' in domain:
            domain = domain.split('/')[0]
        
        # Remove port if present
        if ':' in domain:
            domain = domain.split(':')[0]
        
        # Basic validation
        if not domain or '.' not in domain or len(domain) < 4:
            return None
            
        # Skip localhost and IP addresses
        if domain in ['localhost', '127.0.0.1'] or domain.replace('.', '').replace(':', '').isdigit():
            return None
            
        # Skip if it contains spaces or invalid characters
        if ' ' in domain or any(char in domain for char in ['<', '>', '"', "'"]):
            return None
            
        return domain
    
    def calculate_statistics(self, rules):
        """Calculate and update statistics"""
        stats = {
            "total_tracker_domains": len(rules.get("tracker_domains", [])),
            "total_pii_patterns": len(rules.get("pii_patterns", [])),
            "total_pii_regex_patterns": len(rules.get("pii_regex_patterns", {})),
            "total_fingerprint_apis": len(rules.get("fingerprinting_apis", [])),
            "total_storage_methods": len(rules.get("storage_watch", [])),
            "total_suspicious_form_fields": len(rules.get("suspicious_form_fields", [])),
            "total_tracking_parameters": len(rules.get("tracking_parameters", [])),
            "user_discovered_domains": 11,  # From AdBlock Plus analysis
            "auto_discovered_domains": len(self.new_domains),
            "last_calculated": datetime.now().isoformat()
        }
        return stats
    
    def update_rules_file(self):
        """Update the rules file with new domains and statistics"""
        print("📝 Updating centralized rules file...")
        
        # Create backup first
        self.create_backup()
        
        # Load existing rules
        rules = self.load_existing_rules()
        existing_domains = set(rules.get("tracker_domains", []))
        
        # Remove existing domains to get only new ones
        truly_new_domains = self.new_domains - existing_domains
        
        # Update the tracker domains list
        all_domains = sorted(list(existing_domains.union(self.new_domains)))
        rules["tracker_domains"] = all_domains
        
        # Update metadata
        rules["last_updated"] = datetime.now().isoformat()
        rules["version"] = "3.0"
        
        # Update auto_update section
        if "auto_update" not in rules:
            rules["auto_update"] = {}
        rules["auto_update"]["last_update"] = datetime.now().isoformat()
        rules["auto_update"]["next_update"] = (datetime.now() + timedelta(hours=24)).isoformat()
        
        # Update statistics
        rules["statistics"] = self.calculate_statistics(rules)
        
        # Save updated rules
        with open(self.rules_file, 'w') as f:
            json.dump(rules, f, indent=2, sort_keys=False)
            
        print(f"✅ Updated centralized rules file:")
        print(f"   📊 Total domains: {len(all_domains)}")
        print(f"   🆕 Newly added: {len(truly_new_domains)}")
        print(f"   📋 Total PII patterns: {rules['statistics']['total_pii_patterns']}")
        print(f"   🔍 Total fingerprint APIs: {rules['statistics']['total_fingerprint_apis']}")
        print(f"   💾 Total storage methods: {rules['statistics']['total_storage_methods']}")
        
        return truly_new_domains
    
    def validate_rules_file(self):
        """Validate the updated rules file"""
        try:
            with open(self.rules_file, 'r') as f:
                rules = json.load(f)
            
            required_sections = [
                "tracker_domains", "pii_patterns", "pii_regex_patterns",
                "fingerprinting_apis", "storage_watch", "actions"
            ]
            
            missing_sections = [section for section in required_sections if section not in rules]
            if missing_sections:
                print(f"⚠️ Warning: Missing sections: {missing_sections}")
                return False
            
            print("✅ Rules file validation passed")
            return True
            
        except Exception as e:
            print(f"❌ Rules file validation failed: {e}")
            return False
    
    def run_update(self):
        """Run the complete update process"""
        print("🚀 Starting Privacy Guard centralized rules update...")
        print("=" * 60)
        
        start_time = time.time()
        
        # Download from major sources
        sources_success = []
        if self.download_duckduckgo_trackers():
            sources_success.append("DuckDuckGo")
        if self.download_disconnect_trackers():
            sources_success.append("Disconnect.me") 
        if self.download_easyprivacy_list():
            sources_success.append("EasyPrivacy")
        
        # Update rules file
        new_domains = self.update_rules_file()
        
        # Validate the updated file
        validation_passed = self.validate_rules_file()
        
        elapsed = time.time() - start_time
        print("=" * 60)
        print(f"✅ Update completed in {elapsed:.1f} seconds")
        print(f"📡 Successful sources: {', '.join(sources_success)}")
        print(f"✅ Validation: {'Passed' if validation_passed else 'Failed'}")
        
        if new_domains:
            print(f"\n🆕 Sample of newly added domains:")
            for domain in sorted(list(new_domains))[:10]:
                print(f"   • {domain}")
            if len(new_domains) > 10:
                print(f"   ... and {len(new_domains) - 10} more")
        
        print(f"\n📋 Next steps:")
        print(f"   1. Restart mitmproxy: mitmdump -s proxy.py -p 8080")
        print(f"   2. Test with: curl http://localhost:8081/latest")
        print(f"   3. Visit tracking-heavy sites to test detection")
        
        return len(new_domains), validation_passed

def main():
    updater = EnhancedTrackerListUpdater()
    new_domains_count, validation_passed = updater.run_update()
    
    if validation_passed and new_domains_count > 0:
        print(f"\n🎉 Successfully updated with {new_domains_count} new tracker domains!")
    elif validation_passed:
        print(f"\n✅ Rules file is up to date.")
    else:
        print(f"\n⚠️ Update completed but validation failed. Check the rules file.")

if __name__ == "__main__":
    main()
