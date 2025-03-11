"use client";

import { MapPin, Star } from "lucide-react";
import styles from "./DeparturesFinder.module.css";

interface Stop {
  id: string;
  name: string;
  code?: string | null;
  lat?: number;
  lon?: number;
  position?: number;
  isTerminus?: boolean;
  directionId?: number;
}

interface StopSelectorProps {
  stops: Stop[];
  selectedStop: Stop | null;
  onSelectStop: (stop: Stop) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  label?: string;
  selectedDirection?: number | null;
}

export default function StopSelector({
  stops,
  selectedStop,
  onSelectStop,
  isLoading = false,
  emptyMessage = "Aucun arrêt disponible",
  label = "Arrêts",
  selectedDirection,
}: StopSelectorProps) {
  // Filtrer les arrêts par direction si nécessaire et une direction est sélectionnée
  const filteredStops = selectedDirection !== null && selectedDirection !== undefined
    ? stops.filter(stop => {
        // Si l'arrêt n'a pas de directionId défini, l'inclure par défaut
        if (stop.directionId === undefined) return true;
        // Sinon vérifier si la direction correspond
        return stop.directionId === selectedDirection;
      })
    : stops;

  // Dédupliquer les arrêts par ID pour éviter les doublons
  const uniqueStopsMap = new Map();
  filteredStops.forEach(stop => {
    // Si l'arrêt est un terminus, il a priorité sur les versions non-terminus
    if (!uniqueStopsMap.has(stop.id) || stop.isTerminus) {
      uniqueStopsMap.set(stop.id, stop);
    }
  });
  
  const uniqueStops = Array.from(uniqueStopsMap.values());

  // Regrouper les arrêts par terminus/non-terminus pour l'affichage
  const terminusStops = uniqueStops.filter(stop => stop.isTerminus === true);
  const regularStops = uniqueStops.filter(stop => stop.isTerminus !== true);
  
  // Trier les arrêts non-terminus par position ou par nom
  const sortedRegularStops = regularStops.sort((a, b) => {
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    return a.name.localeCompare(b.name);
  });
  
  // Grouper tous les arrêts: d'abord les terminus, puis les arrêts réguliers
  const groupedStops = [...terminusStops, ...sortedRegularStops];

  console.log(`Displaying ${groupedStops.length} stops (${terminusStops.length} terminus, ${regularStops.length} regular)`);
  
  return (
    <div className={styles.stopSelectorContainer}>
      {label && <h3 className={styles.sectionTitle}>{label}</h3>}

      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Chargement des arrêts...</p>
        </div>
      ) : groupedStops.length > 0 ? (
        <div className={styles.stopsList}>
          {groupedStops.map((stop) => (
            <button
              // Utiliser une clé composite pour garantir l'unicité
              key={`${stop.id}-${stop.directionId || 'nodirection'}-${stop.isTerminus ? 'terminus' : 'regular'}`}
              className={`${styles.stopButton} ${
                selectedStop?.id === stop.id ? styles.selectedStop : ""
              } ${stop.isTerminus ? styles.terminusStop : ""}`}
              onClick={() => onSelectStop(stop)}
            >
              {stop.isTerminus ? (
                <Star size={16} className={`${styles.stopIcon} ${styles.terminusIcon}`} />
              ) : (
                <MapPin size={16} className={styles.stopIcon} />
              )}
              <div className={styles.stopInfo}>
                <span className={styles.stopName}>
                  {stop.name}
                  {stop.isTerminus && <span className={styles.terminusBadge}>Terminus</span>}
                </span>
                {stop.code && (
                  <span className={styles.stopCode}>ID: {stop.id}</span>
                )}
                {stop.position !== undefined && stop.directionId !== undefined && (
                  <span className={styles.stopPosition}>
                    {stop.directionId === 0 ? "Aller" : "Retour"} • Position: {stop.position}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <MapPin size={24} />
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}