// client.js
const socket = io();

// --- STATE MANAGEMENT ---
let gameState = {};
let myPlayerId = null;
let selectedCards = [];
let czarSelection = null;

// --- UTILITY FUNCTIONS ---
function getGameCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('game');
}

function navigateTo(page, gameCode) {
    window.location.href = `${page}?game=${gameCode}`;
}

// --- DOM ELEMENTS & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;

    if (page === '/' || page.includes('index.html')) {
        setupIndexPage();
    } else if (page.includes('player.html')) {
        setupPlayerPage();
    }

    // Auto-join if game code is in URL
    const gameCode = getGameCodeFromURL();
    if (gameCode) {
        socket.on('connect', () => { // Wait for connection before joining
            myPlayerId = socket.id;
            if (page.includes('board.html')) {
                socket.emit('joinGame', { code: gameCode, name: 'TV_BOARD' });
            } else if (page.includes('player.html')) {
                const playerName = sessionStorage.getItem('playerName');
                const hostToken = sessionStorage.getItem('hostToken');
                if (playerName) {
                    socket.emit('joinGame', { code: gameCode, name: playerName, token: hostToken });
                }
            }
        });
    }
});

function setupIndexPage() {
    // --- Menu Navigation ---
    const mainMenu = document.getElementById('main-menu');
    const views = document.querySelectorAll('.menu-view');
    
    document.getElementById('show-create-btn').addEventListener('click', () => {
        mainMenu.style.display = 'none';
        document.getElementById('create-game-view').style.display = 'block';
    });
    document.getElementById('show-join-btn').addEventListener('click', () => {
        mainMenu.style.display = 'none';
        document.getElementById('join-game-view').style.display = 'block';
    });
    document.getElementById('show-board-btn').addEventListener('click', () => {
        mainMenu.style.display = 'none';
        document.getElementById('board-game-view').style.display = 'block';
    });

    document.querySelectorAll('.back-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            views.forEach(view => view.style.display = 'none');
            mainMenu.style.display = 'block';
        });
    });

    // --- Actions ---
    document.getElementById('create-btn').addEventListener('click', () => {
        const name = document.getElementById('create-name').value;
        const winTarget = document.getElementById('win-target').value;
        const isEndless = document.getElementById('endless-mode').checked;
        if (name) {
            socket.emit('createGame', { name, winTarget, isEndless });
        }
    });

    document.getElementById('join-btn').addEventListener('click', () => {
        const name = document.getElementById('join-name').value;
        const code = document.getElementById('game-code-input-player').value.toUpperCase();
        if (name && code) {
            sessionStorage.setItem('playerName', name);
            // We don't want to carry over a host token if we are a regular player
            sessionStorage.removeItem('hostToken');
            navigateTo('player.html', code);
        }
    });

    document.getElementById('board-join-btn').addEventListener('click', () => {
        const code = document.getElementById('game-code-input-board').value.toUpperCase();
        if (code) {
            navigateTo('board.html', code);
        }
    });

    document.getElementById('endless-mode').addEventListener('change', (e) => {
        document.getElementById('win-target').disabled = e.target.checked;
    });
}

function setupPlayerPage() {
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            socket.emit('startGame', getGameCodeFromURL());
        });
    }

    const submitCardsBtn = document.getElementById('submit-cards-btn');
    if (submitCardsBtn) {
        submitCardsBtn.addEventListener('click', () => {
            if (selectedCards.length > 0) {
                socket.emit('submitCard', { code: gameState.code, cards: selectedCards });
                document.getElementById('submit-button-container').style.display = 'none';
            }
        });
    }

    const czarConfirmBtn = document.getElementById('czar-confirm-btn');
    if (czarConfirmBtn) {
        czarConfirmBtn.addEventListener('click', () => {
            if (czarSelection) {
                socket.emit('czarChoose', { code: gameState.code, winningCards: czarSelection });
                czarSelection = null; // Reset after confirming
            }
        });
    }
}
// --- SOCKET.IO HANDLERS ---
socket.on('gameCreated', (data) => {
    sessionStorage.setItem('playerName', data.name);
    sessionStorage.setItem('hostToken', data.token); // Save the host token
    navigateTo('player.html', data.code);
});

