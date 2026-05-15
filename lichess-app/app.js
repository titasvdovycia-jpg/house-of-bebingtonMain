import { Chessground } from 'https://esm.sh/@lichess-org/chessground';
import { Chess } from 'https://esm.sh/chess.js@1.0.0-beta.6';

// --- CONFIGURATION ---
const CLIENT_ID = 'duchess-bebington-local'; // Replace with your registered Lichess Client ID
const REDIRECT_URI = window.location.origin + window.location.pathname;
const LICHESS_API_URL = 'https://lichess.org';

// State
let token = localStorage.getItem('lichess_token') || null;
let user = null;
let currentGameId = null;
let board = null;
let chess = new Chess();
let botColor = 'black';
let myColor = 'white';
let isListeningToEvents = false;

// DOM Elements
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const userInfo = document.getElementById('user-info');
const usernameEl = document.getElementById('username');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const playAiBtn = document.getElementById('play-ai-btn');
const playRandomBtn = document.getElementById('play-random-btn');
const gameContainer = document.getElementById('game-container');
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('game-status');

// --- OAUTH 2.0 PKCE FLOW ---

function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += charset[randomValues[i] % charset.length];
    }
    return result;
}

async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function login() {
    const codeVerifier = generateRandomString(128);
    localStorage.setItem('lichess_code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const authUrl = new URL(`${LICHESS_API_URL}/oauth`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', 'board:play challenge:read challenge:write');
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('code_challenge', codeChallenge);

    window.location.href = authUrl.toString();
}

async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
        alert('Login failed: ' + error);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    if (code) {
        const codeVerifier = localStorage.getItem('lichess_code_verifier');
        try {
            const response = await fetch(`${LICHESS_API_URL}/api/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    code_verifier: codeVerifier,
                    redirect_uri: REDIRECT_URI,
                    client_id: CLIENT_ID,
                })
            });

            const data = await response.json();
            if (data.access_token) {
                token = data.access_token;
                localStorage.setItem('lichess_token', token);
            }
        } catch (e) {
            console.error('Failed to get token', e);
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function logout() {
    localStorage.removeItem('lichess_token');
    localStorage.removeItem('lichess_code_verifier');
    token = null;
    user = null;
    isListeningToEvents = false;
    updateUI();
}

// --- API METHODS ---

async function fetchProfile() {
    const response = await fetch(`${LICHESS_API_URL}/api/account`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
        return await response.json();
    }
    return null;
}

async function createGameWithAI() {
    const response = await fetch(`${LICHESS_API_URL}/api/challenge/ai`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            level: 1, // Easy AI
            color: 'random',
            variant: 'standard'
        })
    });
    
    if (response.ok) {
        const data = await response.json();
        return data;
    }
    return null;
}

async function makeMoveAPI(gameId, move) {
    await fetch(`${LICHESS_API_URL}/api/board/game/${gameId}/move/${move}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });
}

async function listenToGlobalEvents() {
    if (isListeningToEvents) return;
    isListeningToEvents = true;
    try {
        const response = await fetch(`${LICHESS_API_URL}/api/stream/event`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                try {
                    const event = JSON.parse(line);
                    if (event.type === 'gameStart') {
                        currentGameId = event.game.gameId || event.game.id;
                        if (playRandomBtn) {
                            playRandomBtn.disabled = false;
                            playRandomBtn.innerHTML = '<i class="fa-solid fa-users"></i> Find Random Opponent';
                        }
                        gameContainer.classList.remove('hidden');
                        statusEl.innerText = "Game Started against Random Opponent!";
                        streamGameState(currentGameId);
                    }
                } catch (e) {
                    console.error('Failed to parse global event', e, line);
                }
            }
        }
    } catch(e) {
        console.error("Global event stream failed", e);
        isListeningToEvents = false;
    }
}

async function seekRandomOpponent() {
    playRandomBtn.disabled = true;
    playRandomBtn.innerText = 'Seeking...';
    statusEl.innerText = "Waiting for an opponent to accept the seek...";
    showEmptyBoard();
    gameContainer.classList.remove('hidden');

    fetch(`${LICHESS_API_URL}/api/board/seek`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            rated: 'false',
            time: 5,
            increment: 0
        })
    }).catch(e => {
        console.error("Seek failed", e);
        playRandomBtn.disabled = false;
        playRandomBtn.innerHTML = '<i class="fa-solid fa-users"></i> Find Random Opponent';
        statusEl.innerText = "Seek failed.";
    });
}

