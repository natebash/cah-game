import React, { useEffect, useState, useCallback } from 'react';
import { useGame } from '../GameProvider';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import PlayerHand from '../components/player/PlayerHand';
import PlayerSubmissions from '../components/player/PlayerSubmissions';
import CzarView from '../components/player/CzarView';
import VotingView from '../components/player/VotingView';
import styles from '../styles/components.module.css';
import { filterTvBoardPlayers } from '../utils/clientUtils';

function PlayerPage() {
  const { socket, gameState, showNotification } = useGame();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameCode = searchParams.get('game');

  const [selectedCardIndices, setSelectedCardIndices] = useState([]);
  const [czarSelection, setCzarSelection] = useState(null);
  const [blankCardText, setBlankCardText] = useState('');
  const [isBlankCardModalOpen, setIsBlankCardModalOpen] = useState(false);
  const [isVoteToEndModalOpen, setIsVoteToEndModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (gameState.voteToEndState?.inProgress) {
      setIsVoteToEndModalOpen(true);
    } else {
      setIsVoteToEndModalOpen(false);
    }
  }, [gameState.voteToEndState]);

  useEffect(() => {
    if (gameState.state === 'finished') {
      setIsBlankCardModalOpen(false);
      setIsVoteToEndModalOpen(false);
    }
  }, [gameState.state]);

  useEffect(() => {
    if (gameState.state !== 'judging') {
      const me = gameState.players?.find(p => p.id === socket?.id);
      const submitted = me && !!gameState.submissions[me.id];
      if (!submitted && selectedCardIndices.length > 0) {
        setSelectedCardIndices([]);
      }
    }
    if (gameState.state === 'playing' && czarSelection !== null) {
      setCzarSelection(null);
    }
  }, [gameState.state, gameState.players, gameState.submissions, socket?.id, czarSelection, selectedCardIndices]);

  const handleStartGame = useCallback(() => {
    if (socket && gameCode) {
      socket.emit('startGame', gameCode);
    }
  }, [socket, gameCode]);

  const handleCardSelect = useCallback((index) => {
    const pickCount = gameState.currentBlackCard?.pick || 1;
    const indexInSelected = selectedCardIndices.indexOf(index);

    if (indexInSelected > -1) {
      setSelectedCardIndices(prev => prev.filter(i => i !== index));
    } else {
      if (selectedCardIndices.length < pickCount) {
        setSelectedCardIndices(prev => [...prev, index]);
      }
    }
  }, [selectedCardIndices, gameState.currentBlackCard?.pick]);

  const handleSubmitCards = useCallback(() => {
    const me = gameState.players?.find(p => p.id === socket?.id);
    if (me && gameState.code && selectedCardIndices.length > 0) {
      const cardsToSubmit = selectedCardIndices.map(index => me.hand[index]);
      socket.emit('submitCard', { code: gameState.code, cards: cardsToSubmit });
    }
  }, [socket, gameState.players, gameState.code, selectedCardIndices]);

  const handleCzarSelect = useCallback((submission) => {
    setCzarSelection(submission);
  }, []);

  const handleCzarConfirm = useCallback(() => {
    if (socket && gameState.code && czarSelection) {
      socket.emit('czarChoose', { code: gameState.code, winningCards: czarSelection });
      setCzarSelection(null);
    }
  }, [socket, gameState.code, czarSelection]);

  const handlePlayerVote = useCallback((submissionOwnerId) => {
    if (socket && gameState.code) {
      socket.emit('playerVote', { code: gameState.code, submissionOwnerId });
    }
  }, [socket, gameState.code]);

  const handleBlankCardSubmit = useCallback(() => {
    if (blankCardText.length > 0 && blankCardText.length <= 150) {
      if (socket && gameState.code) {
        socket.emit('submitBlankCard', { code: gameState.code, cardText: blankCardText });
        setBlankCardText('');
        setIsBlankCardModalOpen(false);
      }
    } else {
      showNotification('Card text must be between 1 and 150 characters.', 'error');
    }
  }, [blankCardText, socket, gameState.code, showNotification]);

  const handleInitiateVoteToEnd = useCallback(() => {
    if (socket && gameState.code) {
      socket.emit('initiateVoteToEnd', { code: gameState.code });
    }
  }, [socket, gameState.code]);

  const handleCastVote = useCallback((vote) => {
    if (socket && gameState.code) {
      socket.emit('castVote', { code: gameState.code, vote });
      setIsVoteToEndModalOpen(false);
    }
  }, [socket, gameState.code]);

  const handleKickPlayer = useCallback((playerIdToKick) => {
    if (socket && gameState.code) {
      socket.emit('kickPlayer', { code: gameState.code, playerIdToKick });
    }
  }, [socket, gameState.code]);

  const handleBlankCardClick = useCallback(() => {
    setIsBlankCardModalOpen(true);
  }, []);

  const createLobbyPlayerListHTML = (players, isHost, myId) => {
    return filterTvBoardPlayers(players)
      .map(player => {
        const hostIndicator = player.id === gameState.hostId ? ' (Host)' : '';
        const disconnectedIndicator = player.disconnected ? ' (disconnected)' : '';
        const kickButton = (isHost && player.id !== myId)
          ? <button className={styles['kick-btn']} onClick={() => handleKickPlayer(player.id)}>Kick</button>
          : null;
        const disconnectedClass = player.disconnected ? styles.disconnected : '';

        return (
          <li key={player.id} className={disconnectedClass}>
            {player.name}{hostIndicator}{disconnectedIndicator}{kickButton}
          </li>
        );
      });
  };

  useEffect(() => {
    console.log('[PlayerPage] gameState changed:', gameState);
  }, [gameState]);

  const me = gameState.players?.find(p => p.id === socket.id);

  useEffect(() => {
    if (me) {
      setIsLoading(false);
      setIsJoining(false); // Reset joining state if player is now found
    }
  }, [me]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const handleJoinGame = useCallback(() => {
    if (socket && gameCode && playerName.trim() !== '') {
      setIsJoining(true);
      socket.emit('player:joinGame', { gameCode, playerName: playerName.trim() });
    } else {
      showNotification('Please enter a valid name.', 'error');
    }
  }, [socket, gameCode, playerName, showNotification]);

  useEffect(() => {
    if (me) {
      setIsLoading(false);
      setIsJoining(false); // Reset joining state if player is now found
    }
  }, [me]);

  if (!me) {
    if (isJoining) {
      return <div>Joining game...</div>;
    }
    return (
      <div className={`${styles.container} ${styles['player-view']}`}>
        <div id="join-game-area" className={styles['join-game-area']}>
          <h2>Join Game: {gameCode}</h2>
          <input
            type="text"
            id="player-name-input"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength="20"
          />
          <button id="join-game-btn" className={styles.button} onClick={handleJoinGame} disabled={playerName.trim() === ''}>
            Join Game
          </button>
        </div>
      </div>
    );
  }

  const isHost = gameState.hostId === socket.id;
  const isCzar = gameState.currentCzar === socket.id;
  const submitted = !!gameState.submissions?.[socket.id];
  const isDemocratic = gameState.isDemocratic;
  const hasVoted = !!gameState.votes?.[socket.id];
  const pickCount = gameState.currentBlackCard?.pick || 1;

  return (
    <div className={`${styles.container} ${styles['player-view']}`}>
      {gameState.roundWinnerInfo && (
        <div id="winner-announcement-player" className={`${styles['winner-banner']} ${styles.visible}`}>
          <div className={styles['winner-banner-content']}>
            <p>
              <strong>{gameState.roundWinnerInfo.name}</strong> won the round!
            </p>
            <div className={`${styles.card} ${styles.black}`}>
              <p dangerouslySetInnerHTML={{ __html: gameState.roundWinnerInfo.sentence }}></p>
            </div>
          </div>
        </div>
      )}

      <header>
        <div id="player-info">
          <h2 id="player-name">{me.name}</h2>
          <p>Score: <span id="player-score">{me.score}</span></p>
        </div>
        {isHost && (
          <div id="game-code-box" className={styles['game-code-box']}>
            Game Code: <strong id="game-code-display">{gameState.code}</strong>
          </div>
        )}
        <div id="player-status" className={styles['status-banner']}>
          {gameState.state === 'waiting' && 'Waiting for players to join...'}
          {gameState.state === 'playing' && isCzar && 'You are the Card Czar. Sit back and wait.'}
          {gameState.state === 'playing' && !isCzar && !submitted && `Pick ${pickCount} card${pickCount > 1 ? 's' : ''}.`}
          {gameState.state === 'playing' && !isCzar && submitted && 'Your submission is in. Waiting for others.'}
          {gameState.state === 'judging' && isCzar && 'You are the Card Czar. Choose your favorite!'}
          {gameState.state === 'judging' && !isCzar && 'Waiting for the Card Czar to choose.'}
          {gameState.state === 'voting' && !isCzar && !gameState.voteToEndState.inProgress && !hasVoted && 'Vote for the best submission!'}
          {gameState.state === 'voting' && !isCzar && !gameState.voteToEndState.inProgress && hasVoted && 'Vote cast. Waiting for others.'}
        </div>
      </header>

      <main>
        <details id="player-scoreboard" className={styles['scoreboard-details']}>
          <summary>Scores</summary>
          <div className={styles['scoreboard-content']}>
            {filterTvBoardPlayers(gameState.players)
              .sort((a, b) => b.score - a.score)
              .map(player => (
                <div
                  key={player.id}
                  className={`${styles['score-item']} ${player.disconnected ? styles.disconnected : ''} ${player.id === socket.id ? styles.me : ''} ${player.id === gameState.currentCzar ? styles.czar : ''}`}
                >
                  <span className={styles.name}>
                    {player.name} {player.id === gameState.currentCzar && '(Czar)'} {player.disconnected && '(disconnected)'}
                  </span>
                  <span className={styles.score}>{player.score}</span>
                </div>
              ))}
          </div>
        </details>

        {gameState.isEndless && gameState.state !== 'waiting' && gameState.state !== 'finished' && (
          <div id="endless-game-actions">
            <button id="vote-to-end-btn" className={styles.button} onClick={handleInitiateVoteToEnd} disabled={gameState.voteToEndState?.inProgress}>
              {gameState.voteToEndState?.inProgress ? 'Vote in Progress...' : 'Vote to End Game'}
            </button>
            <span id="vote-status"></span>
          </div>
        )}

        {gameState.state === 'waiting' && (
          <div id="lobby-view">
            <h2>Players in Lobby:</h2>
            <ul id="player-list">{createLobbyPlayerListHTML(gameState.players, isHost, socket.id)}</ul>
            <div id="start-game-container">
              {isHost && filterTvBoardPlayers(gameState.players).filter(p => !p.disconnected).length >= 2 && (
                <button id="start-game-btn" className={styles.button} onClick={handleStartGame}>Start Game</button>
              )}
            </div>
          </div>
        )}

        {(gameState.state !== 'waiting' && gameState.state !== 'finished') ? (
          <div id="game-view">
            <div id="current-black-card-player" className={`${styles.card} ${styles.black} ${styles.small}`}>
              <p id="black-card-text-player">
                {gameState.currentBlackCard ? gameState.currentBlackCard.text.replace(/_/g, '______') : 'Waiting for round to start...'}
              </p>
            </div>

            {!isCzar && gameState.state === 'playing' && (
              <>
                <PlayerHand
                  hand={me.hand}
                  selectedCardIndices={selectedCardIndices}
                  handleCardSelect={handleCardSelect}
                  onBlankCardClick={handleBlankCardClick}
                  pickCount={pickCount}
                  submitted={submitted}
                />
                <button
                  id="submit-cards-btn"
                  className={styles.button}
                  onClick={handleSubmitCards}
                  disabled={selectedCardIndices.length !== pickCount || submitted}
                >
                  Submit Cards
                </button>
              </>
            )}

            {submitted && !isCzar && (
              <PlayerSubmissions submissions={gameState.submissions} myId={socket.id} />
            )}

            {isCzar && gameState.state === 'judging' && (
              <CzarView
                submissions={gameState.submissions}
                czarSelection={czarSelection}
                handleCzarSelect={handleCzarSelect}
                handleCzarConfirm={handleCzarConfirm}
              />
            )}

            {!isCzar && gameState.state === 'voting' && (
              <VotingView
                submissions={gameState.submissions}
                handlePlayerVote={handlePlayerVote}
                myId={socket.id}
                votes={gameState.votes}
                hasVoted={hasVoted}
                players={gameState.players}
              />
            )}
          </div>
        ) : null}

        {gameState.state === 'finished' && (
          <div id="game-over-view-player">
            <h2 id="game-over-reason">{gameState.gameOverReason || 'Game Over!'}</h2>
            <p>Winner: <strong id="game-over-winner">{gameState.winner?.name || 'N/A'}</strong></p>
            <p>You will be returned to the main menu shortly.</p>
          </div>
        )}

        <Modal show={isVoteToEndModalOpen} onClose={() => setIsVoteToEndModalOpen(false)}>
          <h2 id="vote-modal-title">Vote to End Game</h2>
          <p id="vote-modal-text">
            {gameState.voteToEndState?.initiatorName} has proposed ending the game. A unanimous 'Yes' vote is required.
          </p>
          <div className={styles['modal-actions']}>
            <button id="vote-yes-btn" className={`${styles['vote-btn']} ${styles.yes}`} onClick={() => handleCastVote('yes')}>Yes</button>
            <button id="vote-no-btn" className={`${styles['vote-btn']} ${styles.no}`} onClick={() => handleCastVote('no')}>No</button>
          </div>
        </Modal>

        <Modal show={isBlankCardModalOpen} onClose={() => setIsBlankCardModalOpen(false)}>
          <h2>Write Your Own Card</h2>
          <p>Enter the text for your custom white card.</p>
          <textarea
            id="blank-card-input"
            maxLength="150"
            placeholder="Something witty and/or offensive..."
            value={blankCardText}
            onChange={(e) => setBlankCardText(e.target.value)}
          ></textarea>
          <div className={styles['char-count']}>
            <span id="char-count">{blankCardText.length} / 150</span>
          </div>
          <div className={styles['modal-actions']}>
            <button id="blank-card-submit-btn" className={`${styles['vote-btn']} ${styles.yes}`} onClick={handleBlankCardSubmit} disabled={blankCardText.length === 0}>Submit</button>
            <button id="blank-card-cancel-btn" className={`${styles['vote-btn']} ${styles.no}`} onClick={() => setIsBlankCardModalOpen(false)}>Cancel</button>
          </div>
        </Modal>
      </main>
    </div>
  );
}

export default PlayerPage;
