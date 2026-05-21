import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'ocado-assistant-db';
const DB_VERSION = 1;
const STORE_NAME = 'recipes';

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });
}

export async function saveRecipe(recipeData) {
  const db = await initDB();
  const recipe = {
    id: recipeData.id || uuidv4(),
    name: recipeData.name || 'Untitled Recipe',
    ingredients: recipeData.ingredients || [],
    rawText: recipeData.rawText || '',
    createdAt: recipeData.createdAt || Date.now(),
    servings: recipeData.servings || 1,
    sourceUrl: recipeData.sourceUrl || null
  };
  await db.put(STORE_NAME, recipe);
  return recipe;
}

export async function getAllRecipes() {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('createdAt');
  // Get all recipes ordered by creation date descending (newest first)
  const recipes = await index.getAll();
  return recipes.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRecipe(id) {
  const db = await initDB();
  return db.get(STORE_NAME, id);
}

export async function deleteRecipe(id) {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
}
