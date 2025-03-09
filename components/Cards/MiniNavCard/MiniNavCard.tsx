"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import styles from "./MiniNavCard.module.css";

interface MiniNavCardProps {
  title: string;
  icon: ReactNode;
  href: string;
  color?: string;
  count?: number | string;
}

const MiniNavCard: React.FC<MiniNavCardProps> = ({
  title,
  icon,
  href,
  color = "#3b82f6", // Bleu par défaut
  count,
}) => {
  return (
    <Link
      href={href}
      className={styles.card}
      style={{ borderLeftColor: color }}
    >
      <div className={styles.iconContainer} style={{ color }}>
        {icon}
      </div>

      <div className={styles.content}>
        <div className={styles.title}>{title}</div>

        {count !== undefined && (
          <div className={styles.count} style={{ backgroundColor: color }}>
            {count}
          </div>
        )}
      </div>
    </Link>
  );
};

export default MiniNavCard;
