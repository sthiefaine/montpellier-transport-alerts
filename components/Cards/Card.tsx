import React, { ReactElement } from "react";
import Link from "next/link";
import styles from "./Card.module.css";

type CardProps = {
  title: string;
  value: number | string;
  icon: ReactElement;
  color: string;
  href?: string; // Nouvelle prop pour ajouter un lien
  onClick?: () => void; // Handler optionnel pour gérer les clics
};

const Card = ({ title, value, icon, color, href, onClick }: CardProps) => {
  // Contenu de la carte
  const cardContent = (
    <>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.value}>{value}</div>
      </div>
    </>
  );

  // Si un href est fourni, rendre la carte comme un lien
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

  // Si un onClick est fourni, rendre la carte comme un bouton
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${styles.card} ${styles[color]} ${styles.clickable}`}
        style={{
          width: "100%",
          textAlign: "left",
          border: "none",
          cursor: "pointer",
        }}
      >
        {cardContent}
      </button>
    );
  }

  // Sinon, rendre la carte comme un div standard
  return <div className={`${styles.card} ${styles[color]}`}>{cardContent}</div>;
};

export default Card;
