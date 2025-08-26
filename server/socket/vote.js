const { games, endGame } = require('../gameManager');
const { getActivePlayers, getSerializableGameState, broadcastGameUpdate } = require('../utils');
const { addToQueue } = require('../GameQueue');

module.exports = (io, socket) => {
    socket.on('initiateVoteToEnd', (data) => {
        addToQueue(data.code, () => {
            const game = games[data.code];
            const player = game.players.find(p => p.id === socket.id);
            if (!game || !game.isEndless || game.voteToEndState.inProgress || !player) {
                return;
            }

            game.voteToEndState.inProgress = true;
            game.voteToEndState.initiatorName = player.name;
            game.voteToEndState.votes = { [socket.id]: 'yes' };

            io.to(data.code).emit('voteToEndStarted', { initiatorName: player.name });
            broadcastGameUpdate(io, game);
        });
    });

    socket.on('castVote', (data) => {
        addToQueue(data.code, () => {
            const game = games[data.code];
            if (!game || !game.voteToEndState.inProgress || game.voteToEndState.votes[socket.id]) {
                return;
            }

            game.voteToEndState.votes[socket.id] = data.vote;

            const activePlayers = getActivePlayers(game);
            const totalVotes = Object.keys(game.voteToEndState.votes).length;

            if (data.vote === 'no') {
                io.to(data.code).emit('voteToEndResult', { passed: false, reason: 'The vote was not unanimous.' });
                game.voteToEndState = { inProgress: false, initiatorName: null, votes: {} };
            } else if (totalVotes === activePlayers.length) {
                const finalWinner = getActivePlayers(game).reduce((prev, current) => (prev.score > current.score) ? prev : current);
                endGame(game.code, `The players have unanimously voted to end the game!`, finalWinner);
            }
            broadcastGameUpdate(io, game);
        });
    });
};