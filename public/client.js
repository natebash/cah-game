// client.js
const socket = io();

// --- STATE MANAGEMENT ---
let gameState = {};
let myPlayerId = null;
let selectedCards = [];

// --- UTILITY FUNCTIONS ---
function getGameCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('game');
}

function navigateTo(page, gameCode) {
    window.location.href = `${page}?game=${gameCode}`;
}

// --- DOM ELEMENTS (fetched once) ---
// Using a function to query elements based on the current page
function getElements() {
    // Index Page
    const createBtn = document.getElementById('create-btn');
    const joinBtn = document.getElementById('join-btn');
    const toggleLink = document.getElementById('toggle-view-link');
    
    // Board Page
    const gameCodeDisplay = document.getElementById('game-code-display');
    const scoreboard = document.getElementById('scoreboard');
    const waitingArea = document.getElementById('waiting-area');
    const roundArea = document.getElementById('round-area');
    const blackCardText = document.getElementById('black-card-text');
    const submissionsArea = document.getElementById('submissions-area');
    const winnerAnnouncement = document.getElementById('winner-announcement');

    // Player Page
    const playerNameDisplay = document.getElementById('player-name');
    const playerScoreDisplay = document.getElementById('player-score');
    const playerStatus = document.getElementById('player-status');
    const blackCardTextPlayer = document.getElementById('black-card-text-player');
    const myHand = document.getElementById('my-hand');
    const czarJudgingArea = document.getElementById('czar-judging-area');

    return { 
        createBtn, joinBtn, toggleLink, gameCodeDisplay, scoreboard, waitingArea,
        roundArea, blackCardText, submissionsArea, winnerAnnouncement,
        playerNameDisplay, playerScoreDisplay, playerStatus, blackCardTextPlayer,
        myHand, czarJudgingArea
    };
}
const elements = getElements();

// --- EVENT LISTENERS ---

// Index Page Logic
if (elements.createBtn) {
    elements.createBtn.addEventListener('click', () => {
        const name = document.getElementById('create-name').value;
        const winTarget = document.getElementById('win-target').value;
        const isEndless = document.getElementById('endless-mode').checked;
        if (name) {
            socket.emit('createGame', { name, winTarget, isEndless });
        }
    });

    document.getElementById('endless-mode')?.addEventListener('change', (e) => {
        document.getElementById('win-target').disabled = e.target.checked;
    });

    elements.toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        const createView = document.getElementById('create-game-view');
        const joinView = document.getElementById('join-game-view');
        if (createView.style.display !== 'none') {
            createView.style.display = 'none';
            joinView.style.display = 'block';
            elements.toggleLink.textContent = 'Want to create a game instead?';
        } else {
            createView.style.display = 'block';
            joinView.style.display = 'none';
            elements.toggleLink.textContent = 'Want to join a game instead?';
        }
    });
}

if (elements.joinBtn) {
    elements.joinBtn.addEventListener('click', () => {
        const name = document.getElementById('join-name').value;
        const code = document.getElementById('game-code-input').value.toUpperCase();
        if (name && code) {
            // First, check if we're joining as board or player
            const isBoard = window.location.pathname.includes('board.html');
            if (isBoard) {
                // The board doesn't need a name and joins directly
                 socket.emit('joinGame', { code, name: 'TV_BOARD' });
            } else {
                // Store name and code, then navigate
                sessionStorage.setItem('playerName', name);
                navigateTo('player.html', code);
            }
        }
    });
}

// --- SOCKET.IO HANDLERS ---
socket.on('connect', () => {
    myPlayerId = socket.id;
    // Auto-join if game code is in URL
    const gameCode = getGameCodeFromURL();
    if (gameCode) {
        const playerName = sessionStorage.getItem('playerName');
        const isBoard = window.location.pathname.includes('board.html');
        if (isBoard) {
            socket.emit('joinGame', { code: gameCode, name: 'TV_BOARD' });
        } else if (playerName) {
            socket.emit('joinGame', { code: gameCode, name: playerName });
        }
    }
});

socket.on('gameCreated', (game) => {
    sessionStorage.setItem('playerName', game.players[0].name);
    // Navigate to player page for the creator, and board page in a new tab
    navigateTo('player.html', game.code);
    window.open(window.location.origin + `/board.html?game=${game.code}`, '_blank');
});

socket.on('gameUpdate', (game) => {
    gameState = game;
    selectedCards = []; // Reset selection on each update
    if (window.location.pathname.includes('board.html')) {
        renderBoard();
    } else if (window.location.pathname.includes('player.html')) {
        renderPlayer();
    }
});

socket.on('gameOver', ({ reason, winner }) => {
    if (elements.winnerAnnouncement) {
        let message = `<h2>Game Over!</h2><p>${reason}</p>`;
        if(winner) {
            message += `<p><strong>Winner: ${winner.name}</strong></p>`;
        }
        elements.winnerAnnouncement.innerHTML = message;
        elements.winnerAnnouncement.style.display = 'block';
        if(elements.roundArea) elements.roundArea.style.display = 'none';
    }
});

socket.on('errorMsg', (msg) => {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = msg;
    } else {
        alert(msg);
    }
});

