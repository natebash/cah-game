
import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const GameContext = createContext();

export function useGame() {
  return useContext(GameContext);
}

export function GameProvider({ children }) {
  const [gameState, setGameState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [notification, setNotification] = useState({ message: null, type: null, duration: null });

  useEffect(() => {
    const newSocket = io({ transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('gameUpdate', (game) => {
      setGameState(game);
    });

    newSocket.on('errorMsg', (msg) => {
      setNotification(msg, 'error');
    });

    newSocket.on('voteToEndStarted', ({ initiatorName }) => {
      setNotification(`${initiatorName} has proposed ending the game.`, 'info', 5000);
    });

    newSocket.on('voteToEndResult', ({ passed, reason }) => {
      setNotification(reason, passed ? 'success' : 'error', 5000);
    });

    newSocket.on('youWereKicked', () => {
      setNotification("You have been kicked from the game by the host.", 'error');
      setTimeout(() => { window.location.href = '/'; }, 3000);
    });

    newSocket.on('disconnect', () => {
      setNotification('Connection lost! Attempting to reconnect...', 'warning', 0);
    });

    newSocket.on('reconnect', () => {
      setNotification('Reconnected successfully!', 'success');
    });

    return () => newSocket.close();
  }, []);

  const value = {
    socket,
    gameState,
    notification,
    setNotification: (message, type = 'info', duration = 3000) => {
      setNotification({ message, type, duration });
      if (duration) {
        setTimeout(() => setNotification({ message: null, type: null, duration: null }), duration);
      }
    },
    clearNotification: () => setNotification({ message: null, type: null, duration: null }),
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}
