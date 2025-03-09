"use client";

import { MapPin } from "lucide-react";
import styles from "./DeparturesFinder.module.css";

interface Stop {
  id: string;
  name: string;
  code?: string | null;
  lat?: number;
  lon?: number;
}

interface StopSelectorProps {
  stops: Stop[];
  selectedStop: Stop | null;
  onSelectStop: (stop: Stop) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  label?: string;
}

export default function StopSelector({
  stops,
  selectedStop,
  onSelectStop,
  isLoading = false,
  emptyMessage = "Aucun arrêt disponible",
  label = "Arrêts",
}: StopSelectorProps) {
  return (
    <div className={styles.stopSelectorContainer}>
      {label && <h3 className={styles.sectionTitle}>{label}</h3>}

      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Chargement des arrêts...</p>
        </div>
      ) : stops.length > 0 ? (
        <div className={styles.stopsList}>
          {stops.map((stop) => (
            <button
              key={stop.id}
              className={`${styles.stopButton} ${
                selectedStop?.id === stop.id ? styles.selectedStop : ""
              }`}
              onClick={() => onSelectStop(stop)}
            >
              <MapPin size={16} className={styles.stopIcon} />
              <div className={styles.stopInfo}>
                <span className={styles.stopName}>{stop.name}</span>
                {stop.code && (
                  <span className={styles.stopCode}>Code: {stop.code}</span>
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