// --- RENDER FUNCTIONS ---
function renderBoard() {
    elements.gameCodeDisplay.textContent = gameState.code;
    
    // Scoreboard
    elements.scoreboard.innerHTML = gameState.players
        .filter(p => p.name !== 'TV_BOARD')
        .map(p => `<div class="score-item">${p.name}: ${p.score}</div>`).join('');

    if (gameState.state === 'waiting') {
        elements.waitingArea.style.display = 'block';
        elements.roundArea.style.display = 'none';
        document.getElementById('game-code-waiting').textContent = gameState.code;
    } else {
        elements.waitingArea.style.display = 'none';
        elements.roundArea.style.display = 'block';

        // Black Card
        elements.blackCardText.innerHTML = gameState.currentBlackCard.text.replace(/_/g, '______');

        // Submissions
        elements.submissionsArea.innerHTML = '';
        if (gameState.state === 'judging') {
            for (const playerId in gameState.submissions) {
                const cardGroup = document.createElement('div');
                cardGroup.className = 'card-group';
                gameState.submissions[playerId].forEach(cardText => {
                    const cardDiv = document.createElement('div');
                    cardDiv.className = 'card white';
                    cardDiv.innerHTML = `<p>${cardText}</p>`;
                    cardGroup.appendChild(cardDiv);
                });
                elements.submissionsArea.appendChild(cardGroup);
            }
        } else {
            const submissionCount = Object.keys(gameState.submissions).length;
            for(let i=0; i < submissionCount; i++) {
                 elements.submissionsArea.innerHTML += '<div class="card white back"></div>';
            }
        }
        
        // Winner Announcement
        if(gameState.roundWinnerInfo) {
            elements.winnerAnnouncement.innerHTML = `<p><strong>${gameState.roundWinnerInfo.name}</strong> won with:</p>
            <div class="card-group">
                ${gameState.roundWinnerInfo.cards.map(c => `<div class="card white"><p>${c}</p></div>`).join('')}
            </div>`;
            elements.winnerAnnouncement.style.display = 'block';
        } else {
            elements.winnerAnnouncement.style.display = 'none';
        }
    }
}

function renderPlayer() {
    const me = gameState.players.find(p => p.id === myPlayerId);
    if (!me) return;

    elements.playerNameDisplay.textContent = me.name;
    elements.playerScoreDisplay.textContent = me.score;
    elements.blackCardTextPlayer.innerHTML = gameState.currentBlackCard ? gameState.currentBlackCard.text.replace(/_/g, '______') : 'Waiting for round...';
    
    const isCzar = gameState.currentCzar === myPlayerId;
    const submitted = !!gameState.submissions[myPlayerId];
    
    // Render Hand
    elements.myHand.innerHTML = '';
    me.hand.forEach(cardText => {
        const cardDiv = document.createElement('button');
        cardDiv.className = 'card white';
        cardDiv.innerHTML = `<p>${cardText}</p>`;
        cardDiv.disabled = isCzar || submitted || gameState.state !== 'playing';
        if (selectedCards.includes(cardText)) {
            cardDiv.classList.add('selected');
        }

        cardDiv.addEventListener('click', () => handleCardSelect(cardText));
        elements.myHand.appendChild(cardDiv);
    });
    
    // Status and Judging Area
    elements.czarJudgingArea.style.display = 'none';
    if (isCzar) {
        if (gameState.state === 'judging') {
            elements.playerStatus.textContent = 'Choose your favorite!';
            elements.czarJudgingArea.style.display = 'block';
            renderCzarChoices();
        } else {
            elements.playerStatus.textContent = "You are the Card Czar. Sit back and wait.";
        }
    } else {
        const pickCount = gameState.currentBlackCard?.pick || 1;
        if (submitted) {
            elements.playerStatus.textContent = 'Your card is in. Waiting for others.';
        } else if(gameState.state === 'playing') {
            elements.playerStatus.textContent = `Pick ${pickCount} card${pickCount > 1 ? 's' : ''}.`;
        } else {
            elements.playerStatus.textContent = "Waiting for the round to start...";
        }
    }
}

function handleCardSelect(cardText) {
    const pickCount = gameState.currentBlackCard.pick;
    const index = selectedCards.indexOf(cardText);
    
    if (index > -1) {
        selectedCards.splice(index, 1); // Deselect
    } else {
        if (selectedCards.length < pickCount) {
            selectedCards.push(cardText); // Select
        }
    }

    if (selectedCards.length === pickCount) {
        // Automatically submit when the required number of cards is selected
        socket.emit('submitCard', { code: gameState.code, cards: selectedCards });
    }
    
    renderPlayer(); // Re-render to show selection state
}

function renderCzarChoices() {
    const cardsToJudge = document.getElementById('cards-to-judge');
    cardsToJudge.innerHTML = '';
    for (const playerId in gameState.submissions) {
        const submission = gameState.submissions[playerId];
        const cardGroup = document.createElement('div');
        cardGroup.className = 'card-group interactive';
        
        submission.forEach(cardText => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card white';
            cardDiv.innerHTML = `<p>${cardText}</p>`;
            cardGroup.appendChild(cardDiv);
        });

        cardGroup.addEventListener('click', () => {
            socket.emit('czarChoose', { code: gameState.code, winningCards: submission });
        });
        cardsToJudge.appendChild(cardGroup);
    }
}