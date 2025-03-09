"use server";
import React from "react";
import styles from "./page.module.css";
import Card from "@/components/Cards/Card";
import {
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Calendar,
  Clock,
  MapPin,
} from "lucide-react";
import TransportLinesIndicator from "../components/TransportLinesIndicator/TransportLinesIndicator";
import IncidentCalendar from "@/components/IncidentCalendar/IncidentCalendar";
import RealTimeDelayCard from "@/components/Cards/RealTimeDelay/RealTimeDelay";
import NextDepartures from "@/components/NextDepartures/NextDepartures";
import MiniNavCard from "@/components/Cards/MiniNavCard/MiniNavCard";

// Interface pour typer les données d'alertes (même chose qu'avant)
interface AlertStats {
  activeCount: number;
  completedCount: number;
  totalCount: number;
  effectCounts: Array<{
    effect: string;
    effectLabel: string;
    count: number;
  }>;
  causeCounts: Array<{
    cause: string;
    causeLabel: string;
    count: number;
  }>;
  topRoutes: Array<{
    routeIds: string;
    count: number;
  }>;
}

// Interface pour typer les données de retard (même chose qu'avant)
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
}

// Interface pour le type Decimal spécial (même chose qu'avant)
interface DecimalValue {
  d: number[]; // Tableau de digits ou [numerator, denominator]
  e: number; // Exposant
  s: number; // Signe (1 ou -1)
}

// Interface pour typer les données de retard par route
interface RouteDelay {
  route_number: string;
  route_name: string;
  avg_delay_seconds: DecimalValue | number; // Peut être un nombre ou un Decimal
  observations: number;
  punctuality_percentage: number;
  color: string;
}

async function getAlertStats(): Promise<AlertStats> {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      }/api/alerts/stats/summary`,
      {
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch alert stats");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching alert stats:", error);
    return {
      activeCount: 0,
      completedCount: 0,
      totalCount: 0,
      effectCounts: [],
      causeCounts: [],
      topRoutes: [],
    };
  }
}

async function getEnhancedDelayStats(): Promise<DelayStats> {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      }/api/gtfs/delays/enhanced-summary`,
      {
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch enhanced delay stats");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching enhanced delay stats:", error);
    return {
      avg_delay_seconds: 0,
      total_observations: 0,
      punctuality_rate: 0,
      late_rate: 0,
      early_rate: 0,
      max_delay_seconds: 0,
      avg_positive_delay: 0,
      avg_early_seconds: 0,
      positive_delay_count: 0,
      negative_delay_count: 0,
      on_time_exact_count: 0,
      positive_delay_percentage: "0.0",
      negative_delay_percentage: "0.0",
      on_time_exact_percentage: "0.0",
    };
  }
}

// Fonction pour récupérer les lignes avec les plus grands retards
async function getWorstRoutes(): Promise<RouteDelay[]> {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      }/api/gtfs/delays/by-route`,
      {
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch route delays");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching route delays:", error);
    return [];
  }
}

// Fonction améliorée pour extraire une valeur numérique d'un Decimal
function extractNumberFromDecimal(value: DecimalValue | number | any): number {
  let result: number;

  // Si c'est déjà un nombre, le retourner directement
  if (typeof value === "number") {
    result = value;
  }
  // Si c'est un objet Decimal avec les propriétés attendues
  else if (value && value.d && Array.isArray(value.d)) {
    // Pour ce format spécifique où d: [numerator, denominator]
    if (value.d.length === 2) {
      // C'est une fraction: numérateur/dénominateur
      result =
        (value.d[0] / value.d[1]) * Math.pow(10, value.e || 0) * (value.s || 1);
    } else if (value.d.length === 1) {
      // Si c'est un simple digit
      result = value.d[0] * Math.pow(10, value.e || 0) * (value.s || 1);
    } else {
      // Autre format, essayer la conversion simple
      result = Number(value) || 0;
    }
  } else {
    // Fallback: essayer de convertir en nombre, ou retourner 0
    result = Number(value) || 0;
  }

  // Vérifier si la valeur est dans une plage raisonnable
  // Limiter les retards/avances à ±3600 secondes (1 heure)
  // car au-delà, cela indique probablement une erreur de données
  const MAX_REASONABLE_DELAY = 3600; // 1 heure en secondes

  if (Math.abs(result) > MAX_REASONABLE_DELAY) {
    console.warn(
      `Valeur de retard aberrante détectée: ${result} secondes. Limitée à ±${MAX_REASONABLE_DELAY} secondes.`
    );
    result = Math.sign(result) * MAX_REASONABLE_DELAY;
  }

  return result;
}

// Nouvelle fonction pour formater les valeurs de retard/avance avec une précision appropriée
function formatTimeOffset(seconds: number): string {
  const absValue = Math.abs(seconds);
  const isAdvance = seconds < 0;

  if (absValue < 0.001) {
    // Microseconde (µs)
    return `${(absValue * 1000000).toFixed(2)} µs ${
      isAdvance ? "d'avance" : "de retard"
    }`;
  } else if (absValue < 1) {
    // Milliseconde (ms)
    return `${(absValue * 1000).toFixed(2)} ms ${
      isAdvance ? "d'avance" : "de retard"
    }`;
  } else if (absValue < 60) {
    // Secondes (s)
    return `${absValue.toFixed(2)} s ${isAdvance ? "d'avance" : "de retard"}`;
  } else {
    // Minutes et secondes
    const minutes = Math.floor(absValue / 60);
    const remainingSeconds = absValue % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s ${
      isAdvance ? "d'avance" : "de retard"
    }`;
  }
}

