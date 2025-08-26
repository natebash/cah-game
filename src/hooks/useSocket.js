import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { handleCriticalError } from '../utils/clientUtils';

const useSocket = () => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [gameState, setGameState] = useState({});
    const [notification, setNotification] = useState({ message: null, type: null, duration: null });
    const [redirect, setRedirect] = useState(null);
    const isInitialConnect = useRef(true);

    useEffect(() => {
        console.log('[useSocket] useEffect entry.');
        if (!socketRef.current) {
            const newSocket = io({ transports: ['websocket'] });
            console.log('[useSocket] New socket created:', newSocket);

            newSocket.on('connect', () => {
                console.log('[useSocket] Socket connected.');
                setIsConnected(true);
                if (isInitialConnect.current) {
                    setNotification({ message: 'Connected successfully!', type: 'success', duration: 4000 });
                    isInitialConnect.current = false;
                } else {
                    setNotification({ message: 'Reconnected successfully!', type: 'success', duration: 4000 });
                }
            });

            newSocket.on('disconnect', (reason) => {
                console.log('[useSocket] Socket disconnected. Reason:', reason);
                setIsConnected(false);
                setNotification({ message: 'Connection lost! Attempting to reconnect...', type: 'warning', duration: 0 });
            });

            newSocket.on('gameUpdate', (game) => {
                console.log('[useSocket] gameUpdate received:', game);
                setGameState(game);
            });

            newSocket.on('errorMsg', (msg) => {
                console.log('[useSocket] errorMsg received:', msg);
                const errorInfo = handleCriticalError(msg);
                if (errorInfo.isCritical) {
                    setNotification({ message: msg + "\n\nYou will be redirected to the homepage.", type: 'error', duration: 5000 });
                    setRedirect(errorInfo.redirectPath);
                } else {
                    setNotification({ message: msg, type: 'error', duration: 5000 });
                }
            });

            newSocket.on('gameCreated', (data) => {
                console.log('[useSocket] gameCreated received:', data);
                sessionStorage.setItem('playerName', data.name);
                sessionStorage.setItem('hostToken', data.token);
                sessionStorage.removeItem('playerToken');
                setRedirect(`/player?game=${data.code}&hostToken=${data.token}`);
            });

            newSocket.on('joinSuccess', (data) => {
                console.log('[useSocket] joinSuccess received:', data);
                sessionStorage.setItem('playerToken', data.token);
                setRedirect(`/player?game=${data.code}`);
            });

            newSocket.on('voteToEndStarted', ({ initiatorName }) => {
                console.log('[useSocket] voteToEndStarted received. Initiator:', initiatorName);
                setNotification({ message: `${initiatorName} has proposed ending the game.`, type: 'info', duration: 5000 });
            });

            newSocket.on('voteToEndResult', ({ passed, reason }) => {
                console.log('[useSocket] voteToEndResult received. Passed:', passed, 'Reason:', reason);
                setNotification({ message: reason, type: passed ? 'success' : 'error', duration: 5000 });
            });

            newSocket.on('gameOver', ({ reason, winner }) => {
                console.log('[useSocket] gameOver received. Reason:', reason, 'Winner:', winner);
                setNotification({ message: `Game Over! ${reason} Winner: ${winner ? winner.name : 'N/A'}`, type: 'info', duration: 10000 });
                setRedirect('/');
            });

            newSocket.on('youWereKicked', () => {
                console.log('[useSocket] youWereKicked received.');
                setNotification({ message: "You have been kicked from the game by the host.", type: 'error' });
                setRedirect('/');
            });

            socketRef.current = newSocket;
        }

        return () => {
            console.log('[useSocket] useEffect cleanup.');
            if (socketRef.current && socketRef.current.disconnect) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []); // Empty dependency array to run only once

    console.log('[useSocket] Render. IsConnected:', isConnected, 'GameState:', gameState, 'Notification:', notification, 'Redirect:', redirect);
    return { socket: socketRef.current, isConnected, gameState, notification, redirect };
};


export default useSocket;
