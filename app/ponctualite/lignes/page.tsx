"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.css";

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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Récupérer les statistiques par route
        const routeStatsResponse = await fetch("/api/gtfs/delays/by-route");
        const routeStatsData = await routeStatsResponse.json();
        setRouteStats(routeStatsData);
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
        <h3 className={styles.cardTitle}>Ponctualité par ligne</h3>
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
                  <th>Ligne</th>
                  <th>Retard moyen</th>
                  <th>Ponctualité</th>
                  <th>Observations</th>
                </tr>
              </thead>
              <tbody>
                {routeStats.map((route) => {
                  // Assurons-nous que toutes les valeurs sont des primitives
                  const routeNumber = String(route.route_number || "");
                  const routeName = String(route.route_name || "");
                  const color =
                    typeof route.color === "string" ? route.color : "#ccc";

                  // Convertir les valeurs numériques en nombre, avec fallback à 0
                  const avgDelay =
                    typeof route.avg_delay_seconds === "number"
                      ? route.avg_delay_seconds
                      : 0;

                  const punctuality =
                    typeof route.punctuality_percentage === "number"
                      ? route.punctuality_percentage
                      : 0;

                  const observations =
                    typeof route.observations === "number"
                      ? route.observations
                      : 0;

                  // Déterminer le style du retard
                  let delayStyle = styles.goodDelay;
                  if (avgDelay > 60) {
                    delayStyle = styles.badDelay;
                  } else if (avgDelay > 30) {
                    delayStyle = styles.mediumDelay;
                  }

                  // Formater les observations
                  const formattedObservations = observations.toLocaleString();

                  return (
                    <tr key={routeNumber || `route-${Math.random()}`}>
                      <td className={styles.routeCell}>
                        <div
                          className={styles.routeColor}
                          style={{ backgroundColor: color }}
                        ></div>
                        <span>{routeNumber}</span>
                        <span className={styles.routeName}>{routeName}</span>
                      </td>
                      <td>
                        <span className={delayStyle}>
                          {Math.round(avgDelay)}s
                        </span>
                      </td>
                      <td>
                        <div className={styles.punctualityWrapper}>
                          <span>{Math.round(punctuality)}%</span>
                          <div className={styles.progressContainer}>
                            <div
                              className={styles.progressBar}
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, punctuality)
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>{formattedObservations}</td>
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
