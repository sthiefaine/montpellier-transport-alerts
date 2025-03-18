"use server";
import React from "react";
import styles from "./page.module.css";
import { AlertTriangle, ArrowDown, BarChart3, Clock } from "lucide-react";
import IncidentCalendar from "@/components/IncidentCalendar/IncidentCalendar";
import MiniNavCard from "@/components/Cards/MiniNavCard/MiniNavCard";
import TransportLinesIndicator from "@/components/TransportLinesIndicator/TransportLinesIndicator";
import { getAlertStats } from "./actions/alerts/alerts.action";
import { getEnhancedDelayStats } from "./actions/delay/delay.action";

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
