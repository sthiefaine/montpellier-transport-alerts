"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Clock, ArrowRight, Bus, MapPin } from "lucide-react";
import styles from "./NextDepartures.module.css";

interface NextDepartureData {
  tripId: string;
  line: {
    id: string;
    number: string;
    name: string;
    color: string | null;
  };
  stop: {
    id: string;
    name: string;
    code: string | null;
  };
  direction: {
    id: number | null;
    headsign: string;
  };
  delay: number;
  scheduledTime: string | null;
  estimatedTime: string | null;
  formattedScheduled: string | null;
  formattedEstimated: string | null;
}

interface NextDeparturesProps {
  stopId?: string;
  routeId?: string; // Single routeId
  directionId?: number | null; // 0, 1 or null (for both directions)
  limit?: number;
  refreshInterval?: number;
  showTitle?: boolean;
  displayMode?: "auto" | "table" | "cards";
}

const NextDepartures: React.FC<NextDeparturesProps> = ({
  stopId,
  routeId,
  directionId,
  limit = 10,
  refreshInterval = 60000, // 60 secondes par défaut
  showTitle = true,
  displayMode = "auto",
}) => {
  const [departures, setDepartures] = useState<NextDepartureData[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">(
    displayMode === "auto" ? "table" : displayMode
  );

  // Détecter la taille de l'écran pour le mode responsive
  useEffect(() => {
    if (displayMode === "auto") {
      const handleResize = () => {
        setViewMode(window.innerWidth < 768 ? "cards" : "table");
      };

      // Définir le mode initial
      handleResize();

      // Ajouter l'écouteur d'événement
      window.addEventListener("resize", handleResize);

      // Nettoyer l'écouteur d'événement
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } else {
      setViewMode(displayMode);
    }
  }, [displayMode]);

  const fetchDepartures = async () => {
    try {
      setLoading(true);

      let url = "/api/gtfs/departures/next?limit=" + limit;

      // Ajouter les paramètres de filtrage
      if (stopId) url += "&stopId=" + stopId;
      if (routeId) url += "&routeId=" + routeId;
      if (directionId !== undefined && directionId !== null)
        url += "&directionId=" + directionId;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Ajuster les heures en fonction du fuseau horaire local
      const adjustedData = data.map((departure: NextDepartureData) => {
        return {
          ...departure,
          formattedScheduled: departure.scheduledTime
            ? new Date(departure.scheduledTime).toLocaleTimeString("fr-FR")
            : null,
          formattedEstimated: departure.estimatedTime
            ? new Date(departure.estimatedTime).toLocaleTimeString("fr-FR")
            : null,
        };
      });

      setDepartures(adjustedData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Erreur lors du chargement des prochains départs:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour calculer et formater le temps restant
  const calculateCountdown = useCallback((estimatedTime: string | null): string => {
    if (!estimatedTime) return "--:--";
    
    const now = new Date();
    const estimated = new Date(estimatedTime);
    const diffMs = estimated.getTime() - now.getTime();
    
    // Si le départ est passé, afficher +xx:xx pour indiquer le temps écoulé depuis le départ
    if (diffMs < 0) {
      const elapsedMs = Math.abs(diffMs);
      const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
      const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
      
      // Format +hh:mm:ss ou +mm:ss
      if (hours > 0) {
        return `+${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        return `+${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    // Calculer heures, minutes, secondes pour le temps restant
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    // Format (hh:)mm:ss - heures seulement si > 0
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, []);

  // Mettre à jour tous les comptes à rebours chaque seconde
  useEffect(() => {
    // Fonction pour mettre à jour tous les comptes à rebours
    const updateAllCountdowns = () => {
      const newCountdowns: Record<string, string> = {};
      
      departures.forEach((departure) => {
        const key = `${departure.tripId}-${departure.stop.id}-${departure.line.id}`;
        newCountdowns[key] = calculateCountdown(departure.estimatedTime);
      });
      
      setCountdowns(newCountdowns);
    };
    
    // Mettre à jour immédiatement
    updateAllCountdowns();
    
    // Puis mettre à jour toutes les secondes
    const intervalId = setInterval(updateAllCountdowns, 1000);
    
    // Nettoyer l'intervalle à la fin
    return () => clearInterval(intervalId);
  }, [departures, calculateCountdown]);

  useEffect(() => {
    // Charger les données immédiatement
    fetchDepartures();

    // Configurer la mise à jour périodique
    const interval = setInterval(fetchDepartures, refreshInterval);

    // Nettoyer l'intervalle lors du démontage
    return () => clearInterval(interval);
  }, [stopId, routeId, directionId, limit, refreshInterval]);

  // Formatter le retard pour l'affichage
  const formatDelay = (seconds: number | null) => {
    if (seconds === null) return "";

    if (seconds === 0) return "À l'heure";

    const absDelay = Math.abs(seconds);

    if (absDelay < 60) {
      return seconds > 0 ? `Retard de ${absDelay}s` : `Avance de ${absDelay}s`;
    }

    const minutes = Math.floor(absDelay / 60);
    const remainingSeconds = absDelay % 60;

    if (remainingSeconds === 0) {
      return seconds > 0
        ? `Retard de ${minutes}min`
        : `Avance de ${minutes}min`;
    } else {
      return seconds > 0
        ? `Retard de ${minutes}min ${remainingSeconds}s`
        : `Avance de ${minutes}min ${remainingSeconds}s`;
    }
  };

  // Déterminer la classe CSS pour le retard
  const getDelayClass = (delay: number | null) => {
    if (delay === null) return "";
    if (delay === 0) return styles.onTime;
    if (delay > 0) return styles.late;
    return styles.early;
  };

  // Générer une clé unique pour chaque départ
  const getCountdownKey = (departure: NextDepartureData, index: number) => {
    return `${departure.tripId}-${departure.stop.id}-${departure.line.id}`;
  };

  // Dé-duplication des départs avant le rendu
  const uniqueDepartures = React.useMemo(() => {
    // Utiliser un Map pour éliminer les doublons
    const uniqueMap = new Map();

    departures.forEach((departure, index) => {
      // Créer une clé basée sur les données pertinentes
      const key = `${departure.tripId}-${departure.stop.id}-${departure.line.id}-${departure.formattedEstimated}`;

      // Ne garder que la première occurrence
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...departure, _index: index });
      }
    });

    // Convertir le Map en tableau
    return Array.from(uniqueMap.values());
  }, [departures]);

  // Génère une clé unique garantie pour chaque départ
  const generateUniqueKey = (departure: any, index: number) => {
    // Utiliser l'index original et un index secondaire pour garantir l'unicité absolue
    return `idx-${departure._index}-${index}`;
  };

  // Rendu du tableau pour desktop
  const renderTable = () => (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ligne</th>
            {!stopId && <th>Arrêt</th>}
            <th>Direction</th>
            <th>Retard</th>
            <th>ETA</th>
          </tr>
        </thead>
        <tbody>
          {uniqueDepartures.map((departure, index) => (
            <tr key={generateUniqueKey(departure, index)}>
              <td className={styles.lineColumn}>
                <div
                  className={styles.lineNumber}
                  style={{
                    backgroundColor: departure.line.color || "#666",
                    color: isLightColor(departure.line.color) ? "#000" : "#fff",
                  }}
                >
                  {departure.line.number}
                </div>
              </td>
              {!stopId && (
                <td className={styles.stopColumn}>{departure.stop.name}</td>
              )}
              <td
                className={styles.directionColumn}
                title={departure.direction.headsign}
              >
                {truncateText(departure.direction.headsign, 20)}
              </td>
              <td
                className={`${styles.delayColumn} ${getDelayClass(
                  departure.delay
                )}`}
              >
                {formatDelay(departure.delay)}
              </td>
              <td className={`${styles.timeColumn} ${getCountdownClass(countdowns[getCountdownKey(departure, index)])}`}>
                {countdowns[getCountdownKey(departure, index)] || calculateCountdown(departure.estimatedTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
  // Fonction pour déterminer la classe CSS basée sur le compte à rebours
  function getCountdownClass(countdown: string | undefined): string {
    if (!countdown) return "";
    
    // Si c'est un départ passé (format +xx:xx)
    if (countdown.startsWith('+')) return styles.late;
    
    // Si le format est HH:MM:SS ou MM:SS
    const parts = countdown.split(':');
    let minutes = 0;
    
    if (parts.length === 3) {
      // format HH:MM:SS
      minutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 2) {
      // format MM:SS
      minutes = parseInt(parts[0]);
    }
    
    if (minutes <= 2) return styles.late;
    if (minutes <= 5) return styles.early;
    return styles.onTime;
  }

  // Rendu des cartes pour mobile
  const renderCards = () => (
    <div className={styles.cardsContainer}>
      {uniqueDepartures.map((departure, index) => (
        <div
          key={generateUniqueKey(departure, index)}
          className={styles.departureCard}
        >
          <div className={styles.cardHeader}>
            <div
              className={styles.cardLineNumber}
              style={{
                backgroundColor: departure.line.color || "#666",
                color: isLightColor(departure.line.color) ? "#000" : "#fff",
              }}
            >
              {departure.line.number}
            </div>

            <div className={styles.cardTimeInfo}>
              <div className={`${styles.estimatedTime} ${getCountdownClass(countdowns[getCountdownKey(departure, index)])}`}>
                {countdowns[getCountdownKey(departure, index)] || calculateCountdown(departure.estimatedTime)}
              </div>
            </div>
          </div>

          <div className={styles.cardDetails}>
            {!stopId && (
              <div className={styles.cardStop}>
                <MapPin size={14} className={styles.cardIcon} />
                {departure.stop.name}
              </div>
            )}

            <div className={styles.cardDirection}>
              <Bus size={14} className={styles.cardIcon} />
              {departure.direction.headsign}
            </div>

            <div
              className={`${styles.cardDelay} ${getDelayClass(
                departure.delay
              )}`}
            >
              {formatDelay(departure.delay)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {showTitle && (
          <h3 className={styles.title}>
            Prochains départs
            {stopId && departures.length > 0 && (
              <span className={styles.subtitle}>
                Arrêt: {departures[0].stop.name}
              </span>
            )}
          </h3>
        )}

        <div className={styles.headerActions}>
          {/* Toggle optionnel pour basculer manuellement entre les vues */}
          {displayMode === "auto" && (
            <button
              onClick={() =>
                setViewMode(viewMode === "table" ? "cards" : "table")
              }
              className={styles.toggleButton}
              title={viewMode === "table" ? "Vue cartes" : "Vue tableau"}
            >
              {viewMode === "table" ? "Cartes" : "Tableau"}
            </button>
          )}

          <button
            onClick={fetchDepartures}
            className={styles.refreshButton}
            disabled={loading}
            title="Rafraîchir les données"
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ""} />
          </button>
        </div>
      </div>

      {error ? (
        <div className={styles.error}>{error}</div>
      ) : loading && departures.length === 0 ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Chargement des prochains départs...</span>
        </div>
      ) : departures.length === 0 ? (
        <div className={styles.noData}>Aucun départ prévu pour le moment</div>
      ) : (
        <>
          {viewMode === "table" ? renderTable() : renderCards()}

          {lastUpdated && (
            <div className={styles.lastUpdated}>
              <Clock size={12} />
              <span>Actualisé à {lastUpdated.toLocaleTimeString("fr-FR")}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Fonction pour tronquer le texte avec des points de suspension
function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Fonction utilitaire pour déterminer si une couleur est claire
function isLightColor(color: string | null): boolean {
  if (!color) return false;

  // Supprimer le # si présent
  color = color.replace("#", "");

  // Convertir en RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Calculer la luminosité (formule standard)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Retourner true si la couleur est claire (luminance > 0.5)
  return luminance > 0.5;
}

export default NextDepartures;