// Read NDJSON stream from Lichess Board API
async function streamGameState(gameId) {
    const response = await fetch(`${LICHESS_API_URL}/api/board/game/stream/${gameId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            try {
                const event = JSON.parse(line);
                handleGameEvent(event);
            } catch (e) {
                console.error('Failed to parse event', e, line);
            }
        }
    }
}

// --- GAME LOGIC ---

function showEmptyBoard() {
    if (board) {
        board.destroy();
    }
    boardEl.innerHTML = '';
    
    board = Chessground(boardEl, {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        viewOnly: true
    });
}

function initBoard() {
    chess = new Chess();
    if (board) {
        board.destroy();
    }
    boardEl.innerHTML = '';
    
    board = Chessground(boardEl, {
        fen: chess.fen(),
        orientation: myColor,
        turnColor: chess.turn() === 'w' ? 'white' : 'black',
        movable: {
            color: myColor,
            free: false,
            dests: getValidMoves(),
        },
        events: {
            move: onUserMove
        }
    });
}

function getValidMoves() {
    const dests = new Map();
    chess.SQUARES.forEach(s => {
        const ms = chess.moves({square: s, verbose: true});
        if (ms.length) dests.set(s, ms.map(m => m.to));
    });
    return dests;
}

function onUserMove(orig, dest) {
    // Check for promotion (always queen for simplicity in this basic app)
    const moves = chess.moves({verbose: true});
    const moveInfo = moves.find(m => m.from === orig && m.to === dest);
    
    let promotion = '';
    if (moveInfo && moveInfo.flags.includes('p')) {
        promotion = 'q';
    }

    const moveObj = { from: orig, to: dest, promotion: promotion };
    const moveStr = orig + dest + promotion;
    
    try {
        chess.move(moveObj);
        board.set({
            fen: chess.fen(),
            turnColor: chess.turn() === 'w' ? 'white' : 'black',
            movable: {
                color: myColor,
                dests: getValidMoves()
            }
        });
        
        // Send to Lichess
        makeMoveAPI(currentGameId, moveStr);
        statusEl.innerText = "Waiting for opponent...";
        
    } catch(e) {
        // invalid move
        board.set({ fen: chess.fen() });
    }
}

function handleGameEvent(event) {
    if (event.type === 'gameFull') {
        const state = event.state;
        updateGameState(state.moves, event.white.id === user.id ? 'white' : 'black');
    } else if (event.type === 'gameState') {
        updateGameState(event.moves, myColor);
    }
}

function updateGameState(movesStr, playingColor) {
    myColor = playingColor;
    chess.reset();
    
    const moves = movesStr ? movesStr.trim().split(' ') : [];
    for (const m of moves) {
        if (!m) continue;
        const from = m.substring(0, 2);
        const to = m.substring(2, 4);
        const promotion = m.length > 4 ? m.substring(4, 5) : undefined;
        chess.move({from, to, promotion});
    }

    if (!board) {
        initBoard();
    } else {
        board.set({
            fen: chess.fen(),
            orientation: myColor,
            turnColor: chess.turn() === 'w' ? 'white' : 'black',
            movable: {
                color: chess.turn() === 'w' && myColor === 'white' || chess.turn() === 'b' && myColor === 'black' ? myColor : undefined,
                dests: getValidMoves()
            }
        });
    }

    if (chess.isGameOver()) {
        statusEl.innerText = "Game Over!";
    } else {
        const isMyTurn = (chess.turn() === 'w' && myColor === 'white') || (chess.turn() === 'b' && myColor === 'black');
        statusEl.innerText = isMyTurn ? "Your turn" : "Opponent's turn";
    }
}

// --- UI MANAGEMENT ---

async function updateUI() {
    if (token) {
        // Try to fetch profile
        if (!user) {
            user = await fetchProfile();
            if (!user) {
                // Token invalid
                logout();
                return;
            }
        }
        
        loginView.classList.remove('active');
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        dashboardView.classList.add('active');
        
        userInfo.classList.remove('hidden');
        usernameEl.innerText = user.username;
        listenToGlobalEvents();
    } else {
        loginView.classList.add('active');
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        dashboardView.classList.remove('active');
        
        userInfo.classList.add('hidden');
        usernameEl.innerText = '';
        gameContainer.classList.add('hidden');
    }
}

// --- EVENT LISTENERS ---

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);

playAiBtn.addEventListener('click', async () => {
    playAiBtn.disabled = true;
    playAiBtn.innerText = 'Creating game...';
    
    const game = await createGameWithAI();
    if (game) {
        currentGameId = game.id;
        gameContainer.classList.remove('hidden');
        statusEl.innerText = "Game Started!";
        streamGameState(game.id);
    } else {
        alert("Failed to create game. You might need to authenticate with specific scopes.");
    }
    
    playAiBtn.disabled = false;
    playAiBtn.innerHTML = '<i class="fa-solid fa-robot"></i> Play Stockfish';
});

if (playRandomBtn) {
    playRandomBtn.addEventListener('click', seekRandomOpponent);
}

// --- INITIALIZATION ---

async function init() {
    await handleCallback();
    await updateUI();
}

init();
