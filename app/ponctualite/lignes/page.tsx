"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { Clock, ArrowDown, AlertCircle } from "lucide-react";
import { formatSecondsToTime } from "@/helpers/time";

interface RouteStats {
  route_number: string;
  route_name: string;
  color: string;
  avg_delay_seconds: number;
  punctuality_percentage: number;
  observations: number;
}

export default function PonctualiteRoutesPage() {
  const [routeStats, setRouteStats] = useState<RouteStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<keyof RouteStats>("observations");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [timeframe, setTimeframe] = useState<"today" | "week">("today");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Récupérer les statistiques par route avec le bon timeframe
        const routeStatsResponse = await fetch(`/api/gtfs/delays/by-route?timeframe=${timeframe}`);
        const routeStatsData = await routeStatsResponse.json();
        
        // Filtrer les valeurs aberrantes (retards dépassant 2 heures)
        const filteredData = routeStatsData.map((route: RouteStats) => {
          // Si le retard moyen dépasse 2 heures (7200 secondes), on le considère comme aberrant
          if (route.avg_delay_seconds > 7200) {
            // On marque la valeur comme aberrante en la limitant à 7200 secondes
            console.warn(`Valeur de retard aberrante détectée pour la ligne ${route.route_number}: ${route.avg_delay_seconds}s`);
            return { ...route, avg_delay_seconds: 7200, hasAberration: true };
          }
          return { ...route, hasAberration: false };
        });
        
        setRouteStats(filteredData);
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeframe]);

  // Fonction pour trier les données
  const sortData = (field: keyof RouteStats) => {
    if (sortBy === field) {
      // Inverser la direction si on clique sur la même colonne
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Nouvelle colonne, définir le tri par défaut
      setSortBy(field);
      setSortDirection("desc"); // Par défaut, tri descendant
    }
  };

  // Données triées
  const sortedData = [...routeStats].sort((a, b) => {
    // Valeurs à comparer
    let valueA = a[sortBy];
    let valueB = b[sortBy];

    // Comparaison spéciale pour les chaînes
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortDirection === "asc" 
        ? valueA.localeCompare(valueB) 
        : valueB.localeCompare(valueA);
    }

    // Comparaison numérique
    return sortDirection === "asc" 
      ? (valueA as number) - (valueB as number) 
      : (valueB as number) - (valueA as number);
  });

  // Détermine la classe CSS pour le retard
  const getDelayClass = (delay: number) => {
    if (delay <= 30) return styles.goodDelay;
    if (delay <= 60) return styles.mediumDelay;
    if (delay <= 300) return styles.badDelay;
    return styles.veryBadDelay;
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          <Clock size={16} className={styles.titleIcon} />
          Ponctualité par ligne
        </h3>
        <div className={styles.cardActions}>
          <div className={styles.timeframeSelector}>
            <button 
              className={`${styles.timeframeButton} ${timeframe === 'today' ? styles.activeTimeframe : ''}`}
              onClick={() => setTimeframe('today')}
            >
              Aujourd'hui
            </button>
            <button 
              className={`${styles.timeframeButton} ${timeframe === 'week' ? styles.activeTimeframe : ''}`}
              onClick={() => setTimeframe('week')}
            >
              7 derniers jours
            </button>
          </div>
        </div>
      </div>
      <div className={styles.cardContent}>
        {isLoading ? (
          <div className={styles.skeletonTable}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={styles.skeletonRow}>
                <div className={styles.skeletonCell}></div>
                <div className={styles.skeletonCell}></div>
                <div className={styles.skeletonCell}></div>
                <div className={styles.skeletonCell}></div>
              </div>
            ))}
          </div>
        ) : routeStats.length === 0 ? (
          <div className={styles.noData}>
            Aucune donnée disponible pour cette période
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.sortableHeader} onClick={() => sortData("route_number")}>
                    <div className={styles.headerContent}>
                      Ligne
                      {sortBy === "route_number" && (
                        <ArrowDown size={14} className={sortDirection === "asc" ? styles.sortAsc : styles.sortDesc} />
                      )}
                    </div>
                  </th>
                  <th className={styles.sortableHeader} onClick={() => sortData("avg_delay_seconds")}>
                    <div className={styles.headerContent}>
                      Retard moyen
                      {sortBy === "avg_delay_seconds" && (
                        <ArrowDown size={14} className={sortDirection === "asc" ? styles.sortAsc : styles.sortDesc} />
                      )}
                    </div>
                  </th>
                  <th className={styles.sortableHeader} onClick={() => sortData("punctuality_percentage")}>
                    <div className={styles.headerContent}>
                      Ponctualité
                      {sortBy === "punctuality_percentage" && (
                        <ArrowDown size={14} className={sortDirection === "asc" ? styles.sortAsc : styles.sortDesc} />
                      )}
                    </div>
                  </th>
                  <th className={styles.sortableHeader} onClick={() => sortData("observations")}>
                    <div className={styles.headerContent}>
                      Observations
                      {sortBy === "observations" && (
                        <ArrowDown size={14} className={sortDirection === "asc" ? styles.sortAsc : styles.sortDesc} />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((route: any) => {
                  // Assurons-nous que toutes les valeurs sont des primitives
                  const routeNumber = String(route.route_number || "");
                  const routeName = String(route.route_name || "");
                  const color = typeof route.color === "string" ? route.color : "#ccc";

                  // Convertir les valeurs numériques en nombre, avec fallback à 0
                  const avgDelay = typeof route.avg_delay_seconds === "number" ? route.avg_delay_seconds : 0;
                  const punctuality = typeof route.punctuality_percentage === "number" ? route.punctuality_percentage : 0;
                  const observations = typeof route.observations === "number" ? route.observations : 0;
                  const hasAberration = route.hasAberration || false;

                  // Formater les observations
                  const formattedObservations = observations.toLocaleString();

                  return (
                    <tr key={routeNumber || `route-${Math.random()}`}>
                      <td className={styles.routeCell}>
                        <div
                          className={styles.routeColor}
                          style={{ backgroundColor: color }}
                        ></div>
                        <div className={styles.routeInfo}>
                          <span className={styles.routeNumber}>{routeNumber}</span>
                          <span className={styles.routeName}>{routeName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.delayValue} ${getDelayClass(avgDelay)}`}>
                          {hasAberration ? (
                            <span className={styles.aberrantValue} title="Valeur estimée (valeur réelle aberrante)">
                              <AlertCircle size={14} />
                              {formatSecondsToTime(avgDelay)}
                            </span>
                          ) : (
                            avgDelay > 60 ? formatSecondsToTime(avgDelay) : formatSecondsToTime(avgDelay)
                          )}
                        </span>
                      </td>
                      <td>
                        <div className={styles.punctualityWrapper}>
                          <span className={styles.punctualityValue}>
                            {Math.round(punctuality)}%
                          </span>
                          <div className={styles.progressContainer}>
                            <div
                              className={styles.progressBar}
                              style={{
                                width: `${Math.min(100, Math.max(0, punctuality))}%`,
                                backgroundColor: getPunctualityColor(punctuality)
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.observationsCell}>{formattedObservations}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Fonction pour déterminer la couleur de la barre de ponctualité
function getPunctualityColor(percentage: number): string {
  if (percentage >= 90) return "#22c55e"; // Vert
  if (percentage >= 75) return "#84cc16"; // Vert-jaune
  if (percentage >= 60) return "#eab308"; // Jaune
  if (percentage >= 40) return "#f97316"; // Orange
  return "#ef4444"; // Rouge
}