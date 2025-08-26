import React from 'react';
import styles from '../../styles/components.module.css';

const PlayerSubmissions = ({ submissions, myId }) => {
    return (
        <div id="player-submission-view">
            <h4>Your Submission:</h4>
            <div id="my-submission-area" className={styles['card-group']}>
                {(submissions || {})[myId]?.map((cardText, index) => (
                    <div key={index} className={`${styles.card} ${styles.white}`}>
                        <p>{cardText}</p>
                    </div>
                ))}
            </div>
            <h4 id="waiting-for-players-text">Waiting for...</h4>
            <div id="other-submissions-area" className={styles['card-group']}>
                {/* Other submissions are not shown to players until judging/voting */}
            </div>
        </div>
    );
};

export default PlayerSubmissions;