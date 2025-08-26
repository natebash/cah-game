const { games, checkSubmissionsAndAdvance, allWhiteCards } = require('../gameManager');
const { getSerializableGameState, getActivePlayers, shuffle, escapeHtml, broadcastGameUpdate } = require('../utils');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { addToQueue } = require('../GameQueue');

module.exports = (io, socket) => {
    socket.on('joinGame', (data) => {
        addToQueue(data.code, () => {
            const game = games[data.code];
            if (!game) {
                return socket.emit('errorMsg', 'Game not found.');
            }
            socket.gameCode = data.code;

            const existingPlayer = game.players.find(p => p.name.toLowerCase() === data.name.toLowerCase());
            if (existingPlayer && existingPlayer.id !== socket.id) {
                if (existingPlayer.disconnected) {
                    // Reconnecting player
                    existingPlayer.id = socket.id;
                    existingPlayer.disconnected = false;
                    if (existingPlayer.disconnectTimeout) {
                        clearTimeout(existingPlayer.disconnectTimeout);
                        existingPlayer.disconnectTimeout = null;
                    }
                    socket.emit('joinSuccess', { name: existingPlayer.name, token: existingPlayer.token, code: data.code });
                    broadcastGameUpdate(io, game);
                    return;
                } else if (data.token === game.hostToken) {
                    socket.emit('joinSuccess', { name: existingPlayer.name, token: existingPlayer.token, code: data.code });
                    socket.emit('gameUpdate', getSerializableGameState(game, socket.id));
                    return;
                }
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

            if (data.token && data.token === game.hostToken && !game.hostId) {
                game.hostId = socket.id;
                player.token = game.hostToken;
            }
            
            game.players.push(player);
            socket.join(data.code);

            socket.emit('joinSuccess', { name: player.name, token: player.token, code: data.code });
            broadcastGameUpdate(io, game);
        });
    });

    socket.on('kickPlayer', (data) => {
        addToQueue(data.code, () => {
            const game = games[data.code];
            if (game && game.hostId === socket.id && game.state === 'waiting') {
                const playerIndex = game.players.findIndex(p => p.id === data.playerIdToKick);
                if (playerIndex > -1) {
                    const kickedPlayer = game.players.splice(playerIndex, 1)[0];
                    const kickedSocket = io.sockets.sockets.get(kickedPlayer.id);
                    if (kickedSocket) {
                        kickedSocket.leave(data.code);
                        kickedSocket.disconnect(true);
                    }
                    io.to(kickedPlayer.id).emit('youWereKicked');
                    broadcastGameUpdate(io, game);
                }
            }
        });
    });

    socket.on('submitBlankCard', ({ code, cardText }) => {
        addToQueue(code, () => {
            const game = games[code];
            const player = game ? game.players.find(p => p.id === socket.id) : null;
            if (!game || !player || game.submissions[socket.id] || socket.id === game.currentCzar) {
                return;
            }

            if (typeof cardText !== 'string' || cardText.length === 0 || cardText.length > 150) {
                return;
            }
            const sanitizedText = escapeHtml(cardText.trim());

            const cardsPath = path.join(__dirname, '..', 'server', 'data', 'cards.json');
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
                    
                    allWhiteCards.push(sanitizedText);
                    game.whiteDeck.push(sanitizedText);
                    shuffle(game.whiteDeck);
                }
            } catch (err) {
                if (err) {
                    console.error("Error reading cards.json:", err);
                    return;
                }
            }

            game.submissions[socket.id] = [sanitizedText];
            const blankCardIndex = player.hand.indexOf('___BLANK_CARD___');
            if (blankCardIndex > -1) player.hand.splice(blankCardIndex, 1);
            checkSubmissionsAndAdvance(code);
        });
    });

    socket.on('submitCard', (data) => {
        addToQueue(data.code, () => {
            const game = games[data.code];
            if (!game || game.submissions[socket.id] || socket.id === game.currentCzar) {
                return;
            }
            const player = game.players.find(p => p.id === socket.id);
            player.hand = player.hand.filter(card => !data.cards.includes(card));
            game.submissions[socket.id] = data.cards;
            
            // Immediately notify everyone about the new submission
            broadcastGameUpdate(io, game);

            checkSubmissionsAndAdvance(data.code);
        });
    });
};