socket.on('gameUpdate', (game) => {
    gameState = game;
    // Reset selection on update unless we are in the middle of judging
    if (gameState.state !== 'judging') {
        const me = gameState.players.find(p => p.id === socket.id);
        const submitted = me && !!gameState.submissions[me.id];
        if(!submitted) {
            selectedCards = [];
        }
    }

    if (window.location.pathname.includes('board.html')) {
        renderBoard();
    } else if (window.location.pathname.includes('player.html')) {
        renderPlayer();
    }
});

socket.on('gameOver', ({ reason, winner }) => {
    const announcement = document.getElementById('winner-announcement');
    if (announcement) {
        let message = `<h2>Game Over!</h2><p>${reason}</p>`;
        if (winner) {
            message += `<p><strong>Winner: ${winner.name}</strong></p>`;
        }
        announcement.innerHTML = message;
        announcement.style.display = 'block';

        const roundArea = document.getElementById('round-area');
        if (roundArea) {
            roundArea.style.display = 'none';
        }
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
    document.getElementById('game-code-display').textContent = gameState.code;
    
    document.getElementById('scoreboard').innerHTML = gameState.players
        .filter(p => p.name !== 'TV_BOARD')
        .map(p => `<div class="score-item">${p.name}: ${p.score}</div>`).join('');

    if (gameState.state === 'waiting') {
        document.getElementById('waiting-area').style.display = 'block';
        document.getElementById('round-area').style.display = 'none';
        document.getElementById('game-code-waiting').textContent = gameState.code;
    } else {
        document.getElementById('waiting-area').style.display = 'none';
        document.getElementById('round-area').style.display = 'block';

        if (gameState.currentBlackCard) {
            document.getElementById('black-card-text').innerHTML = gameState.currentBlackCard.text.replace(/_/g, '______');
        }

        const submissionsArea = document.getElementById('submissions-area');
        submissionsArea.innerHTML = '';
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
                submissionsArea.appendChild(cardGroup);
            }
        } else {
            const submissionCount = Object.keys(gameState.submissions).length;
            for (let i = 0; i < submissionCount; i++) {
                submissionsArea.innerHTML += '<div class="card white back"></div>';
            }
        }
        
        const winnerAnnouncement = document.getElementById('winner-announcement');
        if (gameState.roundWinnerInfo) {
            winnerAnnouncement.innerHTML = `<p><strong>${gameState.roundWinnerInfo.name}</strong> won with:</p>
            <div class="card-group">
                ${gameState.roundWinnerInfo.cards.map(c => `<div class="card white"><p>${c}</p></div>`).join('')}
            </div>`;
            winnerAnnouncement.style.display = 'block';
        } else {
            winnerAnnouncement.style.display = 'none';
        }
    }
}

