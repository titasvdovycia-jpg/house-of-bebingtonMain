import { test, expect } from '@playwright/test';

test.describe('Ocado Assistant Frontend Flow', () => {
  test('should navigate the full recipe parsing and matching flow', async ({ page }) => {
    // 1. Go to the Home Page
    await page.goto('http://localhost:5173/');
    
    // Expect the home page to load
    await expect(page.locator('h2').first()).toHaveText('Your Recipe Library');
    
    // 2. Click "Add Your First Recipe" (or "Add New Recipe" if some exist)
    const addBtn = page.locator('text=+ Add');
    await addBtn.first().click();
    
    // Expect the Add Recipe page to load
    await expect(page).toHaveURL(/.*#\/add/);
    await expect(page.locator('h2')).toHaveText('Add a Recipe');
    
    // 3. Paste a recipe into the textarea
    const recipeText = `2 tbsp olive oil\n1 large onion, chopped\n500g beef mince`;
    await page.locator('#recipe-input').fill(recipeText);
    
    // 4. Click Parse Ingredients
    await page.locator('#btn-parse').click();
    
    // 5. Verify it navigates to the Review screen
    await expect(page).toHaveURL(/.*#\/review\/.*/);
    await expect(page.locator('h2')).toHaveText('Review Ingredients');
    
    // 6. Verify there are 3 ingredients parsed and displayed
    const ingredientRows = page.locator('.ingredient-row');
    await expect(ingredientRows).toHaveCount(3);
    
    // 7. Check off the first ingredient (simulate having olive oil in cupboard)
    await page.locator('.cupboard-check').nth(0).check();
    
    // 8. Click "Find on Ocado"
    await page.locator('#btn-next').click();
    
    // 9. Verify it navigates to the Matches screen
    await expect(page).toHaveURL(/.*#\/matches\/.*/);
    await expect(page.locator('h2')).toHaveText('Finding Matches on Ocado...');
    
    // 10. Because we checked off 1 item, it should only be searching for 2 items
    await expect(page.locator('#matches-container')).toContainText('Searching for 2 items...');
    
    // The actual Ocado search might fail/succeed depending on network, 
    // but the frontend UI logic is verified up to this point!
  });
});
