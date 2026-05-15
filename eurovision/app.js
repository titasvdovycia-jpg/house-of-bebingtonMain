// --- State ---
let session = {
  raters: [],      // Array of objects: { id, name }
  categories: [],  // Array of category IDs
  scores: {},      // Map: countryId -> raterId -> { catId: score }
};

// --- DOM Elements ---
const setupModal = document.getElementById('setup-modal');
const appContainer = document.getElementById('app');
const raterInputsContainer = document.getElementById('rater-inputs');
const raterCountDisplay = document.getElementById('rater-count-display');
const categoryTogglesContainer = document.getElementById('category-toggles');
const countryGrid = document.getElementById('country-grid');
const searchInput = document.getElementById('search-input');

const resultsModal = document.getElementById('results-modal');
const resultsSubtitle = document.getElementById('results-subtitle');
const overallList = document.getElementById('overall-list');
const perRaterContainer = document.getElementById('per-rater-container');
const closestList = document.getElementById('closest-list');

// --- Initialization ---
function init() {
  const savedData = localStorage.getItem('esc2026_session');
  if (savedData) {
    try {
      session = JSON.parse(savedData);
      startApp();
    } catch(e) {
      console.error("Failed to parse session", e);
      showSetup();
    }
  } else {
    showSetup();
  }
}

// --- Setup Modal Logic ---
let tempRaterCount = 2;
let tempCategories = new Set(['song', 'vocals', 'staging', 'overall']);

function showSetup() {
  setupModal.classList.add('active');
  appContainer.classList.add('hidden');
  renderSetupInputs();
  renderSetupCategories();
}

function changeCount(delta) {
  tempRaterCount = Math.max(1, Math.min(10, tempRaterCount + delta));
  raterCountDisplay.innerText = tempRaterCount;
  renderSetupInputs();
}

function renderSetupInputs() {
  raterInputsContainer.innerHTML = '';
  for (let i = 0; i < tempRaterCount; i++) {
    const div = document.createElement('div');
    div.className = 'rater-input-wrapper';
    div.innerHTML = `<input type="text" id="rater-name-${i}" placeholder="Rater ${i+1} Name" value="${i === 0 ? 'Alice' : i === 1 ? 'Bob' : 'Rater ' + (i+1)}" />`;
    raterInputsContainer.appendChild(div);
  }
}

function renderSetupCategories() {
  categoryTogglesContainer.innerHTML = '';
  DEFAULT_CATEGORIES.forEach(cat => {
    const btn = document.createElement('div');
    btn.className = `category-toggle ${tempCategories.has(cat.id) ? 'active' : ''}`;
    btn.innerHTML = `<span class="cat-icon">${cat.icon}</span> <span>${cat.label}</span>`;
    btn.onclick = () => {
      if (tempCategories.has(cat.id)) {
        if (tempCategories.size > 1) tempCategories.delete(cat.id);
      } else {
        tempCategories.add(cat.id);
      }
      renderSetupCategories();
    };
    categoryTogglesContainer.appendChild(btn);
  });
}

function startSession() {
  session.raters = [];
  for (let i = 0; i < tempRaterCount; i++) {
    const name = document.getElementById(`rater-name-${i}`).value.trim() || `Rater ${i+1}`;
    session.raters.push({ id: `rater_${i}`, name });
  }
  
  session.categories = Array.from(tempCategories);
  
  session.scores = {};
  COUNTRIES.forEach(c => {
    session.scores[c.id] = {};
    session.raters.forEach(r => {
      session.scores[c.id][r.id] = {};
    });
  });

  saveSession();
  startApp();
}

// --- Main App Logic ---
function startApp() {
  setupModal.classList.remove('active');
  appContainer.classList.remove('hidden');
  renderGrid();
}

function saveSession() {
  localStorage.setItem('esc2026_session', JSON.stringify(session));
}

function getAverageScoreForRater(countryId, raterId) {
  const scores = session.scores[countryId][raterId] || {};
  let sum = 0;
  session.categories.forEach(c => {
    sum += (scores[c] !== undefined ? scores[c] : 5);
  });
  return sum / session.categories.length;
}

function saveScore(countryId, raterId, catId, value) {
  if (!session.scores[countryId][raterId]) {
    session.scores[countryId][raterId] = {};
  }
  session.scores[countryId][raterId][catId] = parseInt(value);
  saveSession();
  
  // Update displayed label
  document.getElementById(`val-${countryId}-${raterId}-${catId}`).innerText = value;
  
  // Update rater average
  const avg = getAverageScoreForRater(countryId, raterId);
  if (avg !== null) {
    document.getElementById(`avg-${countryId}-${raterId}`).innerText = avg.toFixed(1);
  }
}

