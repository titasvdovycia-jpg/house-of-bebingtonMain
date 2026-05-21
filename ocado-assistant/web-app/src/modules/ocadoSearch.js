/**
 * Searches Ocado for a given query via the Vite proxy.
 */
export async function searchOcado(query) {
  try {
    // We proxy through our local dev server to avoid CORS.
    // In production, this would go through the extension or a backend.
    const res = await fetch(`/api/ocado/search?entry=${encodeURIComponent(query)}`);
    const html = await res.text();
    
    // Parse the HTML to extract product data
    // Ocado stores its initial state in a script tag: window.__PRELOADED_STATE__
    // We need to extract that JSON using regex.
    const regex = /window\.__PRELOADED_STATE__\s*=\s*({.*?});<\/script>/s;
    const match = regex.exec(html);
    
    if (match && match[1]) {
      const state = JSON.parse(match[1]);
      
      // Navigate the state object to find search results
      // Usually it's under state.search.results or state.catalogue.products
      // We will look for anything that looks like a product list
      const products = extractProductsFromState(state);
      
      // Sort by price per unit or relevance
      // For now, just return what we found
      return products.slice(0, 5); // Return top 5 matches
    }
    
    return [];
  } catch (err) {
    console.error("Ocado search failed:", err);
    return [];
  }
}

function extractProductsFromState(state) {
  let products = [];
  
  try {
    // This path is highly dependent on Ocado's React state structure
    // We try to find the products array.
    if (state.search && state.search.fops) {
      products = state.search.fops.map(fop => fop.product);
    } else {
      // Fallback: search the whole object for an array of products
      const searchObj = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (Array.isArray(obj) && obj.length > 0 && obj[0].name && obj[0].price) {
          return obj;
        }
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

  // Normalize the product format
  return products.filter(p => p && p.name).map(p => ({
    id: p.id || p.sku,
    name: p.name,
    price: p.price ? p.price.current : (p.price || 0),
    image: p.image && p.image.url ? `https://www.ocado.com${p.image.url}` : '',
    size: p.catchWeight || p.unit || p.size || '',
    pricePerUnit: p.price && p.price.unit ? p.price.unit.price : ''
  }));
}
