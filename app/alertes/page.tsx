"use server";
import React from "react";
import styles from "./page.module.css";
import { AlertTriangle, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import TransportLinesAlerts from "../../components/TransportLinesIndicator/TransportLinesIndicator";

async function getActiveAlerts() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/alerts/active`,
      {
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch active alerts");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching active alerts:", error);
    return [];
  }
}

interface Alert {
  id: string;
  timeStart: string;
  timeEnd: string | null;
  cause: string;
  effect: string;
  headerText: string;
  descriptionText: string;
  routeIds: string | null;
  stopIds: string | null;
}

export default async function AlertesPage() {
  const activeAlerts = await getActiveAlerts();

  // Formatter la date et l'heure
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Traduire les effets d'alerte
  const translateEffect = (effect: string) => {
    const effectMap: Record<string, string> = {
      "NO_SERVICE": "Service interrompu",
      "REDUCED_SERVICE": "Service réduit",
      "SIGNIFICANT_DELAYS": "Retards importants",
      "DETOUR": "Déviation",
      "ADDITIONAL_SERVICE": "Service supplémentaire",
      "MODIFIED_SERVICE": "Service modifié",
      "OTHER_EFFECT": "Autre effet",
      "UNKNOWN_EFFECT": "Effet inconnu",
      "STOP_MOVED": "Arrêt déplacé",
      "NO_EFFECT": "Aucun effet",
      "ACCESSIBILITY_ISSUE": "Problème d'accessibilité"
    };
    
    return effectMap[effect] || effect;
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={20} />
            <span>Retour à l'accueil</span>
          </Link>
          <h1 className={styles.title}>Alertes actives</h1>
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.transportLinesContainer}>
            <TransportLinesAlerts />
          </div>

          <div className={styles.alertsContainer}>
            <h2 className={styles.sectionTitle}>
              <AlertTriangle size={20} className={styles.icon} />
              <span>{activeAlerts.length} alertes en cours</span>
            </h2>

            {activeAlerts.length === 0 ? (
              <div className={styles.noAlerts}>
                <p>Aucune alerte en cours sur le réseau.</p>
              </div>
            ) : (
              <div className={styles.alertsList}>
                {activeAlerts.map((alert: Alert) => (
                  <div key={alert.id} className={styles.alertCard}>
                    <div className={styles.alertHeader}>
                      <div className={styles.alertEffect}>{translateEffect(alert.effect)}</div>
                      <div className={styles.alertTime}>
                        Depuis le {formatDate(alert.timeStart)}
                      </div>
                    </div>
                    <h3 className={styles.alertTitle}>{alert.headerText}</h3>
                    <div className={styles.alertDescription}>
                      {alert.descriptionText}
                    </div>
                    {alert.routeIds && (
                      <div className={styles.alertRoutes}>
                        <strong>Lignes affectées:</strong> {alert.routeIds.replace(/[,;|]/g, ', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}