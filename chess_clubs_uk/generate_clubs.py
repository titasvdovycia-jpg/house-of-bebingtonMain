import time
import json
import random
from duckduckgo_search import DDGS

counties = [
    "London", "Greater Manchester", "West Midlands", "West Yorkshire",
    "Merseyside", "South Yorkshire", "Tyne and Wear", "Lancashire",
    "Cheshire", "Surrey", "Kent", "Essex", "Hampshire", "Devon", 
    "Nottinghamshire", "Derbyshire", "Bristol", "Oxfordshire", "Cambridgeshire"
]

all_clubs = []
club_id = 15 # Starting after the ones we already have
added_names = set()

# Seed geographic coordinates roughly per county to spread them out
county_coords = {
    "London": (51.5074, -0.1278), "Greater Manchester": (53.4808, -2.2426),
    "West Midlands": (52.4862, -1.8904), "West Yorkshire": (53.8008, -1.5491),
    "Merseyside": (53.4084, -2.9916), "South Yorkshire": (53.3811, -1.4701),
    "Tyne and Wear": (54.9783, -1.6174), "Lancashire": (53.7632, -2.7034),
    "Cheshire": (53.2326, -2.4923), "Surrey": (51.3148, -0.5600),
    "Kent": (51.2787, 0.5217), "Essex": (51.7343, 0.4691),
    "Hampshire": (51.0577, -1.3080), "Devon": (50.7156, -3.5309),
    "Nottinghamshire": (52.9548, -1.1581), "Derbyshire": (52.9225, -1.4746),
    "Bristol": (51.4545, -2.5879), "Oxfordshire": (51.7520, -1.2577),
    "Cambridgeshire": (52.2053, 0.1218)
}

try:
    with DDGS() as ddgs:
        for county in counties:
            print(f"Searching for clubs in {county}...")
            query = f"chess clubs in {county} address"
            
            try:
                results = list(ddgs.text(query, max_results=5))
                for res in results:
                    snippet = res.get('body', '') + " " + res.get('title', '')
                    
                    # Very simple heuristic: look for "Chess Club" in title or snippet
                    if "Chess Club" in snippet or "chess club" in snippet.lower():
                        # Make up a club name from the first few words or title
                        words = res.get('title', '').split()
                        name_idx = max(res.get('title', '').lower().find("chess"), 0)
                        club_name = res.get('title', '')[:name_idx+5].strip()
                        if len(club_name) < 5 or not club_name[0].isalpha():
                            club_name = f"{county} Local Chess Club"
                        if not club_name.lower().endswith("club"):
                            club_name += " Club"
                            
                        # Avoid duplicates
                        if club_name in added_names:
                            continue
                        added_names.add(club_name)
                        
                        # Generate some fuzz for coordinates
                        base_lat, base_lng = county_coords.get(county, (52.5, -1.5))
                        lat = base_lat + random.uniform(-0.15, 0.15)
                        lng = base_lng + random.uniform(-0.15, 0.15)
                        
                        club = {
                            "id": club_id,
                            "name": club_name,
                            "lat": round(lat, 4),
                            "lng": round(lng, 4),
                            "address": f"Local Venue, {county}",
                            "lmsId": f"UK-{club_id}",
                            "ratingType": ["ECF"],
                            "avgRating": random.randint(1300, 1900),
                            "ageGroups": ["Adult", "Senior"] if random.random() > 0.3 else ["Junior", "Adult", "Senior"],
                            "description": snippet[:100] + "...",
                            "website": res.get('href', ''),
                            "email": None,
                            "phone": None,
                            "meetingInfo": "Weekly evening meeting",
                            "county": county,
                            "events": []
                        }
                        all_clubs.append(club)
                        club_id += 1
            except Exception as inner_e:
                print(f"Search failed for {county}: {inner_e}")
                
            time.sleep(2) # avoid rate limits
            
    with open("generated_clubs.json", "w") as f:
        json.dump(all_clubs, f, indent=4)
        
    print(f"Successfully generated {len(all_clubs)} clubs!")

except Exception as e:
    print("Fatal error:", e)
