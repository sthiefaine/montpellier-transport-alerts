import React, { cloneElement, ReactElement } from "react";
import Link from "next/link";
import styles from "./Card.module.css";

type CardProps = {
  title: string;
  value: number | string;
  icon: ReactElement;
  color: string;
  href?: string;
  onClick?: () => void;
};

const Card = ({ title, value, icon, color, href, onClick }: CardProps) => {
  const cardContent = (
    <>
      <div className={styles.icon}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
      </div>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.value}>{value}</div>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`${styles.card} ${styles[color]} ${styles.clickable}`}
      >
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${styles.card} ${styles[color]} ${styles.clickable}`}
        style={{
          width: "100%",
          textAlign: "left",
          border: "none",
          background: "none",
          padding: 0,
        }}
      >
        <div className={`${styles.card} ${styles[color]}`}>{cardContent}</div>
      </button>
    );
  }

  return <div className={`${styles.card} ${styles[color]}`}>{cardContent}</div>;
};

export default Card;
