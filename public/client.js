// client.js
const socket = io({ transports: ['websocket'] });

// --- STATE MANAGEMENT ---
let gameState = {};
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
        input.addEventListener('input', (e) => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
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

    // Initial connection and auto-rejoin logic
    if (socket.connected) {
        joinGameFromURL();
    } else {
        socket.on('connect', joinGameFromURL);
    }
});

function joinGameFromURL() {
    const gameCode = getGameCodeFromURL();
    if (!gameCode) return;

    const page = window.location.pathname;

    if (page.includes('board.html')) {
        socket.emit('joinGame', { code: gameCode, name: 'TV_BOARD' });
    } else if (page.includes('player.html')) {
        // Get saved data from the browser session
        let playerName = sessionStorage.getItem('playerName');
        const playerToken = sessionStorage.getItem('playerToken');
        const hostToken = sessionStorage.getItem('hostToken');

        // This is the key change: Only prompt for a name if it's truly missing.
        // This is a fallback for direct navigation or errors, not the main flow.
        if (!playerName) {
            while (!playerName || playerName.trim() === "") {
                playerName = prompt("Please enter your name to join the game:", "");
                // If the user cancels the prompt, stop the process.
                if (playerName === null) {
                    alert("A name is required to join. Redirecting to homepage.");
                    window.location.href = '/';
                    return;
                }
            }
            // If we had to prompt, save the new name and clear any old tokens.
            sessionStorage.setItem('playerName', playerName.trim());
            sessionStorage.removeItem('playerToken');
            sessionStorage.removeItem('hostToken');
        }
        
        // Now, we can safely attempt to join the game with a valid name.
        socket.emit('joinGame', { code: gameCode, name: playerName, token: playerToken || hostToken });
    }
}

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

    // --- QR Code Generation ---
    const qrCodeElement = document.getElementById('qr-code');
    const joinUrlElement = document.getElementById('join-url-text');
    const gameCode = getGameCodeFromURL(); // Use existing function to get 'game' parameter

    if (gameCode && qrCodeElement) {
        // Construct the full URL for players to join, using the correct 'game' parameter
        const joinUrl = `${window.location.origin}/player.html?game=${gameCode}`;

        // Update the text element with a user-friendly message
        joinUrlElement.textContent = `Or go to: ${window.location.host}/player.html`;

        // Generate the QR code using the qrcode.js library
        // This relies on qrcode.js being included in board.html before client.js
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrCodeElement, {
                text: joinUrl,
                width: 128,
                height: 128,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            console.error('QRCode library is not loaded.');
        }
    }
}


function showNotification(message, duration = 4000) {
    const banner = document.getElementById('notification-banner');
    if (!banner) return;

    banner.textContent = message;
    banner.style.display = 'block';
    // Use a timeout to trigger the fade-in and slide-down transition
    setTimeout(() => {
        banner.style.opacity = 1;
        banner.style.transform = 'translateY(0)';
    }, 10);

    // Hide the banner after a delay
    setTimeout(() => {
        banner.style.opacity = 0;
        banner.style.transform = 'translateY(-20px)';
        setTimeout(() => { banner.style.display = 'none'; }, 500); // Wait for transition
    }, duration);
}

