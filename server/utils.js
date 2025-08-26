function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

function getActivePlayers(game) {
    return game.players.filter(p => !p.disconnected && p.name !== 'TV_BOARD');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function shuffle(array) {
    console.log('[shuffle] Entry. Array length:', array.length);
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    console.log('[shuffle] Exit.');
    return array;
}

function getActivePlayers(game) {
    console.log('[getActivePlayers] Entry. Game object:', game);
    const activePlayers = game.players.filter(p => !p.disconnected && p.name !== 'TV_BOARD');
    console.log('[getActivePlayers] Active players count:', activePlayers.length);
    console.log('[getActivePlayers] Exit.');
    return activePlayers;
}

function escapeHtml(text) {
    console.log('[escapeHtml] Entry. Text:', text);
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    const escapedText = text.replace(/[&<>"']/g, function(m) { return map[m]; });
    console.log('[escapeHtml] Exit. Escaped text:', escapedText);
    return escapedText;
}

function getSerializableGameState(game, playerId = null) {
    console.log('[getSerializableGameState] Entry. Game object:', game, 'Player ID:', playerId);
    const player = game.players.find(p => p.id === playerId);
    const isBoard = player && player.name === 'TV_BOARD';

    const serializablePlayers = game.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        disconnected: p.disconnected,
        // Only send hand to the specific player
        hand: (playerId && p.id === playerId) ? p.hand : undefined,
    }));

    const serializableSubmissions = {};
    for (const submitterId in game.submissions) {
        // Only send the actual cards if the game state is judging/voting or if it's the czar/democratic mode
        // Otherwise, just send a placeholder to indicate a submission has been made
        if (game.state === 'judging' || game.state === 'voting' || game.currentCzar === playerId || game.isDemocratic || isBoard) {
            serializableSubmissions[submitterId] = game.submissions[submitterId];
        } else {
            serializableSubmissions[submitterId] = ['SUBMITTED']; // Placeholder
        }
    }

    const serializableGameState = {
        code: game.code,
        hostId: game.hostId,
        state: game.state,
        round: game.round,
        winTarget: game.winTarget,
        isEndless: game.isEndless,
        isDemocratic: game.isDemocratic,
        currentCzar: game.currentCzar,
        currentBlackCard: game.currentBlackCard || null, // Ensure currentBlackCard is always set
        submissions: serializableSubmissions,
        roundWinnerInfo: game.roundWinnerInfo,
        voteToEndState: game.voteToEndState,
        players: serializablePlayers,
        // Only include votes if in democratic mode and voting state
        votes: (game.isDemocratic && game.state === 'voting') ? game.votes : undefined,
        voteCounts: (game.isDemocratic && game.state === 'voting') ? game.voteCounts : undefined,
        shuffledSubmissions: (game.isDemocratic && (game.state === 'voting' || game.state === 'judging')) || (game.currentCzar === playerId && game.state === 'judging') || isBoard ? shuffle(Object.entries(game.submissions)) : undefined,
    };

    console.log('Serializable Game State:', serializableGameState);
    console.log('[getSerializableGameState] Exit.');
    return serializableGameState;
}

function broadcastGameUpdate(io, game) {
    console.log('[broadcastGameUpdate] Entry. Game object:', game);
    if (!game) {
        console.log('[broadcastGameUpdate] Exit. Error: Game is null.');
        return;
    }
    game.players.forEach(p => {
        io.to(p.id).emit('gameUpdate', getSerializableGameState(game, p.id));
    });
    console.log('[broadcastGameUpdate] Exit. Game update broadcasted.');
}

module.exports = {
    shuffle,
    getActivePlayers,
    escapeHtml,
    getSerializableGameState,
    broadcastGameUpdate,
};

function broadcastGameUpdate(io, game) {
    if (!game) return;
    game.players.forEach(p => {
        io.to(p.id).emit('gameUpdate', getSerializableGameState(game, p.id));
    });
}

module.exports = {
    shuffle,
    getActivePlayers,
    escapeHtml,
    getSerializableGameState,
    broadcastGameUpdate,
};