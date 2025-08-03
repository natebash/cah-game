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

function sanitizeGameCodeInput(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('input', (e) => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''));
    }
}

// --- DOM ELEMENTS & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;

    if (page === '/' || page.includes('index.html')) {
        setupIndexPage();
    } else if (page.includes('player.html')) {
        setupPlayerPage();
    } else if (page.includes('board.html')) {
        setupBoardPage();
    }

    // Auto-join if game code is in URL
    const gameCode = getGameCodeFromURL();
    if (gameCode) {
        socket.on('connect', () => { // Wait for connection before joining
            myPlayerId = socket.id;
            if (page.includes('board.html')) {
                socket.emit('joinGame', { code: gameCode, name: 'TV_BOARD' });
            } else if (page.includes('player.html')) {
                // Use playerToken for rejoining, fallback to hostToken for host's first join
                const playerName = sessionStorage.getItem('playerName');
                const playerToken = sessionStorage.getItem('playerToken');
                const hostToken = sessionStorage.getItem('hostToken');
                if (playerName) {
                    socket.emit('joinGame', { code: gameCode, name: playerName, token: playerToken || hostToken });
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
            sessionStorage.removeItem('playerToken'); // Clear old player token on new join
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

    // Auto-uppercase and sanitize game code inputs
    sanitizeGameCodeInput('game-code-input-player');
    sanitizeGameCodeInput('game-code-input-board');
}

function setupBoardPage() {
    // This is for the "Join New Game" button on the game over screen
    document.getElementById('board-join-btn-new').addEventListener('click', () => {
        const code = document.getElementById('game-code-input-board-new').value.toUpperCase();
        if (code) {
            navigateTo('board.html', code);
        }
    });
    sanitizeGameCodeInput('game-code-input-board-new');
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

    const voteToEndBtn = document.getElementById('vote-to-end-btn');
    if (voteToEndBtn) {
        voteToEndBtn.addEventListener('click', () => {
            socket.emit('voteToEnd', { code: gameState.code });
            voteToEndBtn.disabled = true;
            voteToEndBtn.textContent = 'Voted!';
        });
    }
}
// --- SOCKET.IO HANDLERS ---
socket.on('gameCreated', (data) => {
    sessionStorage.setItem('playerName', data.name);
    sessionStorage.setItem('hostToken', data.token); // Save the host token
    sessionStorage.removeItem('playerToken'); // Clear any previous player token
    navigateTo('player.html', data.code);
});

socket.on('joinSuccess', (data) => {
    sessionStorage.setItem('playerToken', data.token);
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

socket.on('voteUpdate', ({ voters, total }) => {
    const voteStatus = document.getElementById('vote-status');
    if (voteStatus) {
        const required = Math.ceil(total / 2);
        voteStatus.textContent = `(${voters}/${required} votes to end)`;
    }
});

socket.on('gameOver', ({ reason, winner }) => {    
    if (window.location.pathname.includes('board.html')) {
        document.getElementById('waiting-area').style.display = 'none';
        document.getElementById('round-area').style.display = 'none';
        
        const gameOverArea = document.getElementById('game-over-area');
        const finalWinnerEl = document.getElementById('final-winner-announcement');
        
        if (gameOverArea && finalWinnerEl) {
            let message = `<h2>Game Over!</h2><p>${reason}</p>`;
            if (winner) {
                message += `<p><strong>Winner: ${winner.name}</strong></p>`;
            }
            finalWinnerEl.innerHTML = message;
            gameOverArea.style.display = 'block';
        }
    } else if (window.location.pathname.includes('player.html')) {
        const gameOverView = document.getElementById('game-over-view-player');
        if (gameOverView) {
            document.getElementById('game-over-reason').textContent = reason;
            document.getElementById('game-over-winner').textContent = winner ? winner.name : 'N/A';
            
            document.getElementById('lobby-view').style.display = 'none';
            document.getElementById('game-view').style.display = 'none';
            document.getElementById('endless-game-actions').style.display = 'none';
            gameOverView.style.display = 'block';

            setTimeout(() => { window.location.href = '/'; }, 10000);
        }
    }
});

socket.on('youWereKicked', () => {
    alert("You have been kicked from the game by the host.");
    window.location.href = '/';
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
    if (gameState.state === 'finished') {
        return; // Don't re-render if the game is over
    }

    document.getElementById('game-code-display').textContent = gameState.code;
    
    document.getElementById('scoreboard').innerHTML = gameState.players
        .filter(p => p.name !== 'TV_BOARD')
        .sort((a, b) => b.score - a.score)
        .map(p => {
            const disconnected = p.disconnected ? ' disconnected' : '';
            const isCzar = p.id === gameState.currentCzar;
            let classes = 'score-item' + disconnected;
            if (isCzar) classes += ' czar';
            const czarIndicator = isCzar ? ' (Czar)' : '';
            const disconnectedIndicator = p.disconnected ? ' (disconnected)' : '';
            return `<div class="${classes}">${p.name}: ${p.score}${czarIndicator}${disconnectedIndicator}</div>`;
        }).join('');

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
    if (gameState.state === 'finished') {
        return; // Don't re-render if the game is over
    }

    const me = gameState.players.find(p => p.id === socket.id);
    if (!me) return;

    // --- Populate Scoreboard ---
    const scoreboard = document.getElementById('player-scoreboard');
    if (scoreboard) {
        scoreboard.innerHTML = '<h3>Scores</h3>' + gameState.players
            .filter(p => p.name !== 'TV_BOARD')
            .sort((a, b) => b.score - a.score)
            .map(p => {
                const disconnected = p.disconnected ? ' disconnected' : '';
                const isMe = p.id === socket.id;
                const isCzar = p.id === gameState.currentCzar;
                let classes = 'score-item' + disconnected;
                if (isMe) classes += ' me';
                if (isCzar) classes += ' czar';
                const czarIndicator = isCzar ? ' (Czar)' : '';
                const disconnectedIndicator = p.disconnected ? ' (disconnected)' : '';
                return `<div class="${classes}">${p.name}: ${p.score}${czarIndicator}${disconnectedIndicator}</div>`;
            }).join('');
    }

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

    // --- Endless Mode Actions ---
    const endlessActions = document.getElementById('endless-game-actions');
    if (gameState.isEndless && gameState.state !== 'waiting' && gameState.state !== 'finished') {
        endlessActions.style.display = 'block';

        const voteBtn = document.getElementById('vote-to-end-btn');
        const voteStatus = document.getElementById('vote-status');

        if (gameState.votesToEnd.includes(me.id)) {
            voteBtn.disabled = true;
            voteBtn.textContent = 'Voted!';
        } else {
            voteBtn.disabled = false;
            voteBtn.textContent = 'Vote to End Game';
        }

        const totalPlayers = gameState.players.filter(p => p.name !== 'TV_BOARD').length;
        const requiredVotes = Math.ceil(totalPlayers / 2);
        voteStatus.textContent = `(${gameState.votesToEnd.length}/${requiredVotes} votes to end)`;
    } else {
        endlessActions.style.display = 'none';
    }

    if (gameState.state === 'waiting') {
        document.getElementById('lobby-view').style.display = 'block';
        document.getElementById('game-view').style.display = 'none';
        document.getElementById('player-status').textContent = "Waiting for players to join...";
        
        const playerList = document.getElementById('player-list');
        playerList.innerHTML = ''; // Clear the list

        gameState.players.filter(p => p.name !== 'TV_BOARD').forEach(player => {
            const li = document.createElement('li');
            const hostIndicator = player.id === gameState.hostId ? ' (Host)' : '';
            const disconnectedIndicator = player.disconnected ? ' (disconnected)' : '';
            li.textContent = `${player.name}${hostIndicator}${disconnectedIndicator}`;
            if (player.disconnected) {
                li.classList.add('disconnected');
            }

            // Add a kick button if the current user is the host and the player is not the host
            if (isHost && player.id !== socket.id) {
                const kickBtn = document.createElement('button');
                kickBtn.textContent = 'Kick';
                kickBtn.className = 'kick-btn';
                kickBtn.onclick = () => socket.emit('kickPlayer', { code: gameState.code, playerIdToKick: player.id });
                li.appendChild(kickBtn);
            }
            playerList.appendChild(li);
        });

        const startGameContainer = document.getElementById('start-game-container');
        const activePlayers = gameState.players.filter(p => p.name !== 'TV_BOARD' && !p.disconnected);
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
