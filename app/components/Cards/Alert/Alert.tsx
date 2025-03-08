import React, { ReactElement } from 'react';
import styles from './AlertCard.module.css';

interface AlertCardProps {
  title: string;
  value: string;
  icon: ReactElement;
  color: string;
  isLoading?: boolean;
}

const AlertCard = ({ title, value, icon, color, isLoading = false }: AlertCardProps) => {
  // Handle loading state
  if (isLoading) {
    return (
      <div className={`${styles.card} ${styles.loading}`}>
        <div className={styles.loadingPulse}></div>
      </div>
    );
  }

  return (
    <div className={`${styles.card} ${styles[color]} ${styles.fadeIn}`}>
      <div className={styles.iconContainer}>
        <div className={styles.icon}>{icon}</div>
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.value}>{value}</div>
      </div>
    </div>
  );
};

export default AlertCard;