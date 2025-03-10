"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./layout.module.css";

export default function PonctualiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [selectedPeriod, setSelectedPeriod] = useState<
    "today" | "yesterday" | "week" | "month"
  >("today");
  const [selectedThreshold, setSelectedThreshold] = useState<
    "30" | "60" | "120"
  >("60");

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(
      e.target.value as "today" | "yesterday" | "week" | "month"
    );
    // À implémenter: logique pour partager cette valeur avec les sous-pages
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedThreshold(e.target.value as "30" | "60" | "120");
    // À implémenter: logique pour partager cette valeur avec les sous-pages
  };

  useEffect(() => {
    // Vous pourriez utiliser cet effet pour synchroniser les filtres avec l'URL
    // ou pour exécuter un code lors du changement de page
  }, [pathname]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Tableau de bord de ponctualité</h1>
        <div className={styles.filters}>
          <div className={styles.filterItem}>
            <p>Période:</p>
            <select
              className={styles.select}
              value={selectedPeriod}
              onChange={handlePeriodChange}
            >
              <option value="today">Aujourd'hui</option>
              <option value="yesterday">Hier</option>
              <option value="week">7 derniers jours</option>
              <option value="month">30 derniers jours</option>
            </select>
          </div>
          <div className={styles.filterItem}>
            <p>Seuil de ponctualité:</p>
            <select
              className={styles.select}
              value={selectedThreshold}
              onChange={handleThresholdChange}
            >
              <option value="30">±30 secondes</option>
              <option value="60">±60 secondes</option>
              <option value="120">±120 secondes</option>
            </select>
          </div>
        </div>
      </header>

      <nav className={styles.navigation}>
        <Link
          href="/ponctualite"
          className={`${styles.navLink} ${
            pathname === "/ponctualite" ? styles.activeLink : ""
          }`}
        >
          Vue d'ensemble
        </Link>
        <Link
          href="/ponctualite/lignes"
          className={`${styles.navLink} ${
            pathname === "/ponctualite/lignes" ? styles.activeLink : ""
          }`}
        >
          Par ligne
        </Link>
        <Link
          href="/ponctualite/arrets"
          className={`${styles.navLink} ${
            pathname === "/ponctualite/arrets" ? styles.activeLink : ""
          }`}
        >
          Par arrêt
        </Link>
        <Link
          href="/ponctualite/meteo"
          className={`${styles.navLink} ${
            pathname === "/ponctualite/meteo" ? styles.activeLink : ""
          }`}
        >
          Impact météo
        </Link>
      </nav>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
