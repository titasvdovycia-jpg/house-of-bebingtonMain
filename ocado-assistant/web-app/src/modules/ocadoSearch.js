/**
 * Searches Ocado for a given query by delegating to the Chrome extension.
 */
export async function searchOcado(query) {
  return new Promise((resolve) => {
    // Unique ID to track this specific request
    const requestId = Date.now().toString() + Math.random().toString();
    
    // Set a timeout in case the extension isn't installed or is unresponsive
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      console.error("Ocado search timed out (is the extension running?)");
      resolve([]);
    }, 15000);
    
    // Listener for the response
    const handleResponse = (event) => {
      // Validate source and structure
      if (event.source !== window || !event.data) return;
      
      if (event.data.type === 'OCADO_SEARCH_RESPONSE' && event.data.requestId === requestId) {
        clearTimeout(timeout);
        window.removeEventListener('message', handleResponse);
        
        if (event.data.response && event.data.response.success) {
          resolve(event.data.response.data || []);
        } else {
          console.error("Extension search failed:", event.data.response?.error);
          resolve([]);
        }
      }
    };
    
    window.addEventListener('message', handleResponse);
    
    // Dispatch request to bridge.js
    window.postMessage({ 
      type: 'OCADO_SEARCH', 
      requestId,
      query 
    }, '*');
  });
}
