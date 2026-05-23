// This script runs on our web app domain to bridge postMessage and chrome.runtime
console.log("Ocado Assistant Bridge Loaded");

// Listen for pings from the web app
window.addEventListener('message', (event) => {
  // Only accept messages from the same frame
  if (event.source !== window) return;

  if (event.data && event.data.type === 'OCADO_ASSISTANT_PING') {
    console.log("Received PING from Web App");
    window.postMessage({ type: 'OCADO_ASSISTANT_PONG' }, '*');
  }

  if (event.data && event.data.type === 'OCADO_ADD_ITEMS') {
    // Forward to background script
    chrome.runtime.sendMessage({ action: 'ADD_TO_BASKET', items: event.data.items }, (response) => {
      window.postMessage({ type: 'OCADO_ADD_ITEMS_RESPONSE', response }, '*');
    });
  }

  if (event.data && event.data.type === 'OCADO_SYNC_ORDERS') {
    // Forward to background script
    chrome.runtime.sendMessage({ action: 'SCRAPE_ORDER_HISTORY' }, (response) => {
      window.postMessage({ type: 'OCADO_SYNC_ORDERS_RESPONSE', response }, '*');
    });
  }

  if (event.data && event.data.type === 'OCADO_SEARCH') {
    // Forward search request to background script
    chrome.runtime.sendMessage({ action: 'SEARCH_OCADO', query: event.data.query }, (response) => {
      window.postMessage({ type: 'OCADO_SEARCH_RESPONSE', requestId: event.data.requestId, response }, '*');
    });
  }
});
