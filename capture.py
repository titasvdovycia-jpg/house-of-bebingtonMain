import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 800, 'height': 800})
        page = await context.new_page()
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Ensure directory exists
        os.makedirs(os.path.join(base_dir, 'assets', 'screenshots'), exist_ok=True)
        
        print("Capturing UK Chess Directory...")
        await page.goto(f"file:///{base_dir}/chess_clubs_uk/index.html")
        await page.wait_for_timeout(2000) # wait for map/animations
        await page.screenshot(path=os.path.join(base_dir, 'assets', 'screenshots', 'uk-chess-directory.png'))
        
        print("Capturing Gambling Arbitrage...")
        await page.goto(f"file:///{base_dir}/arbitrage/index.html")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(base_dir, 'assets', 'screenshots', 'gambling-arbitrage.png'))
        
        print("Capturing Eurovision Hub...")
        await page.goto(f"file:///{base_dir}/eurovision/index.html")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=os.path.join(base_dir, 'assets', 'screenshots', 'eurovision-hub.png'))
        
        print("Done!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
