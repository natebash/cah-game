// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// --- Card Loading Logic ---
function loadCards() {
    const cardsPath = path.join(__dirname, 'public', 'cards.json');
    const fileContent = fs.readFileSync(cardsPath, 'utf8');
    const sets = JSON.parse(fileContent);

    let allWhiteCards = [];
    let allBlackCards = [];

    // The new JSON is an array of card sets
    sets.forEach(set => {
        if (set.white) {
            allWhiteCards = allWhiteCards.concat(set.white.map(card => card.text));
        }
        if (set.black) {
            // Black cards are objects with text and a "pick" count
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

function startNewRound(gameCode) {
    const game = games[gameCode];
    if (!game || game.blackDeck.length === 0) {
        endGame(gameCode, "Out of black cards!");
        return;
    }

    game.round++;
    game.state = 'playing';
    game.submissions = {};
    game.roundWinnerInfo = null;
    game.votesToEnd = []; // Reset votes each round

    // Rotate Card Czar
    game.czarIndex = (game.czarIndex + 1) % game.players.length;
    game.currentCzar = game.players[game.czarIndex].id;

    // Draw new black card
    game.currentBlackCard = game.blackDeck.pop();
    
    // Deal cards to any player below 10 cards
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
    delete games[gameCode]; // Clean up game room
}

// --- Socket.IO Connection Logic ---

io.on('connection', (socket) => {

    socket.on('createGame', (data) => {
        const { name, winTarget, isEndless } = data;
        const gameCode = generateGameCode();
        
        games[gameCode] = {
            code: gameCode,
            players: [{ id: socket.id, name: name, score: 0, hand: [] }],
            hostId: socket.id,
            state: 'waiting',
            round: 0,
            winTarget: isEndless ? null : parseInt(winTarget, 10) || 7,
            isEndless: isEndless,
            votesToEnd: [],
            czarIndex: -1,
            currentCzar: null,
            currentBlackCard: null,
            submissions: {}, // { playerId: ['card text 1', 'card text 2'] }
            whiteDeck: shuffle([...allWhiteCards]),
            blackDeck: shuffle([...allBlackCards])
        };
        socket.join(gameCode);
        socket.emit('gameCreated', games[gameCode]);
    });

    socket.on('joinGame', (data) => {
        const game = games[data.code];
        if (!game) return socket.emit('errorMsg', 'Game not found.');
        if (game.players.some(p => p.id === socket.id)) return; // Already joined
        if (game.players.some(p => p.name.toLowerCase() === data.name.toLowerCase())) {
            return socket.emit('errorMsg', 'That name is already taken.');
        }

        socket.join(data.code);
        const player = { id: socket.id, name: data.name, score: 0, hand: [] };
        // Deal 10 cards to the new player
        for(let i=0; i<10; i++){
            if(game.whiteDeck.length > 0) player.hand.push(game.whiteDeck.pop());
        }
        game.players.push(player);
        
        if (game.state === 'waiting' && game.players.length >= 3) {
             startNewRound(data.code);
        } else {
             io.to(data.code).emit('gameUpdate', game);
        }
    });

    socket.on('submitCard', (data) => {
        const game = games[data.code];
        if (!game || game.submissions[socket.id] || socket.id === game.currentCzar) return;

        // data.cards is now an array of strings
        game.submissions[socket.id] = data.cards;
        const player = game.players.find(p => p.id === socket.id);
        // Remove submitted cards from hand
        player.hand = player.hand.filter(card => !data.cards.includes(card));
        
        const requiredSubmissions = game.players.length - 1;
        if (Object.keys(game.submissions).length === requiredSubmissions) {
            game.state = 'judging';
        }
        
        io.to(data.code).emit('gameUpdate', game);
    });

    socket.on('czarChoose', (data) => {
        const game = games[data.code];
        if (!game || socket.id !== game.currentCzar || game.state !== 'judging') return;
        
        // data.winningCards is an array
        const winningPlayerId = Object.keys(game.submissions).find(
            id => JSON.stringify(game.submissions[id]) === JSON.stringify(data.winningCards)
        );
        
        if (winningPlayerId) {
            const winner = game.players.find(p => p.id === winningPlayerId);
            winner.score++;
            game.roundWinnerInfo = { name: winner.name, cards: data.winningCards };
            io.to(data.code).emit('gameUpdate', game);

            // Check for game win condition
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
        const requiredVotes = Math.ceil(game.players.length / 2);

        if(game.votesToEnd.length >= requiredVotes) {
            // Find player with the highest score to declare winner
            const finalWinner = game.players.reduce((prev, current) => (prev.score > current.score) ? prev : current);
            endGame(data.code, `The players have voted to end the game!`, finalWinner);
        } else {
            // Notify players of the vote
            io.to(data.code).emit('voteUpdate', { voters: game.votesToEnd.length, total: game.players.length });
        }
    });

    // ... (disconnect logic remains similar)
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));