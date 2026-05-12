import requests
import re

url = "https://ecflms.org.uk/lms/node"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

try:
    r = requests.get(url, headers=headers)
    print("Status:", r.status_code)
    html = r.text
    # Search for links that might be clubs
    club_links = re.findall(r'href="([^"]+)"[^>]*>([^<]+)Chess Club([^<]*)<', html, re.IGNORECASE)
    print(f"Found {len(club_links)} club links")
except Exception as e:
    print("Error:", e)
