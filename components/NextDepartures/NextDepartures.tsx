"use client";

import React, { useState, useEffect } from "react";
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

  // Formater une heure en tenant compte du fuseau horaire local
  const formatLocalTime = (date: Date): string => {
    return `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;
  };

  // Dé-duplication des départs avant le rendu
  const uniqueDepartures = React.useMemo(() => {
    // Utiliser un Map pour éliminer les doublons
    const uniqueMap = new Map();

    departures.forEach((departure, index) => {
      // Créer une clé basée sur les données pertinentes
      const key = `${departure.tripId}-${departure.stop.id}-${departure.line.id}-${departure.formattedEstimated}`;

      // Ne garder que la première occurrence (ou mettre à jour selon une logique spécifique)
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
            <th>Heure prévue</th>
            <th>Heure estimée</th>
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
              <td className={styles.timeColumn}>
                {departure.formattedScheduled}
              </td>
              <td className={styles.timeColumn}>
                {departure.formattedEstimated}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

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
              <div className={styles.scheduledTime}>
                {departure.formattedScheduled || "--:--"}
              </div>
              <div className={styles.timeArrow}>
                <ArrowRight size={12} />
              </div>
              <div className={styles.estimatedTime}>
                {departure.formattedEstimated || "--:--"}
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
