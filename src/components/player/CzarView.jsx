import React from 'react';
import styles from '../../styles/components.module.css';

const CzarView = ({ submissions, czarSelection, handleCzarSelect, handleCzarConfirm }) => {
    const createCzarChoicesHTML = (submissions, czarSelection) => {
        return Object.entries(submissions).map(([playerId, submission]) => {
            const isSelected = czarSelection && JSON.stringify(czarSelection) === JSON.stringify(submission);
            const selectedClass = isSelected ? styles['czar-selected'] : '';

            return (
                <div
                    key={playerId}
                    className={`${styles['card-group-container']} ${styles['card-group']} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleCzarSelect(submission)}
                >
                    {submission.map((cardText, index) => (
                        <div key={index} className={`${styles.card} ${styles.white}`}>
                            <p>{cardText}</p>
                        </div>
                    ))}
                </div>
            );
        });
    };

    return (
        <div id="czar-judging-area">
            <h3>Choose the winning card:</h3>
            <div id="cards-to-judge">
                {createCzarChoicesHTML(submissions, czarSelection)}
            </div>
            <div id="czar-confirm-container" className={styles['czar-confirm-container']}>
                <button id="czar-confirm-btn" className={styles.button} onClick={handleCzarConfirm} disabled={!czarSelection}>
                    Confirm Winner
                </button>
            </div>
        </div>
    );
};

export default CzarView;