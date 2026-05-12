import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
}

base_url = "https://englishchessclubs.org.uk/wp-json/wp/v2"

# Let's check available types
try:
    r = requests.get(base_url + "/types", headers=headers, timeout=10)
    print("Types Endpoint Status:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        print("Available Post Types:", list(data.keys()))
except Exception as e:
    print("Failed probing types:", e)
