// Service worker for the extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Ocado Assistant Extension Installed');
});

// Relay messages between web app (localhost) and ocado content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);
  
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
