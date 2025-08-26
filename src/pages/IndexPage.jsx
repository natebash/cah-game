import React, { useState, useCallback, useEffect } from 'react';
import { useGame } from '../GameProvider';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import styles from '../styles/components.module.css';
import { filterTvBoardPlayers } from '../utils/clientUtils';

function IndexPage() {
  console.log('[IndexPage] Component rendered.');
  const { socket, isConnected } = useGame(); // Get socket and isConnected from context
  const navigate = useNavigate(); // Initialize navigate hook

  const [view, setView] = useState('main'); // main, create, join, board
  const [name, setName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [winTarget, setWinTarget] = useState(7);
  const [isEndless, setIsEndless] = useState(false);
  const [isDemocratic, setIsDemocratic] = useState(false);
  console.log('[IndexPage] View:', view, 'Name:', name, 'GameCode:', gameCode);

  // Sanitize game code input
  const sanitizeGameCode = useCallback((value) => {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }, []);

  const handleCreateGame = useCallback(() => {
    console.log('[IndexPage] handleCreateGame called. Socket:', socket, 'IsConnected:', isConnected);
    console.log('[IndexPage] handleCreateGame: Emitting createGame with name:', name, 'socket.id:', socket?.id, 'isConnected:', isConnected); // Added log
    console.log('[IndexPage] Create Game Data: Name:', name, 'WinTarget:', winTarget, 'IsEndless:', isEndless, 'IsDemocratic:', isDemocratic);
    if (name && socket && isConnected) {
      sessionStorage.setItem('playerName', name); // Set playerName before emitting
      socket.emit('createGame', { name, winTarget, isEndless, isDemocratic });
      // Navigation to player page is handled by GameProvider's 'gameCreated' listener
      console.log('[IndexPage] handleCreateGame Exit. createGame emitted.');
    } else {
      console.log('[IndexPage] Cannot create game: Name or Socket not available, or not connected.');
      console.log('[IndexPage] handleCreateGame Exit. Error.');
    }
  }, [name, winTarget, isEndless, isDemocratic, socket, isConnected]);

  const handleJoinGame = useCallback(() => {
    console.log('[IndexPage] handleJoinGame called. Socket:', socket, 'IsConnected:', isConnected);
    console.log('[IndexPage] Join Game Data: Name:', name, 'GameCode:', gameCode);
    if (name && gameCode && socket && isConnected) {
      sessionStorage.setItem('playerName', name); // Set playerName before joining
      sessionStorage.setItem('hasJoined', 'true');
      const playerToken = sessionStorage.getItem('playerToken');
      socket.emit('joinGame', { name, code: gameCode, token: playerToken });
      console.log('[IndexPage] handleJoinGame Exit. joinGame emitted.');
    } else {
      console.log('[IndexPage] Cannot join game: Name, Game Code, or Socket not available, or not connected.');
      console.log('[IndexPage] handleJoinGame Exit. Error.');
    }
  }, [name, gameCode, socket, isConnected]);

  const handleJoinBoard = useCallback(() => {
    console.log('[IndexPage] handleJoinBoard called. Socket:', socket, 'IsConnected:', isConnected);
    console.log('[IndexPage] Join Board Data: GameCode:', gameCode);
    if (gameCode && socket && isConnected) {
      sessionStorage.setItem('playerName', 'TV_BOARD'); // Set playerName for board
      sessionStorage.setItem('hasJoined', 'true');
      socket.emit('joinGame', { name: 'TV_BOARD', code: gameCode, isBoard: true });
    }
  }, [gameCode, socket, isConnected]);

  useEffect(() => {
    if (socket) {
      const handleJoinSuccess = (data) => {
        if (data.name === 'TV_BOARD') {
          navigate(`/board?game=${data.code}`);
        }
      };

      socket.on('joinSuccess', handleJoinSuccess);

      return () => {
        socket.off('joinSuccess', handleJoinSuccess);
      };
    }
  }, [socket, navigate]);

  // Event handlers for input changes
  const handleNameChange = useCallback((e) => {
    console.log('[IndexPage] handleNameChange. New value:', e.target.value);
    setName(e.target.value);
  }, []);
  const handleGameCodeChange = useCallback((e) => {
    console.log('[IndexPage] handleGameCodeChange. New value:', e.target.value);
    setGameCode(sanitizeGameCode(e.target.value));
  }, [sanitizeGameCode]);
  const handleWinTargetChange = useCallback((e) => {
    console.log('[IndexPage] handleWinTargetChange. New value:', e.target.value);
    setWinTarget(e.target.value);
  }, []);
  const handleIsEndlessChange = useCallback((e) => {
    console.log('[IndexPage] handleIsEndlessChange. New value:', e.target.checked);
    const checked = e.target.checked;
    setIsEndless(checked);
    if (checked) {
      setWinTarget(''); // Clear win target if endless mode is checked
    } else {
      setWinTarget(7); // Restore default when unchecked
    }
  }, []);
  const handleIsDemocraticChange = useCallback((e) => {
    console.log('[IndexPage] handleIsDemocraticChange. New value:', e.target.checked);
    setIsDemocratic(e.target.checked);
  }, []);

  // Back link handler
  const handleBack = useCallback(() => {
    console.log('[IndexPage] handleBack called.');
    setView('main');
  }, []);

  if (view === 'create') {
    return (
      <div className={styles['menu-view']}>
        <h2>Create Game</h2>
        <input type="text" placeholder="Your Name" value={name} onChange={handleNameChange} />
        <div className={styles['game-options']}>
          <label>
            <input type="checkbox" checked={isEndless} onChange={handleIsEndlessChange} />
            Endless Mode
          </label>
          <label>
            <input type="checkbox" checked={isDemocratic} onChange={handleIsDemocraticChange} />
            Democratic Mode
          </label>
          {!isEndless && (
            <input type="number" placeholder="Winning Score" value={winTarget} onChange={handleWinTargetChange} />
          )}
        </div>
        <button onClick={handleCreateGame} disabled={!name.trim() || (!isEndless && !winTarget)}>Create</button>
        <button className={styles['back-link']} onClick={handleBack}>Back</button>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className={styles['menu-view']}>
        <h2>Join Game</h2>
        <input type="text" placeholder="Your Name" value={name} onChange={handleNameChange} />
        <input type="text" placeholder="Game Code" value={gameCode} onChange={handleGameCodeChange} maxLength="4" />
        <button onClick={handleJoinGame} disabled={!name.trim() || !gameCode.trim()}>Join</button>
        <button className={styles['back-link']} onClick={handleBack}>Back</button>
      </div>
    );
  }

  if (view === 'board') {
    return (
      <div className={styles['menu-view']}>
        <h2>Join as Board</h2>
        <input type="text" placeholder="Game Code" value={gameCode} onChange={handleGameCodeChange} maxLength="4" />
        <button onClick={handleJoinBoard} disabled={!gameCode.trim()}>Join</button>
        <button className={styles['back-link']} onClick={handleBack}>Back</button>
      </div>
    );
  }

  console.log('[IndexPage] Component exit. Main view.');
  return (
    <div id="main-menu" className={styles['main-menu']}>
      <h1>Cards Against All Sanity</h1>
      <button onClick={() => setView('create')}>Create Game</button>
      <button onClick={() => setView('join')}>Join Game</button>
      <button onClick={() => setView('board')}>Create Score Board</button>
    </div>
  );
}

export default IndexPage;