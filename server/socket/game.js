const { games, generateGameCode, firstRound, startNewRound, endGame, allWhiteCards, allBlackCards, handleRoundWinner } = require('../gameManager');
const { getSerializableGameState, getActivePlayers, shuffle, escapeHtml, broadcastGameUpdate } = require('../utils');
const crypto = require('crypto');
const { addToQueue } = require('../GameQueue');

module.exports = (io, socket) => {
    socket.on('createGame', (data) => {
        const { name, winTarget, isEndless, isDemocratic } = data;
        const hostToken = crypto.randomBytes(16).toString('hex');

        const existingGame = Object.values(games).find(game => game.hostToken === hostToken);
        if (existingGame) {
            return socket.emit('errorMsg', 'You have already created a game.');
        }
        if (typeof name !== 'string' || name.length < 2 || name.length > 20) {
            return socket.emit('errorMsg', 'Invalid name.');
        }
        if (!isEndless && (typeof winTarget !== 'number' || winTarget < 1 || winTarget > 100)) {
            return socket.emit('errorMsg', 'Invalid win target.');
        }

        const gameCode = generateGameCode();
        
        addToQueue(gameCode, () => {
            games[gameCode] = {
                code: gameCode,
                hostId: null,
                hostToken: hostToken,
                players: [],
                state: 'waiting',
                round: 0,
                winTarget: isEndless ? null : parseInt(winTarget, 10) || 7,
                isEndless: isEndless,
                isDemocratic: isDemocratic || false,
                votes: {},
                voteCounts: {},
                shuffledSubmissions: [],
                voteToEndState: {
                    inProgress: false,
                    initiatorName: null,
                    votes: {}
                },
                czarIndex: -1,
                currentCzar: null,
                currentBlackCard: null,
                submissions: {},
                whiteDeck: [],
                blackDeck: shuffle([...allBlackCards]),
            };

            const game = games[gameCode];

            const gameWhiteDeck = [...allWhiteCards];
            const blankCardCount = Math.floor(gameWhiteDeck.length * 0.02);
            for (let i = 0; i < blankCardCount; i++) {
                gameWhiteDeck.push('___BLANK_CARD___');
            }
            games[gameCode].whiteDeck = shuffle(gameWhiteDeck);

            // Add host to players list
            const hostPlayer = {
                id: socket.id,
                name: name,
                score: 0,
                hand: [],
                token: hostToken,
                disconnected: false,
                disconnectTimeout: null
            };
            game.players.push(hostPlayer);
            game.hostId = socket.id;
            game.hostName = name;
            socket.join(gameCode);

            socket.emit('gameCreated', { code: gameCode, token: hostToken, name: name });
            socket.emit('gameUpdate', getSerializableGameState(game, socket.id));
        });
    });

    socket.on('startGame', (gameCode) => {
        addToQueue(gameCode, () => {
            const game = games[gameCode];
            if (game && socket.id === game.hostId) {
                const activePlayers = getActivePlayers(game);
                if (activePlayers.length < 2) {
                    return socket.emit('errorMsg', 'Cannot start game. At least 2 active players are required.');
                }
                firstRound(gameCode);
            }
        });
    });

    socket.on('czarChoose', (data) => {
        addToQueue(data.code, () => {
            const game = games[data.code];
            if (!game || socket.id !== game.currentCzar || game.state !== 'judging' || game.isDemocratic) {
                return;
            }
            
            const winningPlayerId = Object.keys(game.submissions).find(
                id => JSON.stringify(game.submissions[id]) === JSON.stringify(data.winningCards)
            );
            
            if (winningPlayerId) {
                handleRoundWinner(data.code, winningPlayerId, data.winningCards);
            }
        });
    });

    socket.on('playerVote', (data) => {
        addToQueue(data.code, () => {
            const game = games[data.code];
            const player = game ? game.players.find(p => p.id === socket.id) : null;
            const { submissionOwnerId } = data;

            if (!game || !player || !game.isDemocratic || game.state !== 'voting' || game.votes[socket.id] || socket.id === submissionOwnerId || player.isBoard) {
                return;
            }

            game.votes[socket.id] = submissionOwnerId;
            game.voteCounts = Object.values(game.votes).reduce((acc, id) => {
                acc[id] = (acc[id] || 0) + 1;
                return acc;
            }, {});

            broadcastGameUpdate(io, game);

            const activePlayers = getActivePlayers(game);

            if (Object.keys(game.votes).length >= activePlayers.length) {
                const voteCounts = Object.values(game.votes).reduce((acc, id) => {
                    acc[id] = (acc[id] || 0) + 1;
                    return acc;
                }, {});

                let winningPlayerId = null;
                let maxVotes = 0;
                let isTie = false;

                for (const playerId in voteCounts) {
                    if (voteCounts[playerId] > maxVotes) {
                        maxVotes = voteCounts[playerId];
                        winningPlayerId = playerId;
                        isTie = false;
                    } else if (voteCounts[playerId] === maxVotes) {
                        isTie = true;
                    }
                }

                if (isTie || !winningPlayerId) {
                    const tieBreakerVote = game.votes[game.tieBreakerId];
                    if (tieBreakerVote && voteCounts[tieBreakerVote] === maxVotes) {
                        winningPlayerId = tieBreakerVote;
                        const winningCards = game.submissions[winningPlayerId];
                        if (!winningCards) {
                            return;
                        }
                        handleRoundWinner(data.code, winningPlayerId, winningCards);
                    } else {
                        game.roundWinnerInfo = { name: "It's a tie!", sentence: "No points awarded." };
                        broadcastGameUpdate(io, game);
                        setTimeout(() => startNewRound(data.code), 5000);
                    }
                } else {
                    const winningCards = game.submissions[winningPlayerId];
                    if (!winningCards) {
                        return;
                    }
                    handleRoundWinner(data.code, winningPlayerId, winningCards);
                }
            }
        });
    });
};