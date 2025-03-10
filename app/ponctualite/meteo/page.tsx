"use client";

import { useState, useEffect } from "react";
import styles from "../page.module.css";
import { CloudRain } from "lucide-react";

interface Route {
  id: string;
  number: string;
  name?: string;
  color: string | null;
}

interface Weather {
  location: string;
  condition: string;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  isRain: boolean;
  isSnow: boolean;
  isFog: boolean;
  isStorm: boolean;
}

interface WeatherImpact {
  date: string;
  route: Route;
  weather: Weather;
  metrics: {
    avgDelay: number;
    onTimeRate: number;
    lateRate: number;
  };
  impact: {
    score: number;
    category: string;
    description: string;
  };
}

export default function PonctualiteWeatherPage() {
  const [weatherImpact, setWeatherImpact] = useState<WeatherImpact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Récupérer les impacts météo
        const weatherImpactResponse = await fetch(
          "/api/gtfs/weather/impact?minImpact=0.3"
        );
        const weatherImpactData = await weatherImpactResponse.json();
        setWeatherImpact(weatherImpactData?.impacts || []);
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
          Impact de la météo sur la ponctualité
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
              </div>
            ))}
          </div>
        ) : weatherImpact.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ligne</th>
                  <th>Conditions météo</th>
                  <th>Impact</th>
                  <th>Retard supplémentaire</th>
                </tr>
              </thead>
              <tbody>
                {weatherImpact.map((impact, index) => {
                  // S'assurer que toutes les valeurs sont des primitives
                  const date = String(impact.date || "");
                  const routeNumber = String(impact.route?.number || "");
                  const routeColor =
                    typeof impact.route?.color === "string"
                      ? impact.route.color
                      : "#ccc";
                  const weatherCondition = String(
                    impact.weather?.condition || "Inconnu"
                  );
                  const impactCategory = String(
                    impact.impact?.category || "Inconnu"
                  );

                  // Convertir les valeurs numériques
                  const avgDelay =
                    typeof impact.metrics?.avgDelay === "number"
                      ? impact.metrics.avgDelay
                      : 0;

                  // Déterminer le style pour la catégorie d'impact
                  let impactBadgeStyle = styles.badgeOutline;
                  if (
                    impactCategory === "Critique" ||
                    impactCategory === "Élevé"
                  ) {
                    impactBadgeStyle = styles.badgeDanger;
                  } else if (impactCategory === "Modéré") {
                    impactBadgeStyle = styles.badgeWarning;
                  }

                  return (
                    <tr key={index}>
                      <td>{date}</td>
                      <td className={styles.routeCell}>
                        <div
                          className={styles.routeColor}
                          style={{ backgroundColor: routeColor }}
                        ></div>
                        <span>{routeNumber}</span>
                      </td>
                      <td className={styles.weatherCell}>
                        <CloudRain className={styles.weatherIcon} />
                        <span>{weatherCondition}</span>
                      </td>
                      <td>
                        <span className={impactBadgeStyle}>
                          {impactCategory}
                        </span>
                      </td>
                      <td>
                        <span className={styles.badDelay}>
                          {Math.round(avgDelay)}s
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.noData}>
            <CloudRain size={48} />
            <p>Aucun impact météo significatif détecté récemment</p>
          </div>
        )}
      </div>
    </div>
  );
}
