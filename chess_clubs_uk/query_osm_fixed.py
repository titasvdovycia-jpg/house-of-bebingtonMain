import urllib.request
import urllib.parse
import json

overpass_url = "https://overpass-api.de/api/interpreter"
query = """
[out:json][timeout:25];
area["ISO3166-1"="GB"][admin_level=2]->.searchArea;
(
  node["sport"="chess"](area.searchArea);
  way["sport"="chess"](area.searchArea);
  node["club"="chess"](area.searchArea);
  way["club"="chess"](area.searchArea);
  node["leisure"="club"]["sport"="chess"](area.searchArea);
);
out center;
"""

try:
    encoded_query = urllib.parse.urlencode({'data': query})
    req_url = f"{overpass_url}?{encoded_query}"
    
    req = urllib.request.Request(req_url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    
    elements = data.get('elements', [])
    print(f"Found {len(elements)} chess clubs in OSM!")
    
    with open('osm_clubs.json', 'w', encoding='utf-8') as f:
        json.dump(elements, f, indent=4)
        
except Exception as e:
    print("Error:", e)