function renderPlayer() {
    const me = gameState.players.find(p => p.id === socket.id);
    if (!me) return;

    document.getElementById('player-name').textContent = me.name;
    document.getElementById('player-score').textContent = me.score;
    const isHost = gameState.hostId === socket.id;

    const gameCodeBox = document.getElementById('game-code-box');
    if (isHost) {
        gameCodeBox.style.display = 'block';
        document.getElementById('game-code-display').textContent = gameState.code;
    } else {
        gameCodeBox.style.display = 'none';
    }

    if (gameState.state === 'waiting') {
        document.getElementById('lobby-view').style.display = 'block';
        document.getElementById('game-view').style.display = 'none';
        document.getElementById('player-status').textContent = "Waiting for players to join...";
        
        const playerList = document.getElementById('player-list');
        playerList.innerHTML = gameState.players
            .filter(p => p.name !== 'TV_BOARD')
            .map(p => `<li>${p.name} ${p.id === gameState.hostId ? '(Host)' : ''}</li>`).join('');

        const startGameContainer = document.getElementById('start-game-container');
        const activePlayers = gameState.players.filter(p => p.name !== 'TV_BOARD');
        if (isHost && activePlayers.length >= 2) {
            startGameContainer.style.display = 'block';
        } else {
            startGameContainer.style.display = 'none';
        }
    } else {
        document.getElementById('lobby-view').style.display = 'none';
        document.getElementById('game-view').style.display = 'block';

        const blackCardTextPlayer = document.getElementById('black-card-text-player');
        if (gameState.currentBlackCard) {
            blackCardTextPlayer.innerHTML = gameState.currentBlackCard.text.replace(/_/g, '______');
        }
        
        const isCzar = gameState.currentCzar === socket.id;
        const submitted = !!gameState.submissions[socket.id];
        
        const myHand = document.getElementById('my-hand');
        myHand.innerHTML = '';
        me.hand.forEach(cardText => {
            const cardButton = document.createElement('button');
            cardButton.className = 'card white';
            cardButton.innerHTML = `<p>${cardText}</p>`;
            cardButton.disabled = isCzar || submitted || gameState.state !== 'playing';
            if (selectedCards.includes(cardText)) {
                cardButton.classList.add('selected');
            }
            cardButton.addEventListener('click', () => handleCardSelect(cardText));
            myHand.appendChild(cardButton);
        });
        
        const czarJudgingArea = document.getElementById('czar-judging-area');
        const playerStatus = document.getElementById('player-status');
        czarJudgingArea.style.display = 'none';

        if (isCzar) {
            if (gameState.state === 'judging') {
                playerStatus.textContent = 'You are the Card Czar. Choose your favorite!';
                czarJudgingArea.style.display = 'block';
                renderCzarChoices();
            } else {
                playerStatus.textContent = "You are the Card Czar. Sit back and wait.";
            }
        } else {
            const pickCount = gameState.currentBlackCard ? gameState.currentBlackCard.pick : 1;
            if (submitted) {
                playerStatus.textContent = 'Your submission is in. Waiting for others.';
            } else if (gameState.state === 'playing') {
                playerStatus.textContent = `Pick ${pickCount} card${pickCount > 1 ? 's' : ''}.`;
            } else {
                playerStatus.textContent = "Waiting for the round to start...";
            }
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
    
    renderPlayer(); // Re-render to show selection state
    
    // Update submit button visibility
    const submitContainer = document.getElementById('submit-button-container');
    if (selectedCards.length === pickCount) {
        submitContainer.style.display = 'block';
    } else {
        submitContainer.style.display = 'none';
    }
}

function renderCzarChoices() {
    const cardsToJudge = document.getElementById('cards-to-judge');
    const confirmContainer = document.getElementById('czar-confirm-container');
    cardsToJudge.innerHTML = '';

    for (const playerId in gameState.submissions) {
        const submission = gameState.submissions[playerId];
        const cardGroup = document.createElement('div');
        cardGroup.className = 'card-group interactive';

        // Check if this submission is the one the Czar has pre-selected
        if (czarSelection && JSON.stringify(czarSelection) === JSON.stringify(submission)) {
            cardGroup.classList.add('czar-selected');
        }
        
        submission.forEach(cardText => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card white';
            cardDiv.innerHTML = `<p>${cardText}</p>`;
            cardGroup.appendChild(cardDiv);
        });

        cardGroup.addEventListener('click', () => {
            czarSelection = submission; // Pre-select this card
            renderCzarChoices(); // Re-render to show the highlight
        });
        cardsToJudge.appendChild(cardGroup);
    }
    
    // Show or hide the confirm button based on whether a card is selected
    if (czarSelection) {
        confirmContainer.style.display = 'block';
    } else {
        confirmContainer.style.display = 'none';
    }
}
