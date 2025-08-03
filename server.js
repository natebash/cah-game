// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // For generating the token

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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

function firstRound(gameCode) {
    const game = games[gameCode];
    if (!game) return;
    const activePlayers = game.players.filter(p => p.name !== 'TV_BOARD');
    if (activePlayers.length < 2) return; // Don't start with less than 2 players

    game.state = 'playing';
    
    // Deal 10 cards to each player
    game.players.forEach(player => {
        if (player.name !== 'TV_BOARD') {
            for(let i=0; i<10; i++){
                if (game.whiteDeck.length > 0) {
                    player.hand.push(game.whiteDeck.pop());
                }
            }
        }
    });

    startNewRound(gameCode);
}

function startNewRound(gameCode) {
    const game = games[gameCode];
    if (!game || game.blackDeck.length === 0) {
        endGame(gameCode, "Out of black cards!");
        return;
    }

    // Ensure there are enough players to continue
    const activePlayers = game.players.filter(p => p.name !== 'TV_BOARD');
    if (activePlayers.length < 2) {
        game.state = 'waiting';
        io.to(gameCode).emit('gameUpdate', game);
        return;
    }

    game.round++;
    game.state = 'playing';
    game.submissions = {};
    game.roundWinnerInfo = null;
    game.votesToEnd = [];

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

    io.to(gameCode).emit('gameUpdate', game);
}

function endGame(gameCode, reason, winner = null) {
    const game = games[gameCode];
    if (!game) return;
    game.state = 'finished';
    io.to(gameCode).emit('gameOver', { reason, winner, finalScores: game.players });
    delete games[gameCode];
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
            votesToEnd: [],
            czarIndex: -1,
            currentCzar: null,
            currentBlackCard: null,
            submissions: {},
            whiteDeck: shuffle([...allWhiteCards]),
            blackDeck: shuffle([...allBlackCards])
        };
        socket.emit('gameCreated', { code: gameCode, token: hostToken, name: name });
    });

    socket.on('joinGame', (data) => {
        const game = games[data.code];
        if (!game) {
            return socket.emit('errorMsg', 'Game not found.');
        }

        if (data.name !== 'TV_BOARD' && game.players.some(p => p.name.toLowerCase() === data.name.toLowerCase())) {
            return socket.emit('errorMsg', 'That name is already taken.');
        }
        
        // Correctly assign hostId if the token matches
        if (data.token && data.token === game.hostToken && !game.hostId) {
            game.hostId = socket.id;
        }
        
        const player = { id: socket.id, name: data.name, score: 0, hand: [] };
        game.players.push(player);
        socket.join(data.code);
        io.to(data.code).emit('gameUpdate', game);
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
        
        const requiredSubmissions = game.players.filter(p => p.name !== 'TV_BOARD').length - 1;
        if (Object.keys(game.submissions).length >= requiredSubmissions) {
            game.state = 'judging';
        }
        
        io.to(data.code).emit('gameUpdate', game);
    });

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
            io.to(data.code).emit('gameUpdate', game);

            if (!game.isEndless && winner.score >= game.winTarget) {
                setTimeout(() => endGame(data.code, `${winner.name} reached the score limit!`, winner), 5000);
            } else {
                setTimeout(() => startNewRound(data.code), 5000);
            }
        }
    });

    socket.on('voteToEnd', (data) => {
        const game = games[data.code];
        if (!game || !game.isEndless || game.votesToEnd.includes(socket.id)) return;
        
        game.votesToEnd.push(socket.id);
        const requiredVotes = Math.ceil(game.players.filter(p=>p.name !== 'TV_BOARD').length / 2);

        if(game.votesToEnd.length >= requiredVotes) {
            const finalWinner = game.players.filter(p=>p.name !== 'TV_BOARD').reduce((prev, current) => (prev.score > current.score) ? prev : current);
            endGame(data.code, `The players have voted to end the game!`, finalWinner);
        } else {
            io.to(data.code).emit('voteUpdate', { voters: game.votesToEnd.length, total: game.players.length });
        }
    });

    socket.on('disconnect', () => {
        for (const code in games) {
            const game = games[code];
            const playerIndex = game.players.findIndex(p => p.id === socket.id);

            if (playerIndex !== -1) {
                const disconnectedPlayer = game.players[playerIndex];
                game.players.splice(playerIndex, 1);

                const remainingPlayers = game.players.filter(p => p.name !== 'TV_BOARD');

                if (remainingPlayers.length < 2 && game.state !== 'waiting') {
                    endGame(code, "Not enough players left to continue.");
                } else {
                    if (disconnectedPlayer.id === game.hostId) {
                        // If host leaves, assign a new host to the first player
                        if (remainingPlayers.length > 0) {
                            game.hostId = remainingPlayers[0].id;
                        }
                    }
                    if (disconnectedPlayer.id === game.currentCzar && game.state !== 'waiting') {
                        startNewRound(code);
                    } else {
                        io.to(code).emit('gameUpdate', game);
                    }
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));