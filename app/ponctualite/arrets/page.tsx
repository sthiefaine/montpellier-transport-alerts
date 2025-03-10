"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.css";
import { Bus } from "lucide-react";

interface Stop {
  id: string;
  name: string;
  code: string;
  location?: {
    lat: number;
    lon: number;
  };
}

interface Route {
  id: string;
  number: string;
  name?: string;
  color: string | null;
}

interface StopMetrics {
  stop: Stop;
  route: Route;
  avgDelay: number;
  maxDelay: number;
  onTimeRate: number;
  lateRate: number;
  observations: number;
}

export default function PonctualiteStopsPage() {
  const [worstStops, setWorstStops] = useState<StopMetrics[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Récupérer les pires arrêts
        const worstStopsResponse = await fetch(
          "/api/gtfs/metrics/worst-stops?limit=20"
        );
        const worstStopsData = await worstStopsResponse.json();
        setWorstStops(worstStopsData);
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          Arrêts avec les plus grands retards
        </h3>
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
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Arrêt</th>
                  <th>Ligne</th>
                  <th>Retard moyen</th>
                  <th>Ponctualité</th>
                </tr>
              </thead>
              <tbody>
                {worstStops.map((stop, index) => {
                  // S'assurer que toutes les valeurs sont des primitives
                  const stopName = String(stop.stop?.name || "");
                  const stopCode = String(stop.stop?.code || "");
                  const routeNumber = String(stop.route?.number || "");
                  const routeColor =
                    typeof stop.route?.color === "string"
                      ? stop.route.color
                      : "#ccc";

                  // Convertir les métriques en nombres
                  const avgDelay =
                    typeof stop.avgDelay === "number" ? stop.avgDelay : 0;
                  const onTimeRate =
                    typeof stop.onTimeRate === "number" ? stop.onTimeRate : 0;

                  // Formater pour l'affichage
                  const onTimePercentage = Math.round(onTimeRate * 100);

                  return (
                    <tr
                      key={`${index}-${stop.stop?.id || ""}-${
                        stop.route?.id || ""
                      }`}
                    >
                      <td className={styles.stopCell}>
                        <Bus className={styles.stopIcon} />
                        <span>{stopName}</span>
                        <span className={styles.stopCode}>{stopCode}</span>
                      </td>
                      <td className={styles.routeCell}>
                        <div
                          className={styles.routeColor}
                          style={{ backgroundColor: routeColor }}
                        ></div>
                        <span>{routeNumber}</span>
                      </td>
                      <td>
                        <span className={styles.badDelay}>
                          {Math.round(avgDelay)}s
                        </span>
                      </td>
                      <td>
                        <div className={styles.punctualityWrapper}>
                          <span>{onTimePercentage}%</span>
                          <div className={styles.progressContainer}>
                            <div
                              className={styles.progressBar}
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, onTimePercentage)
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
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
