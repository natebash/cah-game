import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../GameProvider';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import styles from '../styles/components.module.css';
import { filterTvBoardPlayers } from '../utils/clientUtils';
import Card from '../components/Card';

function BoardPage() {
  const { socket, gameState, joinGame, showNotification } = useGame();
  const [searchParams] = useSearchParams();
  const gameCode = searchParams.get('game');

  const qrCodeRef = useRef(null);

  useEffect(() => {
    if (socket && gameCode) {
    }
  }, [socket, gameCode]);

  const createBoardScoreboardHTML = (players, currentCzarId) => {
    return filterTvBoardPlayers(players)
      .sort((a, b) => b.score - a.score)
      .map(p => {
        const isCzar = p.id === currentCzarId;
        const disconnectedClass = p.disconnected ? styles.disconnected : '';
        const czarClass = isCzar ? styles.czar : '';
        const czarIndicator = isCzar ? ' (Czar)' : '';
        const disconnectedIndicator = p.disconnected ? ' (disconnected)' : '';

        return (
          <div key={p.id} className={`${styles['score-item']} ${disconnectedClass} ${czarClass}`}>
            {p.name}: {p.score}{czarIndicator}{disconnectedIndicator}
          </div>
        );
      });
  };

  const createBoardSubmissionsHTML = (state, submissions, shuffledSubmissions, voteCounts, players, currentCzar) => {
    const activePlayers = filterTvBoardPlayers(players).filter(p => p.id !== currentCzar);

    if (state === 'playing' || state === 'judging' || state === 'voting') {
        const submissionsToRender = Object.entries(submissions || {});

        return submissionsToRender.map(([playerId, submission]) => {
          const isSelected = false;
          const isSelectable = false;
          
          const containerClasses = [
              styles['card-group-container'],
              isSelectable ? styles.selectable : '',
              isSelected ? styles.selected : ''
          ].filter(Boolean).join(' ');

          return (
              <div 
                  key={playerId} 
                  className={containerClasses}
              >
                  <div className={styles['card-group']}>
                      {submission.map((cardText, cardIndex) => (
                          <Card key={cardIndex} text={cardText} type="white" />
                      ))}
                  </div>
                  {state === 'voting' && (
                      <div className={styles['vote-count']}>
                          {voteCounts[playerId] || 0} votes
                      </div>
                  )}
              </div>
          );
      });
    }
  };

  const renderWinnerBanner = (elementId) => {
    if (!gameState || !gameState.roundWinnerInfo) return null;
    return (
      <div id={elementId} className={`${styles['winner-banner']} ${styles.visible}`}>
        <div className={styles['winner-banner-content']}>
          <p>
            <strong>{gameState.roundWinnerInfo.name}</strong> won the round!
          </p>
          <Card text={gameState.roundWinnerInfo.sentence} type="black" />
        </div>
      </div>
    );
  };

  const renderVoteDisplay = () => {
    if (!gameState.voteToEndState || !gameState.voteToEndState.inProgress) {
      return null;
    }

    const activePlayers = filterTvBoardPlayers(gameState.players).filter(p => !p.disconnected);

    return (
      <div id="vote-display-area" className={styles['vote-display']}>
        <h2 id="vote-display-title">Vote to End Game</h2>
        <p>
          <strong id="vote-initiator-name">{gameState.voteToEndState.initiatorName}</strong> has started a vote to end the game.
        </p>
        <div id="vote-results-list">
          {activePlayers.map(player => {
            const vote = gameState.voteToEndState.votes?.[player.id];
            let statusText = 'Waiting...';
            let statusClass = styles.waiting;

            if (vote === 'yes') {
              statusText = 'Yes';
              statusClass = styles.yes;
            } else if (vote === 'no') {
              statusText = 'No';
              statusClass = styles.no;
            }

            return (
              <div key={player.id} className={styles['vote-result-item']}>
                <span>{player.name}</span>
                <span className={`${styles.status} ${statusClass}`}>{statusText}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    console.log('[BoardPage] gameState changed:', gameState);
  }, [gameState]);

  if (!gameState || !gameState.code || !socket || !Array.isArray(gameState.players)) {
    return <div>Loading game...</div>;
  }

  const isWaiting = gameState.state === 'waiting';
  const isFinished = gameState.state === 'finished';

  return (
    <div className={`${styles.container} ${styles['board-view']}`}>
      {renderWinnerBanner('winner-announcement')}

      <header>
        <div id="game-info">
        </div>
        <div id="scoreboard">
          {createBoardScoreboardHTML(gameState.players, gameState.currentCzar)}
        </div>
      </header>

      <main id="game-area">

        {isWaiting && (
          <div id="waiting-area">
            <h2>Waiting for players...</h2>
            <p>Join with code <strong id="game-code-waiting">{gameState.code}</strong> on your phone.</p>
            <div id="qr-code-container" className={styles['qr-code-container']}>
              <h3>Scan to Join!</h3>
              <div id="qr-code" ref={qrCodeRef}>
                {gameCode && (
                  <QRCodeSVG
                    value={`${window.location.origin}/player?game=${gameCode}`}
                    size={128}
                    level="H"
                    marginSize={10}
                  />
                )}
              </div>
              <p id="join-url-text">Or go to: {window.location.host}/player</p>
            </div>
          </div>
        )}

        {!isWaiting && !isFinished && (
          <div id="round-area">
            <div className={styles['round-content-wrapper']}>
              <div id="black-card-area">
                <Card text={gameState.currentBlackCard ? gameState.currentBlackCard.text.replace(/_/g, '______') : 'The black card will appear here.'} type="black" />
              </div>
              <div id="submissions-wrapper">
                <h2 id="submissions-header">Submissions:</h2>
                <div id="submissions-area" className={styles['submissions-area-grid']}>
                  {createBoardSubmissionsHTML(gameState.state, gameState.submissions, gameState.shuffledSubmissions, gameState.voteCounts, gameState.players, gameState.currentCzar)}
                </div>
              </div>
            </div>
          </div>
        )}

        {renderVoteDisplay()}

        {isFinished && (
          <div id="game-over-area">
            <div id="final-winner-announcement" className={styles['winner-banner']}>
              <h2>Game Over!</h2>
              <p>{gameState.gameOverReason}</p>
              {gameState.winner && <p><strong>Winner: {gameState.winner.name}</strong></p>}
            </div>
            <h2>Game Finished</h2>
            <p>Enter a new code to join another game.</p>
            <input
              type="text"
              id="game-code-input-board-new"
              placeholder="Game Code"
              maxLength="4"
              onChange={(e) => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')}
            />
            <button
              id="board-join-btn-new"
              onClick={() => {
                const newCode = document.getElementById('game-code-input-board-new').value;
                if (newCode) {
                  window.location.href = `/board?game=${newCode}`;
                }
              }}
            >
              New ScoreBoard
            </button>
          </div>
        )}
      </main>

      
    </div>
  );
}

export default BoardPage;