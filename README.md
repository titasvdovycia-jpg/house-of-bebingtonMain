# House of Bebington - Portfolio

Welcome to the House of Bebington digital portfolio repository. This portfolio showcases various web development and data analytics projects.

## Project Structure

The portfolio uses a clean, single-page layout (`index.html`) featuring expandable project cards. 

### Current Projects
1. **UK Chess Directory**: A map-first national chess club discovery tool. (`/chess_clubs_uk`)
2. **Gambling Arbitrage**: A financial dashboard for identifying betting arbitrage opportunities. (`/arbitrage`)
3. **Eurovision 2026 Hub**: An interactive, multi-user scoring application for the Eurovision Song Contest. (`/eurovision`)

---

## Adding Project Screenshots

The portfolio supports displaying screenshots of your projects on the main page. If a screenshot is missing, it elegantly falls back to a placeholder icon.

To add or update a project screenshot:

1. **Take a Screenshot**: Take a square screenshot (1:1 aspect ratio, e.g., 800x800 pixels) of your project's UI.
2. **Name the File**: Name the image appropriately (e.g., `uk-chess-directory.png`).
3. **Save the Image**: Place the image file in the `assets/screenshots/` directory (create the folder if it doesn't exist).
4. **Link it in HTML**: Open `index.html`, locate the project card, and update the `src` attribute of the `<img>` tag to point to your new image:
   ```html
   <img src="./assets/screenshots/your-new-screenshot.png" alt="..." class="..." onerror="this.style.display='none'">
   ```

## Adding a New Project

To add a brand new project to the portfolio, follow these steps:

1. Add your project folder to the root directory (e.g., `/my-new-project`).
2. Open `index.html` and copy an existing `.project-card` block.
3. Paste the new card inside the `#project-container`.
4. Update the card details:
   - `data-id`: Increment the data-id number.
   - `project-num`: Update the display number (e.g., `/ 04`).
   - `project-title`: Update the title.
   - Project Description and Tags: Update the text and the `#tags`.
   - `View Details` Link: Change the `href` to point to `./my-new-project/index.html`.
   - Update the `<img src="...">` to point to your new screenshot.

The portfolio's JavaScript automatically handles the expansion and toggling logic for all `.project-card` elements, so no extra JS setup is required!
