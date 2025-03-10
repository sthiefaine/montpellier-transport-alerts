"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { Clock, TrendingUp, AlertTriangle, LineChart } from "lucide-react";

interface EnhancedSummaryStats {
  punctuality_rate: number;
  avg_delay_seconds: number;
  max_delay_seconds: number;
  late_rate: number;
  early_rate: number;
  total_observations: number;
  on_time_exact_percentage: string;
  avg_positive_delay: number;
  avg_early_seconds: number;
  positive_delay_count: number;
  negative_delay_count: number;
  on_time_exact_count: number;
  positive_delay_percentage: string;
  negative_delay_percentage: string;
}

export default function PonctualiteOverviewPage() {
  const [stats, setStats] = useState<EnhancedSummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Récupérer les statistiques générales
        const statsResponse = await fetch("/api/gtfs/delays/enhanced-summary");
        const statsData = await statsResponse.json();
        setStats(statsData);
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className={styles.statsGrid}>
      {/* Carte de taux de ponctualité */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Clock className={styles.cardIcon} />
            Taux de ponctualité
          </h3>
        </div>
        <div className={styles.cardContent}>
          {isLoading ? (
            <div className={styles.skeleton}></div>
          ) : (
            <>
              <div className={styles.statValue}>{stats?.punctuality_rate}%</div>
              <p className={styles.statDescription}>
                Pourcentage de passages avec moins d'une minute d'écart
              </p>
              <div className={styles.progressContainer}>
                <div
                  className={styles.progressBar}
                  style={{ width: `${stats?.punctuality_rate || 0}%` }}
                ></div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Carte de retard moyen */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <TrendingUp className={styles.cardIcon} />
            Retard moyen
          </h3>
        </div>
        <div className={styles.cardContent}>
          {isLoading ? (
            <div className={styles.skeleton}></div>
          ) : (
            <>
              <div className={styles.statValue}>
                {stats?.avg_delay_seconds || 0}s
              </div>
              <p className={styles.statDescription}>
                Moyenne de tous les retards observés
              </p>
              <div className={styles.delayIndicator}>
                <span
                  className={
                    stats?.avg_delay_seconds
                      ? stats.avg_delay_seconds > 60
                        ? styles.badgeDanger
                        : stats.avg_delay_seconds > 30
                        ? styles.badgeWarning
                        : styles.badgeSuccess
                      : styles.badgeSuccess
                  }
                >
                  {stats?.avg_delay_seconds
                    ? stats.avg_delay_seconds > 60
                      ? "Élevé"
                      : stats.avg_delay_seconds > 30
                      ? "Modéré"
                      : "Faible"
                    : "Faible"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Carte de retard max */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <AlertTriangle className={styles.cardIcon} />
            Retard maximal
          </h3>
        </div>
        <div className={styles.cardContent}>
          {isLoading ? (
            <div className={styles.skeleton}></div>
          ) : (
            <>
              <div className={styles.statValue}>
                {stats?.max_delay_seconds || 0}s
              </div>
              <p className={styles.statDescription}>
                Retard le plus important observé
              </p>
              <div className={styles.delayDistribution}>
                <div className={styles.statusDistItem}>
                  <span>En retard</span>
                  <span>{stats?.late_rate || 0}%</span>
                </div>
                <div className={styles.statusDistItem}>
                  <span>À l'heure</span>
                  <span>{stats?.punctuality_rate || 0}%</span>
                </div>
                <div className={styles.statusDistItem}>
                  <span>En avance</span>
                  <span>{stats?.early_rate || 0}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Carte de nombre d'observations */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <LineChart className={styles.cardIcon} />
            Observations
          </h3>
        </div>
        <div className={styles.cardContent}>
          {isLoading ? (
            <div className={styles.skeleton}></div>
          ) : (
            <>
              <div className={styles.statValue}>
                {stats?.total_observations?.toLocaleString() || 0}
              </div>
              <p className={styles.statDescription}>
                Nombre de passages observés
              </p>
              <div className={styles.observationDetail}>
                <div className={styles.detailItem}>
                  <span>À l'heure exacte</span>
                  <span>{stats?.on_time_exact_percentage || 0}%</span>
                </div>
                <div className={styles.detailItem}>
                  <span>Retard moyen positif</span>
                  <span>{stats?.avg_positive_delay || 0}s</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
