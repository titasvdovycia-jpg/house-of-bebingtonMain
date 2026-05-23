// Service worker for the extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Ocado Assistant Extension Installed');
});

// Relay messages between web app (localhost/github pages) and ocado content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);
  
  if (request.action === 'SEARCH_OCADO') {
    // Background script fetches directly from Ocado to bypass CORS
    fetch(`https://www.ocado.com/search?entry=${encodeURIComponent(request.query)}`)
      .then(res => res.text())
      .then(html => {
        const regex = /window\.__PRELOADED_STATE__\s*=\s*({.*?});<\/script>/s;
        const match = regex.exec(html);
        if (match && match[1]) {
          const state = JSON.parse(match[1]);
          const products = extractProductsFromState(state);
          sendResponse({ success: true, data: products.slice(0, 5) });
        } else {
          sendResponse({ success: false, error: "Regex failed to find state" });
        }
      })
      .catch(err => {
        console.error(err);
        sendResponse({ success: false, error: err.toString() });
      });
      
    return true; // Keep channel open for async fetch
  }
  
  if (request.action === 'ADD_TO_BASKET' || request.action === 'SCRAPE_ORDER_HISTORY') {
    const defaultUrl = request.action === 'SCRAPE_ORDER_HISTORY' ? 
      "https://www.ocado.com/webshop/receipts/orders" : 
      "https://www.ocado.com";
      
    // Find Ocado tab and send message to content.js there
    chrome.tabs.query({url: "https://*.ocado.com/*"}, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
          sendResponse(response);
        });
      } else {
        // Open ocado tab if not open
        chrome.tabs.create({url: defaultUrl}, (tab) => {
          // Note: Needs a bit of delay/listener in reality for tab to load
          setTimeout(() => {
             chrome.tabs.sendMessage(tab.id, request, sendResponse);
          }, 3000);
        });
      }
    });
    return true; // Keep message channel open
  }
});

// Helper function to extract products (copied from ocadoSearch.js)
function extractProductsFromState(state) {
  let products = [];
  try {
    if (state.search && state.search.fops) {
      products = state.search.fops.map(fop => fop.product);
    } else {
      const searchObj = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj) && obj.length > 0 && obj[0].name && obj[0].price) return obj;
        for (const key in obj) {
          const res = searchObj(obj[key]);
          if (res) return res;
        }
        return null;
      };
      const found = searchObj(state);
      if (found) products = found;
    }
  } catch (e) {
    console.warn("Failed to extract products", e);
  }

  return products.filter(p => p && p.name).map(p => ({
    id: p.id || p.sku,
    name: p.name,
    price: p.price ? p.price.current : (p.price || 0),
    image: p.image && p.image.url ? `https://www.ocado.com${p.image.url}` : '',
    size: p.catchWeight || p.unit || p.size || '',
    pricePerUnit: p.price && p.price.unit ? p.price.unit.price : ''
  }));
}
