import React from 'react';
import styles from '../styles/components.module.css';

function Card({ text, type, back }) {
  const cardStyle = type === 'black' ? styles.black : styles.white;
  const backStyle = back ? styles.back : '';

  return (
    <div className={`${styles.card} ${cardStyle} ${backStyle}`}>
      <p>{text}</p>
    </div>
  );
}

export default Card;