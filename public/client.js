// client.js
const socket = io({ transports: ['websocket'] });

// --- STATE MANAGEMENT ---
let gameState = {};
let selectedCardIndices = []; // CHANGE: Store indices, not card text
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

        if (!playerName) {
            while (!playerName || playerName.trim() === "") {
                playerName = prompt("Please enter your name to join the game:", "");
                if (playerName === null) {
                    alert("A name is required to join. Redirecting to homepage.");
                    window.location.href = '/';
                    return;
                }
            }
            sessionStorage.setItem('playerName', playerName.trim());
            sessionStorage.removeItem('playerToken');
            sessionStorage.removeItem('hostToken');
        }
        
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
        const isDemocratic = document.getElementById('democratic-mode').checked; // CHANGE: Read democratic mode
        if (name) {
            // CHANGE: Send isDemocratic flag to server
            socket.emit('createGame', { name, winTarget, isEndless, isDemocratic });
        }
    });

    document.getElementById('join-btn').addEventListener('click', () => {
        const name = document.getElementById('join-name').value;
        const code = document.getElementById('game-code-input-player').value.toUpperCase();
        if (name && code) {
            sessionStorage.setItem('playerName', name);
            sessionStorage.removeItem('hostToken');
            sessionStorage.removeItem('playerToken');
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
    const gameCode = getGameCodeFromURL();

    if (gameCode && qrCodeElement) {
        const joinUrl = `${window.location.origin}/player.html?game=${gameCode}`;
        joinUrlElement.textContent = `Or go to: ${window.location.host}/player.html`;

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
    setTimeout(() => {
        banner.style.opacity = 1;
        banner.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        banner.style.opacity = 0;
        banner.style.transform = 'translateY(-20px)';
        setTimeout(() => { banner.style.display = 'none'; }, 500);
    }, duration);
}

function showVoteModal(initiatorName) {
    const modal = document.getElementById('vote-to-end-modal');
    const modalText = document.getElementById('vote-modal-text');
    const me = gameState.players.find(p => p.id === socket.id);

    if (modal && modalText && me) {
        modalText.textContent = `${initiatorName} has proposed ending the game. A unanimous 'Yes' vote is required.`;
        modal.style.display = 'flex';

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
    document.getElementById('start-game-btn')?.addEventListener('click', () => {
        socket.emit('startGame', getGameCodeFromURL());
    });

    document.getElementById('submit-cards-btn')?.addEventListener('click', () => {
        const me = gameState.players.find(p => p.id === socket.id);
        const cardsToSubmit = selectedCardIndices.map(index => me.hand[index]);
        if (cardsToSubmit.length > 0) {
            socket.emit('submitCard', { code: gameState.code, cards: cardsToSubmit });
            document.getElementById('submit-cards-btn').parentElement.style.display = 'none';
        }
    });

    document.getElementById('czar-confirm-btn')?.addEventListener('click', () => {
        if (czarSelection) {
            socket.emit('czarChoose', { code: gameState.code, winningCards: czarSelection });
            document.getElementById('czar-confirm-btn').parentElement.style.display = 'none';
        }
    });

    document.getElementById('vote-to-end-btn')?.addEventListener('click', () => {
        socket.emit('initiateVoteToEnd', { code: gameState.code });
    });

    document.getElementById('vote-yes-btn')?.addEventListener('click', () => {
        socket.emit('castVote', { code: gameState.code, vote: 'yes' });
        document.getElementById('vote-to-end-modal').style.display = 'none';
    });

    document.getElementById('vote-no-btn')?.addEventListener('click', () => {
        socket.emit('castVote', { code: gameState.code, vote: 'no' });
        document.getElementById('vote-to-end-modal').style.display = 'none';
    });

    // --- Event Delegation for Dynamic Elements ---
    document.body.addEventListener('click', (e) => {
        if (e.target.matches('.kick-btn')) {
            const playerIdToKick = e.target.dataset.playerId;
            socket.emit('kickPlayer', { code: gameState.code, playerIdToKick });
        }

        const cardButton = e.target.closest('#my-hand .card.white');
        if (cardButton && !cardButton.disabled && cardButton.dataset.cardIndex) {
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
                handleCardSelect(cardIndex);
            }
        }

        // CHANGE: Consolidated click listener for both Czar judging and player voting
        const interactiveCardGroup = e.target.closest('.card-group.interactive');
        if (interactiveCardGroup && !interactiveCardGroup.hasAttribute('aria-disabled')) {
            const selectedPlayerId = interactiveCardGroup.dataset.playerId;
            const submission = gameState.submissions[selectedPlayerId];

            if (submission) {
                if (gameState.isDemocratic) {
                    // Democratic mode: emit a vote
                    socket.emit('playerVote', { code: gameState.code, submissionOwnerId: selectedPlayerId });
                } else {
                    // Czar mode: handle local selection
                    handleCzarSelect(submission);
                }
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
            textarea.value = '';
        });
        blankCardSubmitBtn.addEventListener('click', () => {
            const cardText = textarea.value.trim();
            if (cardText.length > 0 && cardText.length <= 150) {
                socket.emit('submitBlankCard', { code: gameState.code, cardText: cardText });
                blankCardModal.style.display = 'none';
                textarea.value = '';
                document.getElementById('submit-cards-btn').parentElement.style.display = 'none';
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
    sessionStorage.setItem('hostToken', data.token);
    sessionStorage.removeItem('playerToken');
    navigateTo('player.html', data.code);
});

socket.on('joinSuccess', (data) => {
    sessionStorage.setItem('playerToken', data.token);
});

socket.on('gameUpdate', (game) => {
    if (game.state === 'playing' && gameState.state !== 'playing') {
        czarSelection = null;
    }

    gameState = game;
    if (gameState.state !== 'judging' && gameState.state !== 'voting') {
        const me = gameState.players.find(p => p.id === socket.id);
        const submitted = me && !!gameState.submissions[me.id];
        if(!submitted) {
            selectedCardIndices = [];
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
    const criticalErrors = ['Game not found.', 'That name is already taken.'];
    if (criticalErrors.includes(msg)) {
        sessionStorage.removeItem('playerName');
        sessionStorage.removeItem('playerToken');
        sessionStorage.removeItem('hostToken');

        alert(msg + "\n\nYou will be redirected to the homepage.");
        window.location.href = '/';
        return;
    }

    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = msg;
    } else {
        showNotification(msg, 5000);
    }
});

socket.on('disconnect', () => {
  showNotification('Connection lost! Attempting to reconnect...', 999999);
});

socket.on('reconnect', () => {
    showNotification('Reconnected successfully!', 4000);
    joinGameFromURL();
});

// --- HTML TEMPLATE FUNCTIONS ---

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

function createPlayerHandHTML(me, isCzar, submitted) {
    return me.hand.map((cardText, index) => {
        const isDisabled = isCzar || submitted || gameState.state !== 'playing';
        const isSelected = selectedCardIndices.includes(index);
        const isBlank = cardText === '___BLANK_CARD___';

        let classes = 'card white';
        if (isBlank) classes += ' blank';
        if (isSelected) classes += ' selected';

        const content = isBlank ? `<p>Write your own card!</p>` : `<p>${cardText}</p>`;

        return `<button class="${classes}" data-card-index="${index}" ${isDisabled ? 'disabled' : ''}>${content}</button>`;
    }).join('');
}

/** CHANGE: Creates the HTML for submissions for a Czar to judge or for players to vote on. */
function createInteractiveSubmissionsHTML(submissions, { myId, isVoting, czarSelection, votes }) {
    let html = '';
    const submissionEntries = Object.entries(submissions);
    
    // Shuffle for voting to anonymize order
    if (isVoting) {
        for (let i = submissionEntries.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [submissionEntries[i], submissionEntries[j]] = [submissionEntries[j], submissionEntries[i]];
        }
    }

    const myVote = isVoting ? votes[myId] : null;
    const hasVoted = !!myVote;

    for (const [playerId, submission] of submissionEntries) {
        const isMySubmission = isVoting && playerId === myId;
        const isDisabled = isVoting && (isMySubmission || hasVoted);
        
        let isSelected = false;
        if (isVoting) {
            isSelected = myVote === playerId;
        } else {
            isSelected = czarSelection && JSON.stringify(czarSelection) === JSON.stringify(submission);
        }
        
        const voteCount = isVoting ? Object.values(votes).filter(vote => vote === playerId).length : 0;
        
        let classes = 'card-group';
        if (!isDisabled) classes += ' interactive';
        if (isSelected) classes += ' czar-selected';
        
        const voteDisplay = isVoting ? `<div class="vote-count">${voteCount} vote(s)</div>` : '';

        html += `<div class="${classes}" data-player-id="${playerId}" ${isDisabled ? 'aria-disabled="true"' : ''}>
            ${voteDisplay}
            ${submission.map(cardText => `<div class="card white"><p>${cardText}</p></div>`).join('')}
        </div>`;
    }
    return html;
}

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

function createBoardSubmissionsHTML(state, submissions) {
    if (state === 'judging' || state === 'voting') {
        const submissionArray = Object.values(submissions);

        for (let i = submissionArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [submissionArray[i], submissionArray[j]] = [submissionArray[j], submissionArray[i]];
        }

        return submissionArray.map(submission =>
            `<div class="card-group">${submission.map(cardText => `<div class="card white"><p>${cardText}</p></div>`).join('')}</div>`
        ).join('');
    } else {
        const submissionCount = Object.keys(submissions).length;
        return '<div class="card white back"></div>'.repeat(submissionCount);
    }
}


// --- RENDER LOGIC ---
function renderBoard() {
    if (gameState.state === 'finished') return;

    document.getElementById('game-over-area').style.display = 'none';
    document.getElementById('game-code-display').textContent = gameState.code;
    document.getElementById('scoreboard').innerHTML = createBoardScoreboardHTML(gameState.players, gameState.currentCzar);
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
        renderWinnerBanner('winner-announcement');
    }

    renderVoteDisplay();
}

function renderPlayer() {
    if (gameState.state === 'finished') return;
    
    const me = gameState.players.find(p => p.id === socket.id);
    if (!me) return;

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
                if (isCzar && !gameState.isDemocratic) classes += ' czar'; // Only show Czar in standard mode
                const czarIndicator = isCzar && !gameState.isDemocratic ? ' (Czar)' : '';
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

    const endlessActions = document.getElementById('endless-game-actions');
    if (gameState.isEndless && gameState.state !== 'waiting' && gameState.state !== 'finished') {
        endlessActions.style.display = 'block';
        const voteToEndBtn = document.getElementById('vote-to-end-btn');
        voteToEndBtn.disabled = gameState.voteToEndState.inProgress;
        voteToEndBtn.textContent = gameState.voteToEndState.inProgress ? 'Vote in Progress...' : 'Vote to End Game';
    } else {
        endlessActions.style.display = 'none';
    }

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
        startGameContainer.style.display = (isHost && activePlayers.length >= 2) ? 'block' : 'none';
    } else {
        document.getElementById('lobby-view').style.display = 'none';
        document.getElementById('game-view').style.display = 'block';

        const blackCardTextPlayer = document.getElementById('black-card-text-player');
        if (gameState.currentBlackCard) {
            blackCardTextPlayer.innerHTML = gameState.currentBlackCard.text.replace(/_/g, '______');
        }
        
        renderWinnerBanner('winner-announcement-player');

        const isCzar = gameState.currentCzar === socket.id;
        const submitted = !!gameState.submissions[socket.id];
        const isDemocratic = gameState.isDemocratic;

        // Hide all views by default
        const views = ['my-hand', 'player-submission-view', 'czar-judging-area', 'player-voting-area'];
        views.forEach(id => document.getElementById(id).style.display = 'none');

        if (isDemocratic && gameState.state === 'voting') {
            // DEMOCRATIC MODE - VOTING
            const votingArea = document.getElementById('player-voting-area');
            votingArea.style.display = 'block';
            const myVote = gameState.votes ? gameState.votes[socket.id] : null;
            document.getElementById('player-status').textContent = myVote ? 'Vote cast. Waiting for others.' : 'Vote for your favorite submission!';
            document.getElementById('cards-to-vote-on').innerHTML = createInteractiveSubmissionsHTML(gameState.submissions, { myId: socket.id, isVoting: true, czarSelection: null, votes: gameState.votes || {} });
        } else if (isCzar && !isDemocratic) {
            // CZAR MODE
            const czarJudgingArea = document.getElementById('czar-judging-area');
            if (gameState.state === 'judging') {
                document.getElementById('player-status').textContent = 'You are the Card Czar. Choose your favorite!';
                czarJudgingArea.style.display = 'block';
                document.getElementById('cards-to-judge').innerHTML = createInteractiveSubmissionsHTML(gameState.submissions, { myId: socket.id, isVoting: false, czarSelection: czarSelection, votes: {} });
            } else {
                document.getElementById('player-status').textContent = "You are the Card Czar. Sit back and wait.";
            }
        } else {
            // REGULAR PLAYER VIEW (INCLUDES DEMOCRATIC SUBMISSION PHASE)
            if (submitted) {
                // CHANGE: Player has submitted, show their card and wait for others
                const submissionView = document.getElementById('player-submission-view');
                submissionView.style.display = 'block';
                document.getElementById('player-status').textContent = 'Your submission is in. Waiting for others.';
                
                const mySubmissionHTML = gameState.submissions[socket.id].map(cardText => `<div class="card white"><p>${cardText}</p></div>`).join('');
                document.getElementById('my-submission-area').innerHTML = mySubmissionHTML;

                const activePlayers = gameState.players.filter(p => p.name !== 'TV_BOARD' && !p.disconnected);
                const requiredSubmissions = gameState.isDemocratic ? activePlayers.length : activePlayers.length - 1;
                const waitingForCount = Math.max(0, requiredSubmissions - Object.keys(gameState.submissions).length);
                
                document.getElementById('waiting-for-players-text').textContent = `Waiting for ${waitingForCount} more player(s)...`;
                document.getElementById('other-submissions-area').innerHTML = '<div class="card white back"></div>'.repeat(waitingForCount);
            } else {
                // Player needs to pick a card
                const myHandDiv = document.getElementById('my-hand');
                myHandDiv.style.display = 'flex';
                myHandDiv.innerHTML = createPlayerHandHTML(me, isCzar, submitted);
                
                const pickCount = gameState.currentBlackCard ? gameState.currentBlackCard.pick : 1;
                document.getElementById('player-status').textContent = `Pick ${pickCount} card${pickCount > 1 ? 's' : ''}.`;
                myHandDiv.classList.toggle('selection-complete', selectedCardIndices.length === pickCount);
            }
        }
    }
}

function handleCzarSelect(submission) {
    czarSelection = submission;
    document.getElementById('czar-confirm-container').style.display = 'block';
    document.getElementById('cards-to-judge').innerHTML = createInteractiveSubmissionsHTML(gameState.submissions, { myId: socket.id, isVoting: false, czarSelection: czarSelection, votes: {} });
}

function handleCardSelect(cardIndex) {
    const pickCount = gameState.currentBlackCard.pick;
    const indexInSelected = selectedCardIndices.indexOf(cardIndex);

    if (indexInSelected > -1) {
        selectedCardIndices.splice(indexInSelected, 1);
    } else {
        if (selectedCardIndices.length < pickCount) {
            selectedCardIndices.push(cardIndex);
        }
    }
    
    const submitContainer = document.getElementById('submit-button-container');
    submitContainer.style.display = (selectedCardIndices.length === pickCount) ? 'block' : 'none';
    
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

function renderWinnerBanner(elementId) {
    const winnerAnnouncement = document.getElementById(elementId);
    if (!winnerAnnouncement) return;

    if (gameState.roundWinnerInfo) {
        winnerAnnouncement.innerHTML = `<p><strong>${gameState.roundWinnerInfo.name}</strong> won the round!</p>
        <div class="card black">
            <p>${gameState.roundWinnerInfo.sentence}</p>
        </div>`;
        winnerAnnouncement.classList.add('visible');
    } else {
        winnerAnnouncement.classList.remove('visible');
    }
}