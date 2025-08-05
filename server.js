// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // For generating the token

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  pingInterval: 25000, // How often to send a ping in ms (default: 25000)
  pingTimeout: 20000,  // How long to wait for a pong response in ms (default: 20000)
});
app.use(express.static('public'));

// --- Card Loading Logic ---
function loadCards() {
    const cardsPath = path.join(__dirname, 'public', 'cards.json');
    const fileContent = fs.readFileSync(cardsPath, 'utf8');
    const data = JSON.parse(fileContent);

    let allWhiteCards = [];
    let allBlackCards = [];

    // The JSON is an array of card sets
    data.forEach(set => {
        if (set.white) {
            allWhiteCards = allWhiteCards.concat(set.white.map(card => card.text));
        }
        if (set.black) {
            allBlackCards = allBlackCards.concat(set.black);
        }
    });

    return { allWhiteCards, allBlackCards };
}

let { allWhiteCards, allBlackCards } = loadCards();
let games = {};

// --- Helper Functions ---
function generateGameCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (games[code]);
    return code;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getActivePlayers(game) {
    return game.players.filter(p => p.name !== 'TV_BOARD' && !p.disconnected);
}


function firstRound(gameCode) {
    const game = games[gameCode];
    if (!game) return;
    const activePlayers = getActivePlayers(game);
    if (activePlayers.length < 2) return; // Don't start with less than 2 players

    game.state = 'playing';
    
    startNewRound(gameCode);
}

function startNewRound(gameCode) {
    const game = games[gameCode];
    if (!game || game.blackDeck.length === 0) {
        endGame(gameCode, "Out of black cards!");
        return;
    }

    // Ensure there are enough players to continue
    const activePlayers = getActivePlayers(game);
    if (activePlayers.length < 2) { // Need at least 2 players (1 czar, 1 player) for a round
        game.state = 'waiting';
        game.currentCzar = null; // No czar if we're waiting
        io.to(gameCode).emit('gameUpdate', getSerializableGameState(game));
        return;
    }

    game.round++;
    game.state = 'playing';
    game.submissions = {};
    game.roundWinnerInfo = null;
    // Reset vote state if a new round starts while a vote was in progress
    if (game.voteToEndState.inProgress) {
        game.voteToEndState = { inProgress: false, initiatorName: null, votes: {} };
        io.to(gameCode).emit('voteToEndResult', { passed: false, reason: 'A new round started.' });
    }
    
    // Rotate Card Czar
    game.czarIndex = (game.czarIndex + 1) % activePlayers.length;
    game.currentCzar = activePlayers[game.czarIndex].id;

    // Draw new black card
    game.currentBlackCard = game.blackDeck.pop();
    
    game.players.forEach(player => {
        while(player.hand.length < 10 && game.whiteDeck.length > 0) {
            player.hand.push(game.whiteDeck.pop());
        }
    });

    io.to(gameCode).emit('gameUpdate', getSerializableGameState(game));
}

function getSerializableGameState(game) {
  if (!game) return null;

  // Create a "safe" version of the game state to send to clients,
  // removing sensitive or server-only data.
  const {
    whiteDeck, // Don't send the entire deck to clients.
    blackDeck, // Don't send the entire deck to clients.
    hostToken, // This is a secret token for the host only.
    ...safeGameData // Keep the rest of the game properties.
  } = game;

  // Now, do the same for the players array.
  const serializablePlayers = game.players.map(player => {
    const {
      disconnectTimeout, // This is a server-side object and shouldn't be sent.
      token, // This is a secret token for rejoining.
      ...safePlayerData // Keep the rest of the player properties.
    } = player;
    return safePlayerData;
  });

  // Return a new object with the safe game data and the sanitized players list.
  return {
    ...safeGameData,
    players: serializablePlayers,
  };
}

