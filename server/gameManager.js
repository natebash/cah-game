const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { shuffle, getActivePlayers, escapeHtml, getSerializableGameState, broadcastGameUpdate } = require('./utils');
const { addToQueue } = require('./GameQueue');

let allWhiteCards = [];
let allBlackCards = [];
let games = {};
let ioInstance; // To hold the socket.io instance

function setIo(io) {
    ioInstance = io;
}

function generateGameCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 6).toUpperCase();
    } while (games[code]);
    return code;
}

// --- Card Loading Logic ---
function loadCards() {
    const cardsPath = path.join(__dirname, 'data', 'cards.json');
    try {
        const fileContent = fs.readFileSync(cardsPath, 'utf8');
        const data = JSON.parse(fileContent);

        allWhiteCards = [];
        allBlackCards = [];

        // The JSON is an array of card sets
        data.forEach(set => {
            if (set.white) {
                allWhiteCards = allWhiteCards.concat(set.white.map(card => card.text));
            }
            if (set.black) {
                // Ensure the 'pick' value is an integer.
                const blackCards = set.black.map(card => ({
                    ...card,
                    pick: parseInt(card.pick, 10) || 1 // Default to 1 if missing or invalid
                }));
                allBlackCards = allBlackCards.concat(blackCards);
            }
        });
    } catch (error) {
        console.error(`[loadCards] Error loading cards: ${error.message}`);
        allWhiteCards = [];
        allBlackCards = [];
    }

    return { allWhiteCards, allBlackCards };
}

// Initial load
({ allWhiteCards, allBlackCards } = loadCards());

if (allWhiteCards.length === 0 || allBlackCards.length === 0) {
    // This will crash the server on startup if cards don't load, which is better than running in a broken state.
    throw new Error('CRITICAL: Failed to load cards. White or black card deck is empty. Check that aerver/data/cards.json exists, is valid JSON, and contains cards.');
}

function firstRound(gameCode) {
    addToQueue(gameCode, () => {
        const game = games[gameCode];
        if (!game) return;
        const activePlayers = getActivePlayers(game);
        if (activePlayers.length < 2) return; // Don't start with less than 2 players

        console.log(`[firstRound] Game ${gameCode}: Starting first round. isEndless: ${game.isEndless}, isDemocratic: ${game.isDemocratic}`);
        game.state = 'playing';
        
        // Deal cards to players
        activePlayers.forEach(player => {
            while (player.hand.length < 10) {
                if (game.whiteDeck.length === 0) {
                    // Not enough cards to deal, end the game
                    endGame(gameCode, "Not enough white cards to continue.");
                    return;
                }
                player.hand.push(game.whiteDeck.pop());
            }
        });

        // Set the first czar
        if (!game.isDemocratic) {
            game.czarIndex = (game.czarIndex + 1) % activePlayers.length;
            game.currentCzar = activePlayers[game.czarIndex].id;
        } else {
            game.currentCzar = null; // No czar in democratic mode
        }

        // Draw new black card
        game.currentBlackCard = game.blackDeck.pop();
        
        broadcastGameUpdate(ioInstance, game);
    });
}

function startNewRound(gameCode) {
    addToQueue(gameCode, () => {
        const game = games[gameCode];
        if (!game || game.blackDeck.length === 0) {
            endGame(gameCode, "Out of black cards!");
            return;
        }

        // Ensure there are enough players to continue
        const activePlayers = getActivePlayers(game);
        if (activePlayers.length < 2) {
            game.state = 'waiting';
            game.currentCzar = null;
            broadcastGameUpdate(ioInstance, game);
            return;
        }

        game.round++;
        game.state = 'playing';
        game.roundWinnerInfo = null;
        game.votes = {}; // CHANGE: Reset votes for the new round
        game.voteCounts = {};
        game.shuffledSubmissions = [];

        // Collect used white cards from previous round's submissions
        let usedWhiteCards = [];
        for (const playerId in game.submissions) {
            game.submissions[playerId].forEach(card => usedWhiteCards.push(card));
        }
        // Clear submissions for the new round AFTER collecting them
        game.submissions = {}; 

        // Replenish whiteDeck if needed
        if (game.whiteDeck.length < 50 && usedWhiteCards.length > 0) { 
            game.whiteDeck = shuffle(game.whiteDeck.concat(usedWhiteCards));
        }
        
        // Deal cards to players
        activePlayers.forEach(player => {
            while (player.hand.length < 10) {
                if (game.whiteDeck.length === 0) {
                    // Not enough cards to deal, end the game
                    endGame(gameCode, "Not enough white cards to continue.");
                    return;
                }
                player.hand.push(game.whiteDeck.pop());
            }
        });

        // Reset vote state if a new round starts while a vote was in progress
        if (game.voteToEndState.inProgress) {
            game.voteToEndState = { inProgress: false, initiatorName: null, votes: {} };
            ioInstance.to(gameCode).emit('voteToEndResult', { passed: false, reason: 'A new round started.' });
        }
        
        // CHANGE: Rotate Card Czar only if not in democratic mode
        if (!game.isDemocratic) {
            game.czarIndex = (game.czarIndex + 1) % activePlayers.length;
            game.currentCzar = activePlayers[game.czarIndex].id;
        } else {
            game.currentCzar = null; // No czar in democratic mode
        }

        // Draw new black card
        game.currentBlackCard = game.blackDeck.pop();
        
        broadcastGameUpdate(ioInstance, game);
    });
}