export default async function Home() {
  const stats = await getAlertStats();
  const delayStats = await getEnhancedDelayStats();
  const routeDelays = await getWorstRoutes();

  const processedRoutes = routeDelays
    .map((route) => {
      const delay = extractNumberFromDecimal(route.avg_delay_seconds);

      // Vérifier si la valeur est dans une plage raisonnable
      // Dans le contexte du transport public, ±30 minutes est déjà très généreux
      const MAX_REASONABLE_DELAY = 1800; // 30 minutes en secondes

      let processedDelay = delay;
      if (Math.abs(delay) > MAX_REASONABLE_DELAY) {
        console.warn(
          `Valeur aberrante détectée pour la ligne ${route.route_number}: ${delay} secondes`
        );
        // Limiter à la plage raisonnable
        processedDelay = Math.sign(delay) * MAX_REASONABLE_DELAY;
      }

      return {
        ...route,
        processedDelay,
        absDelay: Math.abs(processedDelay),
      };
    })
    // Filtrer les routes avec moins de 10 observations pour éviter les valeurs aberrantes basées sur peu de données
    .filter((route) => route.observations >= 10);

  // Trier par écart absolu (qu'il s'agisse d'avance ou de retard)
  processedRoutes.sort((a, b) => b.absDelay - a.absDelay);

  // Récupérer la ligne avec le plus grand écart, en vérifiant qu'il y a au moins une route valide
  const extremeRoute = processedRoutes.length > 0 ? processedRoutes[0] : null;
  const mostCommonEffectType =
    stats?.effectCounts?.length > 0
      ? stats.effectCounts[0].effectLabel
      : "Indisponible";

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <section className={styles.statsSection}>
          <div className={styles.statsHeader}>
            <h2>Vue d'ensemble</h2>
            <p>Statistiques en temps réel du réseau.</p>
          </div>

          <div className={styles.cardGrid}>
            <MiniNavCard
              title="Alertes"
              icon={<AlertTriangle size={24} />}
              href="/alertes"
              color="#ef4444" // Rouge
              count={stats.activeCount}
            />
            <MiniNavCard
              title="Départs"
              icon={<ArrowDown size={24} />}
              href="/departs"
              color="#3b82f6" // Bleu
            />
            <MiniNavCard
              title="Ponctualité"
              icon={<Clock size={24} />}
              href="/ponctualite"
              color="#f59e0b" // Orange
              count={`${delayStats.punctuality_rate}%`}
            />
            <MiniNavCard
              title="Statistiques"
              icon={<BarChart3 size={24} />}
              href="/stats"
              color="#8b5cf6" // Violet
            />
            <MiniNavCard
              title="Historique"
              icon={<Calendar size={24} />}
              href="/historique"
              color="#ec4899" // Rose
            />
            <TransportLinesIndicator />
            {/* Card détaillée pour les retards en temps réel */}
            <RealTimeDelayCard delayStats={delayStats} />
            <IncidentCalendar />
            {/* Afficher la ligne avec l'écart le plus extrême */}
            {extremeRoute && (
              <Card
                title={`Écart le plus extrême`}
                value={`${extremeRoute.route_number}: ${formatTimeOffset(
                  extremeRoute.processedDelay
                )}`}
                icon={<Clock size={24} />}
                color={extremeRoute.processedDelay < 0 ? "green" : "red"}
              />
            )}
            <div className={styles.fullWidthCard}>
              <NextDepartures stopId="1240" limit={5} />
            </div>{" "}
          </div>
        </section>
      </main>
    </div>
  );
}