function endGame(gameCode, reason, winner = null) {
    const game = games[gameCode];
    if (!game) return;
    game.state = 'finished';
    io.to(gameCode).emit('gameOver', { reason, winner });
    // Clean up the game object after a delay to allow clients to see the final state
    setTimeout(() => {
        delete games[gameCode];
    }, 60000); // 60 seconds
}

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
    socket.on('createGame', (data) => {
        const { name, winTarget, isEndless } = data;
        const gameCode = generateGameCode();
        const hostToken = crypto.randomBytes(16).toString('hex');
        
        games[gameCode] = {
            code: gameCode,
            hostId: null, // Will be set when host joins with token
            hostToken: hostToken,
            players: [], // Host will join like a regular player
            state: 'waiting',
            round: 0,
            winTarget: isEndless ? null : parseInt(winTarget, 10) || 7,
            isEndless: isEndless,
            voteToEndState: {
                inProgress: false,
                initiatorName: null,
                votes: {} // { playerId: vote ('yes'/'no') }
            },
            czarIndex: -1,
            currentCzar: null,
            currentBlackCard: null,
            submissions: {},
            whiteDeck: [], // Will be populated below
            blackDeck: shuffle([...allBlackCards]),
        };

        // Create a unique white card deck for this game with blank cards included
        const gameWhiteDeck = [...allWhiteCards];
        const blankCardCount = Math.floor(gameWhiteDeck.length * 0.02); // ~2% blank cards
        for (let i = 0; i < blankCardCount; i++) {
            gameWhiteDeck.push('___BLANK_CARD___');
        }
        games[gameCode].whiteDeck = shuffle(gameWhiteDeck);

        socket.emit('gameCreated', { code: gameCode, token: hostToken, name: name });
    });

    socket.on('joinGame', (data) => {
        const game = games[data.code];
        if (!game) {
            return socket.emit('errorMsg', 'Game not found.');
        }


        // Handle player rejoin
        const rejoiningPlayer = game.players.find(p => p.name === data.name && p.disconnected);
        if (rejoiningPlayer && data.token === rejoiningPlayer.token) {
            if (rejoiningPlayer.disconnectTimeout) {
                clearTimeout(rejoiningPlayer.disconnectTimeout);
                rejoiningPlayer.disconnectTimeout = null;
            }
            rejoiningPlayer.disconnected = false;
            rejoiningPlayer.id = socket.id;
            socket.join(data.code);
            console.log(`Player ${data.name} reconnected to game ${data.code}`);
            io.to(data.code).emit('gameUpdate', getSerializableGameState(game));
            return;
        }

        // Prevent new players from joining with a name that is already in use (active or disconnected).
        if (data.name !== 'TV_BOARD' && game.players.some(p => p.name.toLowerCase() === data.name.toLowerCase())) {
            return socket.emit('errorMsg', 'That name is already taken.');
        }
        
        const playerToken = crypto.randomBytes(16).toString('hex');
        const player = { 
            id: socket.id, 
            name: data.name, 
            score: 0, 
            hand: [], 
            token: playerToken,
            disconnected: false,
            disconnectTimeout: null
        };

        // Correctly assign hostId if the token matches
        if (data.token && data.token === game.hostToken && !game.hostId) {
            game.hostId = socket.id;
            player.token = game.hostToken; // Host uses the game's hostToken
        }
        
        game.players.push(player);
        socket.join(data.code);

        // Send the player their unique token for rejoining purposes
        socket.emit('joinSuccess', { name: player.name, token: player.token });
        io.to(data.code).emit('gameUpdate', getSerializableGameState(game));
    });
    
    socket.on('kickPlayer', (data) => {
        const game = games[data.code];
        // Ensure the request is from the host and the game is in the waiting state
        if (game && game.hostId === socket.id && game.state === 'waiting') {
            const playerIndex = game.players.findIndex(p => p.id === data.playerIdToKick);
            if (playerIndex > -1) {
                const kickedPlayer = game.players.splice(playerIndex, 1)[0];
                const kickedSocket = io.sockets.sockets.get(kickedPlayer.id);
                if (kickedSocket) {
                    // Force the socket to leave the room and disconnect.
                    kickedSocket.leave(data.code);
                    kickedSocket.disconnect(true);
                }
                io.to(kickedPlayer.id).emit('youWereKicked');
                io.to(data.code).emit('gameUpdate', getSerializableGameState(game)); // Update everyone else
            }
        }
    });

    socket.on('submitBlankCard', ({ code, cardText }) => {
        const game = games[code];
        const player = game ? game.players.find(p => p.id === socket.id) : null;
        if (!game || !player || game.submissions[socket.id] || socket.id === game.currentCzar) return;

        // 1. Validate
        if (typeof cardText !== 'string' || cardText.length === 0 || cardText.length > 150) {
            return; // Or send an error back to the user
        }
        const sanitizedText = cardText.trim();

        // 2. Save to cards.json
        // Note: This file-based approach can have race conditions if multiple users submit
        // a blank card simultaneously. For a larger application, a database or a more
        // robust file-locking mechanism would be recommended.
        // FIX: Switched to synchronous file I/O to prevent race conditions.
        const cardsPath = path.join(__dirname, 'public', 'cards.json');
        try {
            const fileContent = fs.readFileSync(cardsPath, 'utf8');
            const data = JSON.parse(fileContent);
            let customPack = data.find(p => p.name === "User-Submitted Pack");

            if (!customPack) {
                customPack = { name: "User-Submitted Pack", white: [], black: [], official: false };
                data.push(customPack);
            }

            if (!customPack.white.some(c => c.text.toLowerCase() === sanitizedText.toLowerCase())) {
                customPack.white.push({ text: sanitizedText, pack: 999 });
                fs.writeFileSync(cardsPath, JSON.stringify(data, null, 4));
                
                // FIX: Add the new card to the in-memory decks for the current session.
                allWhiteCards.push(sanitizedText); // For future games
                game.whiteDeck.push(sanitizedText); // For the current game
                shuffle(game.whiteDeck); // Re-shuffle the deck
            }
        } catch (err) {
            if (err) {
                console.error("Error reading cards.json:", err);
                return;
            }
        }

        // 4. Handle submission (similar to 'submitCard')
        game.submissions[socket.id] = [sanitizedText]; // Treat as a single card submission
        const blankCardIndex = player.hand.indexOf('___BLANK_CARD___');
        if (blankCardIndex > -1) player.hand.splice(blankCardIndex, 1);
        checkSubmissionsAndAdvance(code);
    });

    socket.on('startGame', (gameCode) => {
        const game = games[gameCode];
        if (game && socket.id === game.hostId) {
            firstRound(gameCode);
        }
    });

    socket.on('submitCard', (data) => {
        const game = games[data.code];
        if (!game || game.submissions[socket.id] || socket.id === game.currentCzar) return;

        game.submissions[socket.id] = data.cards;
        const player = game.players.find(p => p.id === socket.id);
        player.hand = player.hand.filter(card => !data.cards.includes(card));
        checkSubmissionsAndAdvance(data.code);
    });

    function checkSubmissionsAndAdvance(gameCode) {
        const game = games[gameCode];
        if (!game) return;
        const requiredSubmissions = getActivePlayers(game).length - 1;
        if (Object.keys(game.submissions).length >= requiredSubmissions) {
            game.state = 'judging';
        }
        io.to(gameCode).emit('gameUpdate', getSerializableGameState(game));
    }

    socket.on('czarChoose', (data) => {
        const game = games[data.code];
        if (!game || socket.id !== game.currentCzar || game.state !== 'judging') return;
        
        const winningPlayerId = Object.keys(game.submissions).find(
            id => JSON.stringify(game.submissions[id]) === JSON.stringify(data.winningCards)
        );
        
        if (winningPlayerId) {
            const winner = game.players.find(p => p.id === winningPlayerId);
            winner.score++;
            game.roundWinnerInfo = { name: winner.name, cards: data.winningCards };
            io.to(data.code).emit('gameUpdate', getSerializableGameState(game));

            if (!game.isEndless && winner.score >= game.winTarget) {
                setTimeout(() => endGame(data.code, `${winner.name} reached the score limit!`, winner), 5000);
            } else {
                setTimeout(() => startNewRound(data.code), 5000);
            }
        }
    });

    socket.on('initiateVoteToEnd', (data) => {
        const game = games[data.code];
        const player = game.players.find(p => p.id === socket.id);
        if (!game || !game.isEndless || game.voteToEndState.inProgress || !player) return;

        game.voteToEndState.inProgress = true;
        game.voteToEndState.initiatorName = player.name;
        game.voteToEndState.votes = { [socket.id]: 'yes' }; // Initiator automatically votes yes

        io.to(data.code).emit('voteToEndStarted', { initiatorName: player.name });
        io.to(data.code).emit('gameUpdate', getSerializableGameState(game));
    });

    socket.on('castVote', (data) => { // data: { code, vote: 'yes'/'no' }
        const game = games[data.code];
        if (!game || !game.voteToEndState.inProgress || game.voteToEndState.votes[socket.id]) return;

        game.voteToEndState.votes[socket.id] = data.vote;

        const activePlayers = getActivePlayers(game);
        const totalVotes = Object.keys(game.voteToEndState.votes).length;

        if (data.vote === 'no') {
            // A single 'no' vote ends the attempt
            io.to(data.code).emit('voteToEndResult', { passed: false, reason: 'The vote was not unanimous.' });
            game.voteToEndState = { inProgress: false, initiatorName: null, votes: {} };
        } else if (totalVotes === activePlayers.length) {
            // All players have voted, and all votes were 'yes'
            const finalWinner = getActivePlayers(game).reduce((prev, current) => (prev.score > current.score) ? prev : current);
            endGame(data.code, `The players have unanimously voted to end the game!`, finalWinner);
            // No need to reset state here, endGame handles it
        }
        // Always update the game state to show vote progress
        io.to(data.code).emit('gameUpdate', getSerializableGameState(game));
    });

    socket.on('disconnect', () => {
        if (socket.gameCode && games[socket.gameCode]) {
            handlePlayerDisconnect(socket.gameCode, socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));