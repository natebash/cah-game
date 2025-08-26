const { games, handlePlayerDisconnect } = require('../gameManager');
const { addToQueue } = require('../GameQueue');

module.exports = (io, socket) => {
    socket.on('disconnect', () => {
        if (socket.gameCode && games[socket.gameCode]) {
            addToQueue(socket.gameCode, () => {
                handlePlayerDisconnect(socket.gameCode, socket.id);
            });
        }
    });
};