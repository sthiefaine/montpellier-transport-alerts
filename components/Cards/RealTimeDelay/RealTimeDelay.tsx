// components/Cards/RealTimeDelay/RealTiimeDelay.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Clock, RefreshCw, Check, ArrowDown, ArrowUp } from "lucide-react";
import styles from "./RealTimeDelay.module.css";

interface DelayStats {
  avg_delay_seconds: number;
  total_observations: number;
  punctuality_rate: number;
  late_rate: number;
  early_rate: number;
  max_delay_seconds: number;
  avg_positive_delay: number;
  avg_early_seconds: number;
  positive_delay_count: number;
  negative_delay_count: number;
  on_time_exact_count: number;
  positive_delay_percentage: string;
  negative_delay_percentage: string;
  on_time_exact_percentage: string;
  last_updated?: string;
  calculation_date?: string;
}

interface RealTimeDelayCardProps {
  delayStats?: DelayStats;
  refreshInterval?: number; // en millisecondes
}

// Composant de jauge animée
const AnimatedBar: React.FC<{
  percentage: number;
  color: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  animate?: boolean;
}> = ({ percentage, color, icon, label, count, animate = true }) => {
  // Valeur de pourcentage sécurisée
  const safePercentage = Math.min(Math.max(0, percentage), 100);

  return (
    <div className={styles.barContainer}>
      <div className={styles.barInfo}>
        <div className={styles.barHeader}>
          <div className={styles.labelContainer}>
            <span
              className={styles.iconContainer}
              style={{ backgroundColor: color }}
            >
              {icon}
            </span>
            <span className={styles.barLabel}>{label}</span>
          </div>
          <div className={styles.barPercentage} style={{ color }}>
            {safePercentage.toFixed(1)}%
          </div>
        </div>

        <div className={styles.barCount}>
          {count.toLocaleString()} Observations
        </div>
      </div>

      <div className={styles.barTrack}>
        <div
          className={`${styles.barProgress} ${animate ? styles.animate : ""}`}
          style={{
            width: `${safePercentage}%`,
            backgroundColor: color,
          }}
          data-percentage={safePercentage.toFixed(1)}
        />
      </div>
    </div>
  );
};

const RealTimeDelayCard: React.FC<RealTimeDelayCardProps> = ({
  delayStats: initialStats,
  refreshInterval = 60000, // 1 minute par défaut
}) => {
  const [stats, setStats] = useState<DelayStats | null>(initialStats || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    initialStats ? new Date() : null
  );
  const [animate, setAnimate] = useState<boolean>(true);

  const fetchCurrentDayStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/gtfs/delays/today");

      if (!res.ok) {
        throw new Error(
          `Erreur lors de la récupération des données: ${res.status}`
        );
      }

      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
      setError(null);

      // Redéclencher l'animation
      setAnimate(false);
      setTimeout(() => setAnimate(true), 50);
    } catch (err) {
      console.error("Erreur lors du chargement des statistiques:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Effet pour charger les statistiques périodiquement
  useEffect(() => {
    // Configurer l'intervalle de rafraîchissement
    const interval = setInterval(fetchCurrentDayStats, refreshInterval);

    // Nettoyer l'intervalle lors du démontage
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Fonction pour formater les secondes en texte lisible
  const formatDelay = (seconds: number | string) => {
    const secondsNum = typeof seconds === "number" ? seconds : Number(seconds);
    if (isNaN(secondsNum)) return "0 sec";

    if (Math.abs(secondsNum) < 60) {
      return `${Math.abs(secondsNum).toFixed(1)} sec`;
    } else {
      const minutes = Math.floor(Math.abs(secondsNum) / 60);
      const remainingSeconds = Math.abs(secondsNum) % 60;
      return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    }
  };

  if (!stats && error) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>Ponctualité du réseau</h3>
          <button
            onClick={fetchCurrentDayStats}
            className={styles.refreshButton}
            disabled={loading}
            title="Rafraîchir les données"
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ""} />
          </button>
        </div>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  // Utilisez les statistiques initiales si elles existent, sinon afficher l'état de chargement
  const displayStats = stats || initialStats;

  if (!displayStats) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>Ponctualité du réseau</h3>
        </div>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Chargement des données...</span>
        </div>
      </div>
    );
  }

  // Convertir les pourcentages en nombres
  const punctualityRate =
    typeof displayStats.punctuality_rate === "number"
      ? displayStats.punctuality_rate
      : Number(displayStats.punctuality_rate);

  const lateRate =
    typeof displayStats.late_rate === "number"
      ? displayStats.late_rate
      : Number(displayStats.late_rate);

  const earlyRate =
    typeof displayStats.early_rate === "number"
      ? displayStats.early_rate
      : Number(displayStats.early_rate);

  // Compteurs
  const onTimeCount =
    typeof displayStats.on_time_exact_count === "number"
      ? displayStats.on_time_exact_count
      : Number(displayStats.on_time_exact_count);

  const lateCount =
    typeof displayStats.positive_delay_count === "number"
      ? displayStats.positive_delay_count
      : Number(displayStats.positive_delay_count);

  const earlyCount =
    typeof displayStats.negative_delay_count === "number"
      ? displayStats.negative_delay_count
      : Number(displayStats.negative_delay_count);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <Clock size={16} className={styles.titleIcon} />
          Ponctualité du réseau
        </h3>
        <button
          onClick={fetchCurrentDayStats}
          className={styles.refreshButton}
          disabled={loading}
          title="Rafraîchir les données"
        >
          <RefreshCw size={16} className={loading ? styles.spinning : ""} />
        </button>
      </div>

      <div className={styles.statsContainer}>
        <AnimatedBar
          percentage={punctualityRate}
          color="#10b981"
          icon={<Check size={14} />}
          label="À l'heure (±1min)"
          count={onTimeCount}
          animate={animate}
        />

        <AnimatedBar
          percentage={lateRate}
          color="#ef4444"
          icon={<ArrowUp size={14} />}
          label="En retard"
          count={lateCount}
          animate={animate}
        />

        <AnimatedBar
          percentage={earlyRate}
          color="#3b82f6"
          icon={<ArrowDown size={14} />}
          label="En avance"
          count={earlyCount}
          animate={animate}
        />
      </div>

      <div className={styles.detailBox}>
        <div className={styles.detailStats}>
          <div className={styles.detailItem}>
            <span className={styles.detailValue}>
              {formatDelay(displayStats.avg_positive_delay)}
            </span>
            <span className={styles.detailLabel}>Retard moyen</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailValue}>
              {formatDelay(displayStats.avg_early_seconds)}
            </span>
            <span className={styles.detailLabel}>Avance moyenne</span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailValue}>
              {typeof displayStats.total_observations === "number"
                ? displayStats.total_observations.toLocaleString()
                : Number(displayStats.total_observations).toLocaleString()}
            </span>
            <span className={styles.detailLabel}>Observations</span>
          </div>
        </div>

        {lastUpdated && (
          <div className={styles.lastUpdated}>
            <Clock size={12} />
            <span>
              Données du{" "}
              {stats?.calculation_date
                ? new Date(stats.calculation_date).toLocaleDateString("fr-FR")
                : new Date().toLocaleDateString("fr-FR")}{" "}
              • Actualisé à {lastUpdated.toLocaleTimeString("fr-FR")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeDelayCard;
