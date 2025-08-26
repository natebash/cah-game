const gameHandler = require('./socket/game');
const playerHandler = require('./socket/player');
const voteHandler = require('./socket/vote');
const disconnectHandler = require('./socket/disconnect');

module.exports = (io) => {
    io.on('connection', (socket) => {
        gameHandler(io, socket);
        playerHandler(io, socket);
        voteHandler(io, socket);
        disconnectHandler(io, socket);
    });
};