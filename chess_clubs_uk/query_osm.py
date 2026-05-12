import requests
import json

overpass_url = "http://overpass-api.de/api/interpreter"
overpass_query = """
[out:json];
area["ISO3166-1"="GB"][admin_level=2]->.searchArea;
(
  node["sport"="chess"](area.searchArea);
  way["sport"="chess"](area.searchArea);
  relation["sport"="chess"](area.searchArea);
  node["club"="chess"](area.searchArea);
  way["club"="chess"](area.searchArea);
  relation["club"="chess"](area.searchArea);
  node["leisure"="club"]["sport"="chess"](area.searchArea);
  node["name"~"(?i)chess club"](area.searchArea);
  way["name"~"(?i)chess club"](area.searchArea);
);
out center;
"""

try:
    response = requests.post(overpass_url, data={'data': overpass_query}, timeout=30)
    data = response.json()
    elements = data.get('elements', [])
    print(f"Found {len(elements)} chess clubs in OSM!")
    
    with open('osm_clubs.json', 'w') as f:
        json.dump(elements, f)
        
    for el in elements[:5]:
        name = el.get('tags', {}).get('name', 'Unknown')
        print(name)
        
except Exception as e:
    print("Error:", e)
