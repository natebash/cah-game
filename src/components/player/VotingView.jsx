import React from 'react';
import styles from '../../styles/components.module.css';

import Card from '../Card';

const VotingView = ({ submissions, handlePlayerVote, myId, votes, hasVoted, players }) => {
    return (
        <div id="player-voting-area">
            <h3>Vote for the best submission!</h3>
            <div id="cards-to-vote-on" className={styles['submissions-area-grid']}>
                {Object.entries(submissions)
                    .filter(([playerId]) => {
                        const player = players.find(p => p.id === playerId);
                        return player && player.name !== 'TV_BOARD';
                    })
                    .map(([playerId, submission]) => {
                        const isVotedFor = (votes || {})[myId] === playerId;
                        const containerClasses = [
                            styles['card-group-container'],
                            !hasVoted ? styles.selectable : '',
                            isVotedFor ? styles.selected : ''
                        ].filter(Boolean).join(' ');

                        return (
                            <div
                                key={playerId}
                                className={containerClasses}
                                onClick={() => !hasVoted && handlePlayerVote(playerId)}
                            >
                                <div className={styles['card-group']}>
                                    {submission.map((cardText, index) => (
                                        <Card key={index} text={cardText} type="white" />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};

export default VotingView;