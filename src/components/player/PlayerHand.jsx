import React from 'react';
import styles from '../../styles/components.module.css';

const PlayerHand = ({ hand, selectedCardIndices, handleCardSelect, pickCount, submitted }) => {
    const handWithSelection = hand?.map((card, index) => ({
        card,
        index,
        isSelected: selectedCardIndices.includes(index)
    })).sort((a, b) => {
        if (a.isSelected && !b.isSelected) return -1;
        if (!a.isSelected && b.isSelected) return 1;
        if (a.isSelected && b.isSelected) {
            return selectedCardIndices.indexOf(a.index) - selectedCardIndices.indexOf(b.index);
        }
        // Keep original order for unselected cards
        return a.index - b.index;
    }) || [];

    return (
        <div className={styles['player-hand-container']}>
            <div id="my-hand" className={selectedCardIndices.length === pickCount ? styles['selection-complete'] : ''}>
                {(selectedCardIndices.length === pickCount ? handWithSelection.filter(c => c.isSelected) : handWithSelection).map(({ card: cardText, index, isSelected }) => {
                    const isBlank = cardText === '___BLANK_CARD___';
                    const isDisabled = submitted || (selectedCardIndices.length >= pickCount && !isSelected);

                    let classes = `${styles.card} ${styles.white}`;
                    if (isBlank) classes += ` ${styles.blank}`;
                    if (isSelected) classes += ` ${styles.selected}`;

                    const content = isBlank ? 'Write your own card!' : cardText;

                    return (
                        <button
                            key={index}
                            className={classes}
                            data-card-index={index}
                            disabled={isDisabled}
                            onClick={() => {
                                if (isBlank) {
                                    if (pickCount > 1 && !window.confirm(`This black card requires ${pickCount} answers. Submitting a blank card will only use your one custom answer. Continue?`)) {
                                        return;
                                    }
                                    // setIsBlankCardModalOpen(true); // This will be handled by the parent component
                                } else {
                                    handleCardSelect(index);
                                }
                            }}
                        >
                            <p>{content}</p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default PlayerHand;