function endGame(gameCode, reason, winner = null) {
    addToQueue(gameCode, () => {
        const game = games[gameCode];
        if (!game) return;
        game.state = 'finished';
        ioInstance.to(gameCode).emit('gameOver', { reason, winner });
        setTimeout(() => {
            delete games[gameCode];
        }, 60000);
    });
}

function handlePlayerDisconnect(gameCode, socketId) {
    addToQueue(gameCode, () => {
        const game = games[gameCode];
        if (!game) return;

        const player = game.players.find(p => p.id === socketId);
        if (!player || player.disconnected) return;

        player.disconnected = true;

        if (game.currentCzar === socketId) {
            ioInstance.to(gameCode).emit('errorMsg', `The Card Czar (${player.name}) disconnected. Starting a new round.`);
            setTimeout(() => startNewRound(gameCode), 3000);
        } else {
            player.disconnectTimeout = setTimeout(() => {
                addToQueue(gameCode, () => {
                    if (player.disconnected) {
                        game.players = game.players.filter(p => p.id !== socketId);
                        const currentActivePlayers = getActivePlayers(game);
                        if (game.hostId === socketId) {
                            if (currentActivePlayers.length > 0) {
                                game.hostId = currentActivePlayers[0].id;
                            } else {
                                endGame(gameCode, "The host left and no other players are in the game.");
                                return;
                            }
                        }
                        // Send update to remaining players
                        broadcastGameUpdate(ioInstance, game);
                    }
                });
            }, 60000);
        }

        // Immediately notify everyone that the player has disconnected
        broadcastGameUpdate(ioInstance, game);
    });
}

function checkSubmissionsAndAdvance(gameCode) {
    addToQueue(gameCode, () => {
        const game = games[gameCode];
        if (!game) return;
        // CHANGE: Submission requirement depends on game mode
        const activePlayers = getActivePlayers(game);
        const requiredSubmissions = game.isDemocratic ? activePlayers.length : activePlayers.length - 1;

        if (Object.keys(game.submissions).length >= requiredSubmissions) {
            // CHANGE: Transition to 'voting' state in democratic mode
            game.state = game.isDemocratic ? 'voting' : 'judging';
            game.votes = {}; // Clear previous votes
            if (game.isDemocratic) {
                game.shuffledSubmissions = shuffle(Object.entries(game.submissions));
            }
            // Emit a final update when the state changes to judging/voting
            broadcastGameUpdate(ioInstance, game);
        }
    });
}

function handleRoundWinner(gameCode, winningPlayerId, winningCards) {
    addToQueue(gameCode, () => {
        const game = games[gameCode];
        if (!game) return;

        const winner = game.players.find(p => p.id === winningPlayerId);
        if (!winner) return;

        winner.score++;

        let winningSentence = game.currentBlackCard.text;
        if ((winningSentence.match(/_/g) || []).length === winningCards.length) {
            winningCards.forEach(cardText => {
                winningSentence = winningSentence.replace(/_/, `<strong>${escapeHtml(cardText)}</strong>`);
            });
        } else {
            winningSentence = winningCards.map(c => escapeHtml(c)).join(' / ');
        }

        game.roundWinnerInfo = { name: winner.name, sentence: winningSentence };
        
        broadcastGameUpdate(ioInstance, game);

        if (!game.isEndless && winner.score >= game.winTarget) {
            setTimeout(() => endGame(gameCode, `${winner.name} reached the score limit!`, winner), 5000);
        } else {
            setTimeout(() => startNewRound(gameCode), 5000);
        }
    });
}

module.exports = {
    games,
    allWhiteCards,
    allBlackCards,
    loadCards,
    setIo,
    generateGameCode,
    firstRound,
    startNewRound,
    endGame,
    handlePlayerDisconnect,
    checkSubmissionsAndAdvance,
    handleRoundWinner,
};