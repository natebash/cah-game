export const handleCriticalError = (msg) => {
    const criticalErrors = ['Game not found.', 'That name is already taken.'];
    if (criticalErrors.includes(msg)) {
        sessionStorage.removeItem('playerName');
        sessionStorage.removeItem('playerToken');
        sessionStorage.removeItem('hostToken');
        return { isCritical: true, redirectPath: '/' };
    }
    return { isCritical: false, redirectPath: null };
};

export const filterTvBoardPlayers = (players) => {
    return players.filter(p => p.name !== 'TV_BOARD');
};