function showVoteModal(initiatorName) {
    const modal = document.getElementById('vote-to-end-modal');
    const modalText = document.getElementById('vote-modal-text');
    const me = gameState.players.find(p => p.id === socket.id);

    if (modal && modalText && me) {
        modalText.textContent = `${initiatorName} has proposed ending the game. A unanimous 'Yes' vote is required.`;
        modal.style.display = 'flex';

        // Disable buttons if player has already voted (or is the initiator)
        const voteYesBtn = document.getElementById('vote-yes-btn');
        const voteNoBtn = document.getElementById('vote-no-btn');
        if (gameState.voteToEndState.votes[me.id]) {
            voteYesBtn.disabled = true;
            voteNoBtn.disabled = true;
        } else {
            voteYesBtn.disabled = false;
            voteNoBtn.disabled = false;
        }
    }
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
                submitCardsBtn.parentElement.style.display = 'none';
            }
        });
    }

    const czarConfirmBtn = document.getElementById('czar-confirm-btn');
    if (czarConfirmBtn) {
        czarConfirmBtn.addEventListener('click', () => {
            if (czarSelection) {
                socket.emit('czarChoose', { code: gameState.code, winningCards: czarSelection });
                czarConfirmBtn.parentElement.style.display = 'none';
            }
        });
    }

    const voteToEndBtn = document.getElementById('vote-to-end-btn');
    if (voteToEndBtn) {
        voteToEndBtn.addEventListener('click', () => {
            socket.emit('initiateVoteToEnd', { code: gameState.code });
        });
    }

    const voteYesBtn = document.getElementById('vote-yes-btn');
    if (voteYesBtn) {
        voteYesBtn.addEventListener('click', () => {
            socket.emit('castVote', { code: gameState.code, vote: 'yes' });
            document.getElementById('vote-to-end-modal').style.display = 'none';
        });
    }

    const voteNoBtn = document.getElementById('vote-no-btn');
    if (voteNoBtn) {
        voteNoBtn.addEventListener('click', () => {
            socket.emit('castVote', { code: gameState.code, vote: 'no' });
            document.getElementById('vote-to-end-modal').style.display = 'none';
        });
    }

    // --- Event Delegation for Dynamic Elements ---
    document.body.addEventListener('click', (e) => {
        // Kick Player Button in Lobby
        if (e.target.matches('.kick-btn')) {
            const playerIdToKick = e.target.dataset.playerId;
            socket.emit('kickPlayer', { code: gameState.code, playerIdToKick });
        }

      // Player Hand Card Selection
const cardButton = e.target.closest('#my-hand .card.white');
if (cardButton && !cardButton.disabled && cardButton.dataset.cardIndex) {
    // Look up the player and the card index
    const me = gameState.players.find(p => p.id === socket.id);
    const cardIndex = parseInt(cardButton.dataset.cardIndex, 10);
    const cardText = me.hand[cardIndex];

    if (cardText === '___BLANK_CARD___') {
        const pickCount = gameState.currentBlackCard.pick;
        if (pickCount > 1 && !confirm(`This black card requires ${pickCount} answers. Submitting a blank card will only use your one custom answer. Continue?`)) {
            return;
        }
        document.getElementById('blank-card-modal').style.display = 'flex';
    } else {
        handleCardSelect(cardText);
    }
}

       // Czar Card Selection
       const cardGroup = e.target.closest('#cards-to-judge .card-group');
       if (cardGroup && cardGroup.dataset.playerId) {
       const selectedPlayerId = cardGroup.dataset.playerId;
       const submission = gameState.submissions[selectedPlayerId];
       if (submission) {
        handleCzarSelect(submission);
       }
  }
    });

    // --- Blank Card Modal Logic ---
    const blankCardModal = document.getElementById('blank-card-modal');
    if (blankCardModal) {
        const blankCardSubmitBtn = document.getElementById('blank-card-submit-btn');
        const textarea = document.getElementById('blank-card-input');
        const charCount = document.getElementById('char-count');
        const blankCardCancelBtn = document.getElementById('blank-card-cancel-btn');
        blankCardCancelBtn.addEventListener('click', () => {
            blankCardModal.style.display = 'none';
            textarea.value = ''; // Clear text
        });
        blankCardSubmitBtn.addEventListener('click', () => {
            const cardText = textarea.value.trim();
            if (cardText.length > 0 && cardText.length <= 150) {
                socket.emit('submitBlankCard', { code: gameState.code, cardText: cardText });
                blankCardModal.style.display = 'none';
                textarea.value = ''; // Clear for next time
                document.getElementById('submit-cards-btn').parentElement.style.display = 'none'; // Hide regular submit button
            } else {
                showNotification('Card text must be between 1 and 150 characters.');
            }
        });

        textarea.addEventListener('input', () => {
            const count = textarea.value.length;
            charCount.textContent = `${count} / 150`;
            blankCardSubmitBtn.disabled = (count === 0);
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
    // If the state transitions to 'playing', it's a new round. Reset Czar selection.
    if (game.state === 'playing' && gameState.state !== 'playing') {
        czarSelection = null;
    }

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

socket.on('voteToEndStarted', ({ initiatorName }) => {
    showVoteModal(initiatorName);
});

socket.on('voteToEndResult', ({ passed, reason }) => {
    const modal = document.getElementById('vote-to-end-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    showNotification(reason);
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
    // Critical errors that should send the user home
    const criticalErrors = ['Game not found.', 'That name is already taken.'];
    if (criticalErrors.includes(msg)) {
        // Clear the stored data that caused the error
        sessionStorage.removeItem('playerName');
        sessionStorage.removeItem('playerToken');
        sessionStorage.removeItem('hostToken');

        alert(msg + "\n\nYou will be redirected to the homepage.");
        window.location.href = '/';
        return;
    }

    const errorEl = document.getElementById('error-message');
    if (errorEl) { // This is on the index page
        errorEl.textContent = msg;
    } else { // For non-critical errors on other pages
        showNotification(msg, 5000);
    }
});

socket.on('disconnect', () => {
  showNotification('Connection lost! Attempting to reconnect...', 999999); // Show a very long notification
});

socket.on('reconnect', () => {
    showNotification('Reconnected successfully!', 4000);
    joinGameFromURL();
});

// --- HTML TEMPLATE FUNCTIONS ---

/** Creates the HTML for the player list in the lobby. */
function createLobbyPlayerListHTML(players, isHost, myId) {
    return players
        .filter(p => p.name !== 'TV_BOARD')
        .map(player => {
            const hostIndicator = player.id === gameState.hostId ? ' (Host)' : '';
            const disconnectedIndicator = player.disconnected ? ' (disconnected)' : '';
            const kickButton = (isHost && player.id !== myId)
                ? `<button class="kick-btn" data-player-id="${player.id}">Kick</button>`
                : '';
            const disconnectedClass = player.disconnected ? ' class="disconnected"' : '';

            return `<li${disconnectedClass}>${player.name}${hostIndicator}${disconnectedIndicator}${kickButton}</li>`;
        }).join('');
}

/** Creates the HTML for the player's hand of cards. */
function createPlayerHandHTML(me, isCzar, submitted) {
    // We now include the 'index' of the card
    return me.hand.map((cardText, index) => {
        const isDisabled = isCzar || submitted || gameState.state !== 'playing';
        const isSelected = selectedCards.includes(cardText);
        const isBlank = cardText === '___BLANK_CARD___';

        let classes = 'card white';
        if (isBlank) classes += ' blank';
        if (isSelected) classes += ' selected';

        const content = isBlank ? `<p>Write your own card!</p>` : `<p>${cardText}</p>`;

        // CHANGE: Use the safe 'data-card-index' instead of 'data-card-text'
        return `<button class="${classes}" data-card-index="${index}" ${isDisabled ? 'disabled' : ''}>${content}</button>`;
    }).join('');
}
/** Creates the HTML for the submissions the Czar needs to judge. */
function createCzarChoicesHTML(submissions, czarSelection) {
    let html = '';
    for (const playerId in submissions) {
        const submission = submissions[playerId];
        const isSelected = czarSelection && JSON.stringify(czarSelection) === JSON.stringify(submission);
        const selectedClass = isSelected ? ' czar-selected' : '';

        // CHANGE: Store the playerId instead of the full submission object.
        html += `<div class="card-group interactive${selectedClass}" data-player-id="${playerId}">
            ${submission.map(cardText => `<div class="card white"><p>${cardText}</p></div>`).join('')}
        </div>`;
    }
    return html;
}

/** Creates the HTML for the main scoreboard on the board view. */
function createBoardScoreboardHTML(players, currentCzarId) {
    return players
        .filter(p => p.name !== 'TV_BOARD')
        .sort((a, b) => b.score - a.score)
        .map(p => {
            const isCzar = p.id === currentCzarId;
            const disconnectedClass = p.disconnected ? ' disconnected' : '';
            const czarClass = isCzar ? ' czar' : '';
            const czarIndicator = isCzar ? ' (Czar)' : '';
            const disconnectedIndicator = p.disconnected ? ' (disconnected)' : '';

            return `<div class="score-item ${disconnectedClass} ${czarClass}">${p.name}: ${p.score}${czarIndicator}${disconnectedIndicator}</div>`;
        }).join('');
}

/** Creates the HTML for the submissions area on the board view. */
function createBoardSubmissionsHTML(state, submissions) {
    if (state === 'judging') {
        let html = '';
        for (const playerId in submissions) {
            html += `<div class="card-group">
                ${submissions[playerId].map(cardText => `<div class="card white"><p>${cardText}</p></div>`).join('')}
            </div>`;
        }
        return html;
    } else {
        const submissionCount = Object.keys(submissions).length;
        return '<div class="card white back"></div>'.repeat(submissionCount);
    }
}


// --- RENDER LOGIC ---
function renderBoard() {
    if (gameState.state === 'finished') {
        return; // Don't re-render if the game is over
    }

    document.getElementById('game-over-area').style.display = 'none';

    document.getElementById('game-code-display').textContent = gameState.code;
    document.getElementById('scoreboard').innerHTML = createBoardScoreboardHTML(gameState.players, gameState.currentCzar);
    adjustScoreboardFontSize();
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

        document.getElementById('submissions-area').innerHTML = createBoardSubmissionsHTML(gameState.state, gameState.submissions);
        
       
const winnerAnnouncement = document.getElementById('winner-announcement');
if (gameState.roundWinnerInfo) {
    winnerAnnouncement.innerHTML = `<p><strong>${gameState.roundWinnerInfo.name}</strong> won with:</p>
    <div class="card-group">
        ${gameState.roundWinnerInfo.cards.map(c => `<div class="card white"><p>${c}</p></div>`).join('')}
    </div>`;
    // Add the 'visible' class to trigger the animation
    winnerAnnouncement.classList.add('visible');
} else {
    // Remove the 'visible' class to hide it
    winnerAnnouncement.classList.remove('visible');
}
// ...
    }

    renderVoteDisplay();
}
/**
 * Dynamically adjusts the scoreboard font size to prevent overflow.
 */
function adjustScoreboardFontSize() {
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) return;

    // Reset font size to a default large size first
    const defaultFontSize = 1.5; // in rem
    scoreboard.querySelectorAll('.score-item').forEach(item => {
        item.style.fontSize = `${defaultFontSize}rem`;
    });

    let currentFontSize = defaultFontSize;
    let safetyBreak = 0; // Prevents an infinite loop

    // Shrink the font size until the content fits within the container width
    while (scoreboard.scrollWidth > scoreboard.clientWidth && safetyBreak < 20) {
        currentFontSize -= 0.1; // Decrease by 0.1rem
        scoreboard.querySelectorAll('.score-item').forEach(item => {
            item.style.fontSize = `${currentFontSize}rem`;
        });
        safetyBreak++;
    }
}
function renderPlayer() {
    if (gameState.state === 'finished') {
        return; // Don't re-render if the game is over
    }

    const me = gameState.players.find(p => p.id === socket.id);
    if (!me) return;

    // --- Populate Scoreboard ---
    const scoreboardContent = document.querySelector('#player-scoreboard .scoreboard-content');
    if (scoreboardContent) {
        scoreboardContent.innerHTML = gameState.players
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
                return `<div class="${classes}"><span class="name">${p.name}${czarIndicator}${disconnectedIndicator}</span><span class="score">${p.score}</span></div>`;
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

        const voteToEndBtn = document.getElementById('vote-to-end-btn');
        voteToEndBtn.disabled = gameState.voteToEndState.inProgress;
        voteToEndBtn.textContent = gameState.voteToEndState.inProgress ? 'Vote in Progress...' : 'Vote to End Game';
    } else {
        endlessActions.style.display = 'none';
    }

    // Show or hide the vote modal based on game state
    const voteModal = document.getElementById('vote-to-end-modal');
    if (gameState.voteToEndState.inProgress) {
        showVoteModal(gameState.voteToEndState.initiatorName);
    } else if (voteModal.style.display !== 'none') {
        voteModal.style.display = 'none';
    }

    if (gameState.state === 'waiting') {
        document.getElementById('lobby-view').style.display = 'block';
        document.getElementById('game-view').style.display = 'none';
        document.getElementById('player-status').textContent = "Waiting for players to join...";
        document.getElementById('player-list').innerHTML = createLobbyPlayerListHTML(gameState.players, isHost, socket.id);

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
        
        const myHandDiv = document.getElementById('my-hand');
        const czarJudgingArea = document.getElementById('czar-judging-area');
        const playerStatus = document.getElementById('player-status');
        czarJudgingArea.style.display = 'none';

        if (isCzar) {
            // If the player is the Czar, hide their hand.
            myHandDiv.style.display = 'none';
            myHandDiv.innerHTML = ''; // Clear the hand to be safe

            if (gameState.state === 'judging') {
                playerStatus.textContent = 'You are the Card Czar. Choose your favorite!';
                czarJudgingArea.style.display = 'block';
                document.getElementById('cards-to-judge').innerHTML = createCzarChoicesHTML(gameState.submissions, czarSelection);
            } else {
                playerStatus.textContent = "You are the Card Czar. Sit back and wait.";
            }
        } else {
            // If the player is not the Czar, show and render their hand.
            myHandDiv.style.display = 'flex';
            myHandDiv.innerHTML = createPlayerHandHTML(me, isCzar, submitted);

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

function handleCzarSelect(submission) {
    czarSelection = submission;
    document.getElementById('czar-confirm-container').style.display = 'block';
    // Re-render to show the highlight
    document.getElementById('cards-to-judge').innerHTML = createCzarChoicesHTML(gameState.submissions, czarSelection);
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
    
    // Update submit button visibility
    const submitContainer = document.getElementById('submit-button-container');
    if (selectedCards.length === pickCount) {
        submitContainer.style.display = 'block';
    } else {
        submitContainer.style.display = 'none';
    }
    // Re-render to show selection state
    renderPlayer();
}

function renderVoteDisplay() {
    const voteArea = document.getElementById('vote-display-area');
    if (!voteArea) return;

    if (gameState.voteToEndState.inProgress) {
        voteArea.style.display = 'block';
        document.getElementById('vote-initiator-name').textContent = gameState.voteToEndState.initiatorName;

        const resultsList = document.getElementById('vote-results-list');
        resultsList.innerHTML = '';

        const activePlayers = gameState.players.filter(p => p.name !== 'TV_BOARD' && !p.disconnected);

        activePlayers.forEach(player => {
            const vote = gameState.voteToEndState.votes[player.id];
            let statusText = 'Waiting...';
            let statusClass = 'waiting';

            if (vote === 'yes') {
                statusText = 'Yes';
                statusClass = 'yes';
            } else if (vote === 'no') {
                statusText = 'No';
                statusClass = 'no';
            }

            resultsList.innerHTML += `<div class="vote-result-item"><span>${player.name}</span><span class="status ${statusClass}">${statusText}</span></div>`;
        });
    } else {
        voteArea.style.display = 'none';
    }
}
