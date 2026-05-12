import urllib.request

url = 'https://weblet.azolve.com/Gateway/BootUp/ECF'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    print(html[:2000])
except Exception as e:
    print("Failed:", e)