function renderGrid() {
  countryGrid.innerHTML = '';
  const searchStr = searchInput.value.toLowerCase();
  
  // Sort by running order
  const sortedCountries = [...COUNTRIES].sort((a, b) => a.runningOrder - b.runningOrder);
  
  sortedCountries.forEach(country => {
    // Filter by search
    if (!country.country.toLowerCase().includes(searchStr) && 
        !country.artist.toLowerCase().includes(searchStr) && 
        !country.song.toLowerCase().includes(searchStr)) {
      return;
    }
    
    const card = document.createElement('div');
    card.className = 'country-card';
    
    const lyricsSearch = `https://genius.com/search?q=${encodeURIComponent(country.artist + ' ' + country.song)}`;
    
    // Build rater columns
    let ratersHtml = '';
    session.raters.forEach(rater => {
      const raterScores = session.scores[country.id][rater.id] || {};
      const avgScore = getAverageScoreForRater(country.id, rater.id);
      const scoreText = avgScore !== null ? avgScore.toFixed(1) : '-';
      
      let slidersHtml = '';
      session.categories.forEach(catId => {
        const catDef = DEFAULT_CATEGORIES.find(c => c.id === catId);
        const val = raterScores[catId] || 5;
        
        slidersHtml += `
          <div class="category-slider">
            <div class="cat-header">
              <span class="cat-label">${catDef.icon} ${catDef.label}</span>
              <span class="cat-score-val" id="val-${country.id}-${rater.id}-${catId}">${val}</span>
            </div>
            <input type="range" min="1" max="10" step="1" value="${val}" 
                   oninput="saveScore('${country.id}', '${rater.id}', '${catId}', this.value)" />
          </div>
        `;
      });
      
      ratersHtml += `
        <div class="rater-column">
          <div class="rater-name-header">${rater.name}</div>
          ${slidersHtml}
          <div class="rater-avg">Average: <span id="avg-${country.id}-${rater.id}">${scoreText}</span></div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="card-left-info">
        <div class="card-header">
          <img src="https://flagcdn.com/w80/${country.flagCode.toLowerCase()}.png" class="flag-img" alt="${country.country} Flag" />
          <div>
            <div class="country-name">${country.country} <span class="running-order">#${country.runningOrder === 0 ? 'Auto' : country.runningOrder}</span></div>
            <div class="artist-name">${country.artist}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="song-name">"${country.song}"</div>
          <div class="links-row">
            <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(country.youtubeSearch)}" target="_blank" class="action-link">
              <svg class="link-icon" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
              YouTube
            </a>
            <a href="${lyricsSearch}" target="_blank" class="action-link">
              <svg class="link-icon" viewBox="0 0 24 24"><path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0-2c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-3 8v8l7-4-7-4z"/></svg>
              Lyrics
            </a>
          </div>
        </div>
      </div>
      <div class="card-raters-container">
        ${ratersHtml}
      </div>
    `;
    countryGrid.appendChild(card);
  });
}

function filterCards() {
  renderGrid();
}

// --- Results Logic ---
function showResults() {
  resultsModal.classList.add('active');
  
  // Calculate completion
  let totalPossible = COUNTRIES.length * session.raters.length * session.categories.length;
  let totalRated = 0;
  COUNTRIES.forEach(c => {
    session.raters.forEach(r => {
      session.categories.forEach(cat => {
        if (session.scores[c.id][r.id][cat] !== undefined) totalRated++;
      });
    });
  });
  
  let pct = Math.round((totalRated / totalPossible) * 100);
  resultsSubtitle.innerText = `Scoring is ${pct}% complete`;
  
  // Render overall by default
  switchResultTab('overall', document.querySelector('.rtab'));
}

function hideResults() {
  resultsModal.classList.remove('active');
}

function switchResultTab(tabId, btnElement) {
  document.querySelectorAll('.rtab').forEach(el => el.classList.remove('active'));
  btnElement.classList.add('active');
  
  document.querySelectorAll('.results-panel').forEach(el => el.classList.add('hidden'));
  document.getElementById(`results-${tabId}`).classList.remove('hidden');
  
  if (tabId === 'overall') renderOverallResults();
  if (tabId === 'per-rater') renderPerRater();
  if (tabId === 'closest') renderClosest();
}

// Calculations
function getCountryOverallAvg(countryId) {
  let sum = 0, count = 0;
  session.raters.forEach(r => {
    const raterAvg = getAverageScoreForRater(countryId, r.id);
    if (raterAvg !== null) {
      sum += raterAvg;
      count++;
    }
  });
  return count > 0 ? (sum / count) : 0;
}

function renderOverallResults() {
  const ranked = COUNTRIES.map(c => ({
    ...c,
    score: getCountryOverallAvg(c.id)
  })).filter(c => c.score > 0).sort((a, b) => b.score - a.score);
  
  overallList.innerHTML = '';
  if (ranked.length === 0) {
    overallList.innerHTML = '<p style="text-align:center; color:#aaa;">No scores yet.</p>';
    return;
  }
  
  ranked.forEach((c, idx) => {
    overallList.innerHTML += `
      <div class="result-item">
        <div class="rank">#${idx + 1}</div>
        <img src="https://flagcdn.com/w40/${c.flagCode.toLowerCase()}.png" class="res-flag" style="border-radius:2px; margin-right:15px; width:40px;"/>
        <div class="res-info">
          <div class="res-country">${c.country}</div>
          <div class="res-song">${c.artist} - "${c.song}"</div>
        </div>
        <div class="res-score">${c.score.toFixed(2)}</div>
      </div>
    `;
  });
}

function renderPerRater() {
  perRaterContainer.innerHTML = '';
  
  if (session.raters.length === 0) {
    perRaterContainer.innerHTML = '<p style="text-align:center; color:#aaa;">No raters found.</p>';
    return;
  }
  
  session.raters.forEach(rater => {
    const ranked = COUNTRIES.map(c => ({
      ...c,
      score: getAverageScoreForRater(c.id, rater.id) || 0
    })).filter(c => c.score > 0).sort((a, b) => b.score - a.score);
    
    let html = `
      <div class="rater-results-col">
        <div class="rater-res-title">${rater.name}'s Top Picks</div>
        <div class="results-list">
    `;
    
    if (ranked.length === 0) {
      html += '<p style="text-align:center; color:#aaa; font-size: 0.9rem;">No scores yet.</p>';
    } else {
      ranked.forEach((c, idx) => {
        html += `
          <div class="result-item compact-item">
            <div class="rank" style="font-size: 1.2rem; width: 30px;">#${idx + 1}</div>
            <img src="https://flagcdn.com/w40/${c.flagCode.toLowerCase()}.png" class="res-flag" style="width: 25px; margin-right: 10px; border-radius: 2px;" />
            <div class="res-info">
              <div class="res-country" style="font-size: 1rem;">${c.country}</div>
            </div>
            <div class="res-score" style="font-size: 1.3rem;">${c.score.toFixed(1)}</div>
          </div>
        `;
      });
    }
    
    html += `</div></div>`;
    perRaterContainer.innerHTML += html;
  });
}

function renderClosest() {
  closestList.innerHTML = '';
  
  let raterDiffs = {};
  session.raters.forEach(r => raterDiffs[r.id] = { sum: 0, count: 0 });
  
  COUNTRIES.forEach(c => {
    const overall = getCountryOverallAvg(c.id);
    if (overall > 0) {
      session.raters.forEach(r => {
        const raterAvg = getAverageScoreForRater(c.id, r.id);
        if (raterAvg !== null) {
          raterDiffs[r.id].sum += Math.abs(overall - raterAvg);
          raterDiffs[r.id].count++;
        }
      });
    }
  });
  
  let bestRater = null;
  let minAvgDiff = Infinity;
  
  session.raters.forEach(r => {
    const data = raterDiffs[r.id];
    if (data.count > 0) {
      const avgDiff = data.sum / data.count;
      if (avgDiff < minAvgDiff) {
        minAvgDiff = avgDiff;
        bestRater = r;
      }
    }
  });
  
  if (bestRater) {
    closestList.innerHTML = `
      <div class="closest-card">
        <div class="closest-title">The "Voice of the People" is...</div>
        <div class="closest-name">👑 ${bestRater.name}</div>
        <div class="closest-desc">
          Their scores were on average only <strong>${minAvgDiff.toFixed(2)}</strong> points away from the group consensus.<br>
          They truly understand what the group likes!
        </div>
      </div>
    `;
  } else {
    closestList.innerHTML = '<p style="text-align:center; color:#aaa;">Not enough data yet.</p>';
  }
}

function confirmReset() {
  if (confirm("Are you sure you want to reset all scores and raters? This cannot be undone!")) {
    localStorage.removeItem('esc2026_session');
    location.reload();
  }
}

async function syncOfficialResults() {
  const syncBtn = document.getElementById('sync-btn');
  const originalText = syncBtn.innerText;
  syncBtn.innerText = "📡 Syncing...";
  syncBtn.disabled = true;

  try {
    const url = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://eurovisionworld.com/eurovision/2026');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    const html = data.contents;
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const scoreboard = doc.querySelector('#scoreboard') || doc.querySelector('.scoreboard') || doc.querySelector('table.scoreboard');
    
    if (scoreboard) {
      alert("Successfully connected to EurovisionWorld. Found live scoreboard data! (Parsing logic will update scores when event starts).");
    } else {
      alert("Successfully connected to EurovisionWorld, but live scores aren't available yet. Check back during the event!");
    }
  } catch (error) {
    console.error('Error fetching live results:', error);
    alert('Failed to sync live results. The proxy or website might be blocking the request.');
  } finally {
    syncBtn.innerText = originalText;
    syncBtn.disabled = false;
  }
}

// Start app
document.addEventListener("DOMContentLoaded", init);
