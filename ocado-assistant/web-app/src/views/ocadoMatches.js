import { getRecipe } from '../modules/recipeStore.js';
import { searchOcado } from '../modules/ocadoSearch.js';

export async function renderOcadoMatches(outlet) {
  const hashParts = window.location.hash.split('/');
  const recipeId = hashParts[2];

  if (!recipeId) {
    outlet.innerHTML = `<div class="card"><p class="text-danger">Error: No recipe ID provided.</p><button class="btn btn-secondary mt-4" onclick="window.location.hash='/'">Go Back</button></div>`;
    return;
  }

  const recipe = await getRecipe(recipeId);
  if (!recipe) {
    outlet.innerHTML = `<div class="card"><p class="text-danger">Error: Recipe not found.</p><button class="btn btn-secondary mt-4" onclick="window.location.hash='/'">Go Back</button></div>`;
    return;
  }

  // Filter out ingredients the user already has in the cupboard
  const ingredientsToBuy = recipe.ingredients.filter(ing => !ing.checked);

  outlet.innerHTML = `
    <div class="card">
      <h2 class="mb-4">Finding Matches on Ocado...</h2>
      <div id="matches-container" class="mb-4">
        <p class="text-muted">Searching for ${ingredientsToBuy.length} items...</p>
        <div class="loader mt-4"></div>
      </div>
      
      <div class="flex justify-between mt-4">
        <button class="btn btn-secondary" onclick="window.location.hash='/review/${recipeId}'">Back to Review</button>
        <button class="btn btn-primary" id="btn-basket" disabled>Send to Basket ➔</button>
      </div>
    </div>
  `;

  const matchesContainer = document.getElementById('matches-container');
  let finalBasketItems = [];

  try {
    // We process each ingredient one by one to avoid hammering the endpoint
    // In a real app we'd `Promise.all` this, but we'll do sequential for rate-limit safety
    let resultsHtml = '';
    
    for (const ing of ingredientsToBuy) {
      // Use the parsed ingredient name, fallback to original if none
      const query = ing.ingredient || ing.original;
      
      const results = await searchOcado(query);
      
      let productHtml = '';
      if (results && results.length > 0) {
        const topMatch = results[0];
        finalBasketItems.push(topMatch);
        
        productHtml = `
          <div class="match-item flex justify-between items-center" style="background: rgba(46, 160, 67, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid var(--accent); margin-bottom: 0.5rem;">
            <div class="flex gap-4 items-center">
              ${topMatch.image ? `<img src="${topMatch.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />` : ''}
              <div>
                <div style="font-size: 0.8em" class="text-muted">For "${ing.original}"</div>
                <strong>${topMatch.name}</strong> <span class="text-muted">(${topMatch.size})</span>
              </div>
            </div>
            <div class="text-right">
              <strong>£${topMatch.price}</strong>
              <div style="font-size: 0.8em" class="text-muted">${topMatch.pricePerUnit}</div>
            </div>
          </div>
        `;
      } else {
        productHtml = `
          <div class="match-item" style="background: rgba(218, 54, 51, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid var(--danger); margin-bottom: 0.5rem;">
            <div style="font-size: 0.8em" class="text-muted">For "${ing.original}"</div>
            <strong class="text-danger">No matches found</strong>
          </div>
        `;
      }
      
      resultsHtml += productHtml;
      matchesContainer.innerHTML = resultsHtml;
    }
    
    const btnBasket = document.getElementById('btn-basket');
    btnBasket.disabled = false;
    btnBasket.addEventListener('click', () => {
      // Send message to extension
      window.postMessage({ type: 'OCADO_ADD_ITEMS', items: finalBasketItems }, '*');
      alert(`Sending ${finalBasketItems.length} items to Ocado via Extension!`);
    });

  } catch (err) {
    console.error(err);
    matchesContainer.innerHTML = `<p class="text-danger">Error searching Ocado. Please try again.</p>`;
  }
}
