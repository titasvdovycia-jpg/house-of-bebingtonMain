import { getRecipe, saveRecipe } from '../modules/recipeStore.js';

export async function renderIngredientReview(outlet) {
  // Get ID from URL hash: #/review/:id
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

  const ingredientsHtml = recipe.ingredients.map((ing, index) => `
    <div class="ingredient-row flex justify-between" style="padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
      <div class="ing-details">
        <strong>${ing.quantity} ${ing.unit}</strong> ${ing.ingredient} 
        ${ing.notes ? `<span class="text-muted" style="font-size:0.8em">(${ing.notes})</span>` : ''}
      </div>
      <div class="ing-actions">
        <label style="cursor:pointer; display:flex; gap:0.5rem; align-items:center;">
          <input type="checkbox" class="cupboard-check" data-index="${index}" ${ing.checked ? 'checked' : ''} />
          <span style="font-size:0.85rem;" class="text-muted">I have this</span>
        </label>
      </div>
    </div>
  `).join('');

  outlet.innerHTML = `
    <div class="card">
      <h2 class="mb-4">Review Ingredients</h2>
      <p class="text-muted mb-4">Check off items you already have in your cupboard.</p>
      
      <div class="ingredients-list mb-4">
        ${ingredientsHtml}
      </div>

      <div class="flex justify-between mt-4">
        <button class="btn btn-secondary" id="btn-back">Back</button>
        <button class="btn btn-primary" id="btn-next">Find on Ocado ➔</button>
      </div>
    </div>
  `;

  // Attach event listeners
  document.getElementById('btn-back').addEventListener('click', () => {
    window.location.hash = '/add';
  });

  const checkboxes = document.querySelectorAll('.cupboard-check');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const idx = e.target.getAttribute('data-index');
      recipe.ingredients[idx].checked = e.target.checked;
      await saveRecipe(recipe);
    });
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    // Navigate to Ocado matching view
    window.location.hash = `/matches/${recipe.id}`;
  });
}
