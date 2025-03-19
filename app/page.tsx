"use server";
import React from "react";
import styles from "./page.module.css";
import { AlertTriangle, ArrowDown, BarChart3, Clock } from "lucide-react";
import IncidentCalendar from "@/components/IncidentCalendar/IncidentCalendar";
import MiniNavCard from "@/components/Cards/MiniNavCard/MiniNavCard";
import TransportLinesIndicator from "@/components/TransportLinesIndicator/TransportLinesIndicator";

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

async function getAlertStats(): Promise<AlertStats> {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      }/api/alerts/stats/summary`,
      {
        next: { tags: ["alerts"] },
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

export default async function Home() {
  const stats = await getAlertStats();
  const delayStats = await getEnhancedDelayStats();

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <section className={styles.statsSection}>
          <div className={styles.statsHeader}>
            <h2>Vue d'ensemble</h2>
          </div>

          <div className={styles.cardGrid}>
            <MiniNavCard
              title="Alertes"
              icon={<AlertTriangle size={24} />}
              href="/alertes"
              color="#ef4444"
              count={stats.activeCount}
            />
            <MiniNavCard
              title="Départs"
              icon={<ArrowDown size={24} />}
              href="/departs"
              color="#3b82f6"
            />
            <MiniNavCard
              title="Ponctualité"
              icon={<Clock size={24} />}
              href="/ponctualite"
              color="#f59e0b"
              count={`${delayStats.punctuality_rate}%`}
            />
            <MiniNavCard
              title="Statistiques"
              icon={<BarChart3 size={24} />}
              href="/stats"
              color="#8b5cf6"
            />

            <IncidentCalendar />
            <TransportLinesIndicator />
          </div>
        </section>
      </main>
    </div>
  );
}
