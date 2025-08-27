import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useSocket from './hooks/useSocket'; // Import the new hook

const GameContext = createContext();

export function useGame() {
  return useContext(GameContext);
}

export function GameProvider({ children }) {
  console.log('[GameProvider] Component rendered.');
  const [notification, setNotification] = useState({ message: null, type: null, duration: null });
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const gameCode = searchParams.get('game');

  // Use the new useSocket hook
  const { socket, isConnected, gameState, notification: socketNotification, redirect } = useSocket();
  console.log('[GameProvider] From useSocket: Socket:', socket, 'IsConnected:', isConnected, 'GameState:', gameState, 'SocketNotification:', socketNotification, 'Redirect:', redirect);

  const [modal, setModal] = useState({ show: false, title: '', content: null });
  console.log('[GameProvider] Modal state:', modal);

  const prevIsConnectedRef = useRef(isConnected);

  const showModal = useCallback((title, content) => {
    console.log('[GameProvider] showModal called. Title:', title, 'Content:', content);
    setModal({ show: true, title, content });
  }, []);

  const closeModal = useCallback(() => {
    console.log('[GameProvider] closeModal called.');
    setModal({ show: false, title: '', content: null });
  }, []);

  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    console.log('[GameProvider] showNotification called. Message:', message, 'Type:', type, 'Duration:', duration);
    setNotification({ message, type, duration });
  }, []);

  

  // Handle notifications from useSocket
  useEffect(() => {
    console.log('[GameProvider] useEffect for socketNotification triggered. SocketNotification:', socketNotification);
    if (socketNotification && socketNotification.message) {
      showNotification(socketNotification.message, socketNotification.type, socketNotification.duration);
    }
  }, [socketNotification, showNotification]);

  // Handle redirects from useSocket
  useEffect(() => {
    console.log('[GameProvider] useEffect for redirect triggered. Redirect:', redirect);
    if (redirect) {
      navigate(redirect);
    }
  }, [redirect, navigate]);

  // Handle connection status for notifications
  useEffect(() => {
    console.log('[GameProvider] useEffect for connection status triggered. IsConnected:', isConnected, 'Socket:', socket);
    const prevIsConnected = prevIsConnectedRef.current;
    prevIsConnectedRef.current = isConnected; // Update ref for next render

    if (!isConnected && socket) {
      showNotification('Connection lost! Attempting to reconnect...', 'warning', 0); // Persistent
    } else if (isConnected && socket && !prevIsConnected) { // Only show if it just became connected
      showNotification('Reconnected successfully!', 'success', 4000);
    }
  }, [isConnected, socket, showNotification]);

  // Explicitly join game when socket is available and gameCode exists
  useEffect(() => {
    console.log('[GameProvider] useEffect for joinGame emission triggered. Socket:', socket, 'GameCode:', gameCode, 'GameState:', gameState);
    const playerName = sessionStorage.getItem('playerName');
    const playerToken = sessionStorage.getItem('playerToken');
    const hostTokenFromStorage = sessionStorage.getItem('hostToken');
    const hostTokenFromURL = new URLSearchParams(location.search).get('hostToken');
    const hasJoined = sessionStorage.getItem('hasJoined');

    if (socket && gameCode && playerName) { // Only proceed if we have basic info
      if (hasJoined) {
        sessionStorage.removeItem('hasJoined');
        return;
      }

      // If the host token is in the URL, this client is the host.
      // We can skip the joinGame emission because the server already added the host.
      if (hostTokenFromURL && hostTokenFromStorage === hostTokenFromURL) {
        console.log("Host detected, skipping redundant joinGame emission.");
        return;
      }

      // If the player is already in the game, don't emit joinGame again.
      if (gameState.players && gameState.players.find(p => p.name === playerName)) {
        console.log("Player already in game, skipping redundant joinGame emission.");
        return;
      }

      let nameToJoin = playerName;
      let isBoard = false;

      if (location.pathname.includes('/board')) {
        isBoard = true;
      }

      console.log('[GameProvider] Emitting joinGame. Name:', nameToJoin, 'Token:', playerToken, 'IsBoard:', isBoard);
      socket.emit('joinGame', {
        code: gameCode,
        name: nameToJoin,
        token: playerToken, // Always send playerToken for non-hosts
        isBoard
      });
    }
  }, [socket, gameCode, gameState]);

  // Expose socket.emit for direct use in components for specific actions
  const emit = useCallback((event, data) => {
    console.log('[GameProvider] emit called. Event:', event, 'Data:', data);
    if (socket) {
      socket.emit(event, data);
    }
  }, [socket]);

  const value = {
    socket,
    isConnected, // Add isConnected to the context value
    gameState,
    notification,
    showNotification,
    emit, // Expose emit for sending messages
    clearNotification: () => setNotification({ message: null, type: null, duration: null }),
    modal,
    closeModal,
  };

  console.log('[GameProvider] Component exit. Context value:', value);
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}
