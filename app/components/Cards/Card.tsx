import React, { ReactElement } from 'react';
import styles from './Card.module.css';

type CardProps ={
  title: string
  value: number | string
  icon: ReactElement
  color: string

}

const Card = ({ title, value, icon, color }: CardProps) => {
  return (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.value}>{value}</div>
      </div>
    </div>
  );
};

export default Card;