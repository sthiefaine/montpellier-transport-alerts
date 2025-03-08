"use server";
import React from "react";
import styles from "./page.module.css";
import Card from "@/components/Cards/Card";
import { AlertTriangle, Clock } from "lucide-react";
import TransportLinesIndicator from "../components/TransportLinesIndicator/TransportLinesIndicator";

async function getAlertStats() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/alerts/stats/summary`,
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

export default async function Home() {
  const stats = await getAlertStats();

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
            <p>Statistiques en temps réel des alertes</p>
          </div>

          <div className={styles.cardGrid}>

            <TransportLinesIndicator />

            <Card
              title="Alertes actives"
              value={stats.activeCount || 0}
              icon={<AlertTriangle size={24} />}
              color="red"
              href="/alertes" // Ajoute un lien vers la page des alertes
            />

            <Card
              title="Type le plus courant"
              value={mostCommonEffectType}
              icon={<Clock size={24} />}
              color="yellow"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
