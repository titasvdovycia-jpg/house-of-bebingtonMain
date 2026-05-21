import './style.css';
import { parseIngredientsText } from './modules/ingredientParser.js';
import { saveRecipe, getAllRecipes } from './modules/recipeStore.js';
import { renderIngredientReview } from './views/ingredientReview.js';
import { renderOcadoMatches } from './views/ocadoMatches.js';

// Simple Hash Router
const routes = {
  '/': renderHome,
  '/add': renderAddRecipe
};

function router() {
  const hash = window.location.hash.slice(1) || '/';
  const path = hash.split('/')[0] === '' && hash.length > 1 ? `/${hash.split('/')[1]}` : hash.split('/')[0] || '/';
  
  const outlet = document.getElementById('view-outlet');
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${path}`);
  });

  if (path === '/') renderHome(outlet);
  else if (path === '/add') renderAddRecipe(outlet);
  else if (path === '/review') renderIngredientReview(outlet);
  else if (path === '/matches') renderOcadoMatches(outlet);
  else renderHome(outlet);
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  router();
  checkExtensionStatus();
});

// --- Views ---

async function renderHome(outlet) {
  const recipes = await getAllRecipes();
  
  if (recipes.length === 0) {
    outlet.innerHTML = `
      <div class="card text-center">
        <h2 class="mb-4">Your Recipe Library</h2>
        <p class="text-muted mb-4">You haven't saved any recipes yet.</p>
        <div class="flex gap-4 justify-center">
          <a href="#/add" class="btn btn-primary">+ Add Your First Recipe</a>
          <button id="btn-sync-orders" class="btn btn-secondary">Sync Ocado History</button>
        </div>
      </div>
    `;
    attachSyncListener();
    return;
  }

  const recipeListHtml = recipes.map(r => `
    <div class="recipe-card" style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--border);">
      <div class="flex justify-between items-center">
        <div>
          <h3>${r.name}</h3>
          <span class="text-muted">${r.ingredients.length} ingredients • ${new Date(r.createdAt).toLocaleDateString()}</span>
        </div>
        <a href="#/review/${r.id}" class="btn btn-secondary">Review Basket</a>
      </div>
    </div>
  `).join('');

  outlet.innerHTML = `
    <div class="card">
      <div class="flex justify-between items-center mb-4">
        <h2>Your Recipe Library</h2>
        <button id="btn-sync-orders" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Sync Orders</button>
      </div>
      <div class="recipe-list mb-4">
        ${recipeListHtml}
      </div>
      <div class="text-center">
        <a href="#/add" class="btn btn-primary">+ Add New Recipe</a>
      </div>
    </div>
  `;
  attachSyncListener();
}

function attachSyncListener() {
  const btnSync = document.getElementById('btn-sync-orders');
  if (btnSync) {
    btnSync.addEventListener('click', () => {
      btnSync.textContent = 'Syncing...';
      // Ping extension to scrape order history
      window.postMessage({ type: 'OCADO_SYNC_ORDERS' }, '*');
      setTimeout(() => {
        btnSync.textContent = 'Sync Complete ✓';
        setTimeout(() => btnSync.textContent = 'Sync Orders', 2000);
      }, 1500);
    });
  }
}

function renderAddRecipe(outlet) {
  outlet.innerHTML = `
    <div class="card">
      <h2 class="mb-4">Add a Recipe</h2>
      
      <div class="tabs flex gap-4 mb-4">
        <button class="btn btn-secondary active">Paste Text</button>
        <button class="btn btn-secondary">Import from URL</button>
        <button class="btn btn-secondary">Upload Photo</button>
      </div>

      <div id="input-container">
        <textarea id="recipe-input" placeholder="Paste your ingredients list here...
e.g.
2 tbsp olive oil
1 large onion, chopped
500g beef mince
400g can chopped tomatoes"></textarea>
      </div>

      <div class="flex justify-between mt-4">
        <button class="btn btn-secondary" onclick="window.location.hash='/'">Cancel</button>
        <button class="btn btn-primary" id="btn-parse">Parse Ingredients ➔</button>
      </div>
    </div>
  `;

  const btnParse = document.getElementById('btn-parse');
  if (btnParse) {
    btnParse.addEventListener('click', async () => {
      const text = document.getElementById('recipe-input').value;
      if (!text.trim()) {
        alert('Please paste some ingredients first!');
        return;
      }

      btnParse.textContent = 'Parsing...';
      btnParse.disabled = true;

      // Parse ingredients
      const ingredients = parseIngredientsText(text);
      
      // Save to IndexedDB
      const recipe = await saveRecipe({
        name: 'Pasted Recipe ' + new Date().toLocaleTimeString(),
        rawText: text,
        ingredients: ingredients
      });

      // Navigate to review view
      window.location.hash = `/review/${recipe.id}`;
    });
  }
}

// --- Extension Bridge ---

function checkExtensionStatus() {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  
  // We'll send a message to window, and the content script of the extension should reply
  window.postMessage({ type: 'OCADO_ASSISTANT_PING' }, '*');
  
  // Wait a bit to see if we get a pong
  setTimeout(() => {
    // This is just a stub. Real implementation will listen for 'message' events.
    if (window.__OCADO_EXTENSION_ACTIVE__) {
      dot.classList.add('active');
      label.textContent = 'Extension Active';
    }
  }, 500);
}

window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'OCADO_ASSISTANT_PONG') {
    window.__OCADO_EXTENSION_ACTIVE__ = true;
    const dot = document.getElementById('status-dot');
    const label = document.getElementById('status-label');
    if(dot && label) {
      dot.classList.add('active');
      label.textContent = 'Extension Connected';
    }
  }
});
