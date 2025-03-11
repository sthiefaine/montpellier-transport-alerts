"use client";

import { useState, useEffect } from "react";
import { Clock, ArrowDown, MapPin, Search, X } from "lucide-react";
import styles from "./page.module.css";
import { formatSecondsToTime } from "@/helpers/time";

interface StopStats {
  id: string;
  name: string;
  code: string | null;
  avg_delay_seconds: number;
  punctuality_percentage: number;
  observations: number;
  early_percentage: number;
  on_time_percentage: number;
  late_percentage: number;
  min_delay: number;
  max_delay: number;
}

interface RouteOption {
  id: string;
  shortName: string;
  longName: string;
  color: string | null;
}

export default function PonctualiteStopsPage() {
  const [stopStats, setStopStats] = useState<StopStats[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<keyof StopStats>("observations");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [timeframe, setTimeframe] = useState<"today" | "week">("today");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");

  // Récupérer la liste des lignes disponibles
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await fetch("/api/gtfs/routes");
        const data = await response.json();
        setRoutes(data);
      } catch (error) {
        console.error("Erreur lors de la récupération des lignes:", error);
      }
    };

    fetchRoutes();
  }, []);

  // Charger les statistiques par arrêt
  useEffect(() => {
    const fetchStopStats = async () => {
      setIsLoading(true);
      try {
        let url = `/api/gtfs/stop-metrics?timeframe=${timeframe}`;
        
        if (selectedRouteId) {
          url += `&routeId=${selectedRouteId}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        setStopStats(data);
      } catch (error) {
        console.error("Erreur lors de la récupération des statistiques par arrêt:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStopStats();
  }, [timeframe, selectedRouteId]);

  // Fonction pour trier les données
  const sortData = (field: keyof StopStats) => {
    if (sortBy === field) {
      // Inverser la direction si on clique sur la même colonne
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Nouvelle colonne, définir le tri par défaut
      setSortBy(field);
      setSortDirection("desc"); // Par défaut, tri descendant
    }
  };

  // Filtrer les arrêts par recherche
  const filteredStops = stopStats.filter(stop => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      stop.name.toLowerCase().includes(query) ||
      (stop.code && stop.code.toLowerCase().includes(query))
    );
  });

  // Trier les arrêts filtrés
  const sortedStops = [...filteredStops].sort((a, b) => {
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

  // Détermine la classe CSS pour la ponctualité
  const getPunctualityClass = (percentage: number) => {
    if (percentage >= 90) return styles.excellentPunctuality;
    if (percentage >= 80) return styles.goodPunctuality;
    if (percentage >= 70) return styles.averagePunctuality;
    if (percentage >= 60) return styles.poorPunctuality;
    return styles.badPunctuality;
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          <MapPin size={16} className={styles.titleIcon} />
          Ponctualité par arrêt
        </h3>
        <div className={styles.cardActions}>
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Rechercher un arrêt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button 
                className={styles.clearButton}
                onClick={() => setSearchQuery("")}
                aria-label="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          <select 
            className={styles.routeSelector}
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
          >
            <option value="">Toutes les lignes</option>
            {routes.map(route => (
              <option key={route.id} value={route.id}>
                {route.shortName} - {route.longName}
              </option>
            ))}
          </select>
          
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
        ) : sortedStops.length === 0 ? (
          <div className={styles.noData}>
            {searchQuery 
              ? "Aucun arrêt ne correspond à votre recherche" 
              : "Aucune donnée disponible pour cette période"}
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.sortableHeader} onClick={() => sortData("name")}>
                    <div className={styles.headerContent}>
                      Arrêt
                      {sortBy === "name" && (
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
                {sortedStops.map((stop) => (
                  <tr key={stop.id}>
                    <td className={styles.stopCell}>
                      <div className={styles.stopInfo}>
                        <span className={styles.stopName}>{stop.name}</span>
                        {stop.id && (
                          <span className={styles.stopCode}>{stop.id}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {formatSecondsToTime(stop.avg_delay_seconds)}
                    </td>
                    <td>
                      <div className={styles.punctualityWrapper}>
                        <span className={`${styles.punctualityValue} ${getPunctualityClass(stop.punctuality_percentage)}`}>
                          {Math.round(stop.punctuality_percentage)}%
                        </span>
                        <div className={styles.progressContainer}>
                          <div
                            className={styles.progressBar}
                            style={{
                              width: `${Math.min(100, Math.max(0, stop.punctuality_percentage))}%`,
                              backgroundColor: getPunctualityColor(stop.punctuality_percentage)
                            }}
                          ></div>
                        </div>
                        <div className={styles.detailedStats}>
                          <span className={styles.earlyStat} title="En avance">{Math.round(stop.early_percentage)}%</span>
                          <span className={styles.onTimeStat} title="À l'heure">{Math.round(stop.on_time_percentage)}%</span>
                          <span className={styles.lateStat} title="En retard">{Math.round(stop.late_percentage)}%</span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.observationsCell}>{stop.observations.toLocaleString()}</td>
                  </tr>
                ))}
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
  if (percentage >= 80) return "#84cc16"; // Vert-jaune
  if (percentage >= 70) return "#eab308"; // Jaune
  if (percentage >= 60) return "#f97316"; // Orange
  return "#ef4444"; // Rouge
}