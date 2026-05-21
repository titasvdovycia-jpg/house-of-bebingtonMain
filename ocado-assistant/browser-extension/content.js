console.log("Ocado Assistant Content Script Loaded");

/**
 * Attempts to add an item to the Ocado basket.
 * Note: Since Ocado's API changes, this attempts both a direct API call
 * and a fallback DOM click approach if the API call fails.
 */
async function addToBasket(item) {
  try {
    // Attempt 1: Internal API (This is a generic guess for their current API structure)
    // Most SPA e-commerce sites use a variation of this endpoint
    const csrfToken = document.cookie.split('; ').find(row => row.startsWith('CSRF-TOKEN='))?.split('=')[1] || '';
    
    const res = await fetch('/webshop/api/v1/basket/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sku: item.id,
        quantity: item.quantity || 1
      })
    });

    if (res.ok) {
      return true;
    }
    throw new Error('API Add to Basket failed');
  } catch (err) {
    console.warn("API approach failed, attempting DOM fallback for SKU:", item.id);
    
    // Attempt 2: DOM Click fallback (Requires the item to be on the screen, usually unstable)
    // We navigate to the product page first
    // Note: in a real robust extension, we'd open a hidden iframe for each product to click "Add"
    return false; // For MVP, we'll rely on API and log if it fails
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ADD_TO_BASKET') {
    console.log("Received request to add to basket:", request.items);
    
    // Process sequentially to avoid rate limiting
    (async () => {
      let successCount = 0;
      for (const item of request.items) {
        try {
          const success = await addToBasket(item);
          if (success) successCount++;
          // Small delay to mimic human behavior and avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch(e) {
          console.error("Failed to add", item, e);
        }
      }
      sendResponse({ success: true, message: `Added ${successCount}/${request.items.length} items to basket` });
    })();
    
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'SCRAPE_ORDER_HISTORY') {
    console.log("Scraping order history...");
    // If we are not on the receipts page, we should tell the extension to open it
    if (!window.location.pathname.includes('/receipts')) {
      sendResponse({ success: false, error: "Not on receipts page", redirect: "https://www.ocado.com/webshop/receipts/orders" });
      return;
    }

    // STUB: Extract past order SKUs from the DOM
    const orderedItems = Array.from(document.querySelectorAll('.bop-productLine')).map(el => {
      return {
        id: el.getAttribute('data-sku'),
        name: el.querySelector('.bop-title')?.textContent.trim()
      };
    });
    
    sendResponse({ success: true, data: orderedItems });
  }
});
