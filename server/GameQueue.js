const gameQueues = {};

function addToQueue(gameCode, operation) {
    if (!gameQueues[gameCode]) {
        gameQueues[gameCode] = {
            queue: [],
            isProcessing: false,
        };
    }
    gameQueues[gameCode].queue.push(operation);
    processQueue(gameCode);
}

async function processQueue(gameCode) {
    const gameQueue = gameQueues[gameCode];
    if (!gameQueue || gameQueue.isProcessing) {
        return;
    }

    if (gameQueue.queue.length === 0) {
        delete gameQueues[gameCode];
        return;
    }

    gameQueue.isProcessing = true;
    const operation = gameQueue.queue.shift();

    try {
        await operation();
    } catch (error) {
        console.error(`Error processing operation for game ${gameCode}:`, error);
    } finally {
        gameQueue.isProcessing = false;
        if (gameQueue.queue.length > 0) {
            processQueue(gameCode);
        } else {
            delete gameQueues[gameCode];
        }
    }
}

module.exports = { addToQueue };
