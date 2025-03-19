"use server";
import React from "react";
import { Bell } from "lucide-react";
import tramLinesData from "@/data/transport-lines.json";
import styles from "./TransportLinesIndicator.module.css";
import { apiFetch } from "@/lib/api-fetch";

interface Alert {
  id: string;
  routeIds: string | null;
  [key: string]: any;
}

interface TransportLinesAlertsProps {
  className?: string;
}

const getAlerts = async () => {
  try {
    const response = await apiFetch(`/api/alerts/active`, {
      next: { tags: ["alerts"] },
    });

    return await response
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes:", error);
    return [];
  }
};

const TransportLinesAlerts = async ({
  className = "",
}: TransportLinesAlertsProps) => {
  const activeAlerts: Alert[] = (await getAlerts()) || [];

  const lineAlertsMap: Record<string, boolean> = {};

  if (activeAlerts && activeAlerts.length > 0) {
    activeAlerts.forEach((alert) => {
      if (alert.routeIds) {
        const routeIds = alert.routeIds
          .split(/[,;|]/)
          .map((route) => {
            const trimmedRoute = route.trim();
            // Transformer les identifiants "7-X", "8-X" en "X"
            if (trimmedRoute.includes("-")) {
              return trimmedRoute.substring(2);
            }
            return trimmedRoute;
          })
          .filter((route) => route.length > 0);

        routeIds.forEach((route) => {
          lineAlertsMap[route] = true;
        });
      }
    });
  }

  // Identifier les IDs des navettes
  const navetteIds = tramLinesData
    .filter(
      (line) =>
        line.type.includes("navette") ||
        ["50", "91", "95", "96", "93"].includes(line.id.toString())
    )
    .map((line) => line.id);

  // Grouper les lignes par type
  const tramways = tramLinesData.filter((line) => line.type === "tramway");
  // Exclure les navettes des bus
  const buses = tramLinesData.filter(
    (line) => line.type === "bus" && !navetteIds.includes(line.id)
  );
  const autobus = tramLinesData.filter((line) => line.type === "autobus");
  const navettes = tramLinesData.filter(
    (line) =>
      line.type.includes("navette") ||
      ["50", "91", "95", "96", "93"].includes(line.id.toString())
  );

  // Couleur par défaut (couleur de la ligne 1)
  const defaultColor = "#005CA9";

  // Vérifier si une ligne a une alerte
  const hasAlert = (line: any) => {
    const commercialId = line.numero;
    const name = line.ligne_param?.name;

    // Vérifier si l'ID commercial correspond directement
    if (commercialId && lineAlertsMap[commercialId]) {
      return true;
    }

    // Vérifier si le nom de la ligne correspond (pour les cas où le nom est un nombre)
    if (name && !isNaN(Number(name)) && lineAlertsMap[name]) {
      return true;
    }

    return false;
  };

  // Filtrer les lignes pour ne garder que celles avec des alertes (utilisé pour les compteurs)
  const alertedTramways = tramways.filter(hasAlert);
  const alertedBuses = buses.filter(hasAlert);
  const alertedAutobus = autobus.filter(hasAlert);
  const alertedNavettes = navettes.filter(hasAlert);

  // Calculer le nombre total de lignes ayant des alertes
  const totalAlertedLines =
    alertedTramways.length +
    alertedBuses.length +
    alertedAutobus.length +
    alertedNavettes.length;

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Réseau de transport</h3>
        {totalAlertedLines > 0 && (
          <div className="relative">
            <Bell size={20} className={styles.bellIcon} />
            <span className={styles.alertIndicator}>{totalAlertedLines}</span>
          </div>
        )}
      </div>

      {/* Section Tramways */}
      {tramways.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Tramways</span>
          </div>
          <div className={styles.linesContainer}>
            {tramways.map((line) => {
              const lineColor =
                line.ligne_param.ligneBackgroundColor === "#"
                  ? defaultColor
                  : `#${line.ligne_param.ligneBackgroundColor}`;
              const textColor =
                line.ligne_param.ligneTextColor === "#"
                  ? "#FFFFFF"
                  : `#${line.ligne_param.ligneTextColor}`;
              const hasIssue = hasAlert(line);

              return (
                <div key={line.id} className={styles.badgeContainer}>
                  <div
                    className={`${styles.badge} ${styles.tramBadge}`}
                    style={{
                      color: textColor,
                      backgroundColor: lineColor,
                    }}
                  >
                    {line.ligne_param.name}
                  </div>
                  {hasIssue && <div className={styles.alertIndicator}>!</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section Bus */}
      {buses.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Bus</span>
          </div>
          <div className={styles.linesContainer}>
            {buses.map((line) => {
              const lineColor =
                line.ligne_param.ligneBackgroundColor === "#"
                  ? defaultColor
                  : `#${line.ligne_param.ligneBackgroundColor}`;
              const textColor =
                line.ligne_param.ligneTextColor === "#"
                  ? "#FFFFFF"
                  : `#${line.ligne_param.ligneTextColor}`;
              const hasIssue = hasAlert(line);

              return (
                <div key={line.id} className={styles.badgeContainer}>
                  <div
                    className={`${styles.badge} ${styles.busBadge}`}
                    style={{
                      color: textColor,
                      backgroundColor: lineColor,
                    }}
                  >
                    {line.ligne_param.name === "Navette"
                      ? "N"
                      : line.ligne_param.name}
                  </div>
                  {hasIssue && <div className={styles.alertIndicator}>!</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section Autobus/ResaTam */}
      {autobus.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>ResaTam</span>
          </div>
          <div className={styles.linesContainer}>
            {autobus.map((line) => {
              const lineColor =
                line.ligne_param.ligneBackgroundColor === "#"
                  ? defaultColor
                  : `#${line.ligne_param.ligneBackgroundColor}`;
              const textColor =
                line.ligne_param.ligneTextColor === "#"
                  ? "#FFFFFF"
                  : `#${line.ligne_param.ligneTextColor}`;
              const hasIssue = hasAlert(line);

              return (
                <div key={line.id} className={styles.badgeContainer}>
                  <div
                    className={`${styles.badge} ${styles.resaTamBadge}`}
                    style={{
                      color: textColor,
                      backgroundColor: lineColor,
                    }}
                  >
                    {line.ligne_param.name}
                  </div>
                  {hasIssue && <div className={styles.alertIndicator}>!</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section Navettes */}
      {navettes.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Navettes</span>
          </div>
          <div className={styles.navettesGrid}>
            {navettes.map((line) => {
              const lineColor =
                line.ligne_param.ligneBackgroundColor === "#"
                  ? defaultColor
                  : `#${line.ligne_param.ligneBackgroundColor}`;
              const textColor =
                line.ligne_param.ligneTextColor === "#"
                  ? "#FFFFFF"
                  : `#${line.ligne_param.ligneTextColor}`;
              const displayName = line.ligne_param.name;
              const hasIssue = hasAlert(line);

              return (
                <div key={line.id} className={styles.badgeContainer}>
                  <div
                    className={`${styles.badge} ${styles.navetteBadge}`}
                    style={{
                      color: textColor,
                      backgroundColor: lineColor,
                    }}
                  >
                    {displayName}
                  </div>
                  {hasIssue && <div className={styles.alertIndicator}>!</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportLinesAlerts;
