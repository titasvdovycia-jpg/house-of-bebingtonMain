import requests
import re
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

base_url = "https://englishchessclubs.org.uk/"

try:
    r = requests.get(base_url, headers=headers, timeout=10)
    html = r.text
    # Search for json blobs embedded in script tags
    jsons = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE)
    print(f"Found {len(jsons)} script tags")
    
    found_data = False
    for i, script in enumerate(jsons):
        if 'lat' in script.lower() and 'lng' in script.lower() or 'var ' in script:
            # Check length to see if it's substantial
            if len(script) > 500:
                print(f"Possible data in script {i}, len {len(script)}")
                print(script[:500] + "...")
                found_data = True
                
    if not found_data:
        print("No massive embedded data object found.")
        
except Exception as e:
    print("Failed:", e)
