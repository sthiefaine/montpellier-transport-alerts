import {
  AlertCircle,
  AlertTriangle,
  Info,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { Alert } from "@/lib/types";
import {
  formatDate,
  getAlertCauseLabel,
  getAlertEffectLabel,
} from "@/lib/utils";
import styles from "./AlertCard.module.css";
import { useTramLines } from "@/services/tramLinesService";

interface AlertCardProps {
  alert: Alert;
  compact?: boolean;
}

export default function AlertCard({ alert, compact = false }: AlertCardProps) {
  const now = new Date();
  const timeEndDate = alert.timeEnd ? new Date(alert.timeEnd) : null;
  const isActive = timeEndDate === null || timeEndDate >= now;

  // Get tram lines data to display proper colors/info
  const { tramLinesData } = useTramLines();

  // Format the affected route ids
  const affectedRoutes = alert.routeIds
    ? alert.routeIds
        .split(/[,;|]/)
        .map((id) => id.trim())
        .filter((id) => id)
    : [];

  // Get color and details for each affected line
  const routeDetails = affectedRoutes.map((routeId) => {

    const cleanId = routeId.includes("-") ? routeId.substring(2) : routeId;

    // Try to find the line in the tram lines data
    const lineInfo = tramLinesData?.features?.find(
      (line) =>
        line.properties.num_exploitation.toString() === routeId ||
        line.properties.id_lignes_sens === routeId
    );

    // Determine the type of transport
    let type = "bus"; // Default type
    if (lineInfo) {
      if (lineInfo.properties.mode === "tramway") {
        type = "tram";
      } else if (lineInfo.properties.nom_ligne.includes("Navette")) {
        type = "navette";
      }
    }

    // Get the line name which might be useful for tooltips or accessibility
    const lineName = lineInfo?.properties?.nom_ligne || cleanId;

    return {
      id: cleanId,
      originalId: routeId,
      color: lineInfo?.properties?.code_couleur || "#6B7280", // Default gray if color not found
      textColor: "#FFFFFF",
      name: lineName,
      type,
    };
  });

  return (
    <div
      className={`${styles.alertCard} ${
        isActive ? styles.activeAlert : styles.completedAlert
      }`}
    >
      <div className={styles.cardHeader}>
        {/* Line badges */}
        <div className={styles.lineBadgesContainer}>
          {routeDetails.map((route) => {
            // Determine the appropriate badge style based on type
            let badgeClass;
            if (route.type === "tram") {
              badgeClass = styles.tramBadge;
            } else if (route.type === "navette") {
              badgeClass = styles.navetteBadge;
            } else if (route.name.includes("Rés")) {
              badgeClass = styles.resaTamBadge;
            } else {
              badgeClass = styles.busBadge;
            }

            return (
              <div
                key={route.originalId}
                className={`${styles.transportBadge} ${badgeClass}`}
                style={{
                  backgroundColor: route.color,
                  color: isLightColor(route.color) ? "#000" : "#fff",
                }}
                title={route.name} // Add tooltip with full name
              >
                {route.id}
              </div>
            );
          })}
        </div>

        {/* Status indicator */}
        <div className={styles.statusBadge}>
          {isActive ? (
            <span className={styles.activeStatus}>
              <AlertCircle size={12} />
              Active
            </span>
          ) : (
            <span className={styles.completedStatus}>
              <CheckCircle size={12} />
              Terminée
            </span>
          )}
        </div>
      </div>

      <div className={styles.alertDescription}>{alert.descriptionText}</div>

      <div className={styles.metaContainer}>
        <div className={styles.metaRow}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>
              <Calendar size={14} />
              Début:
            </span>
            <span className={styles.metaValue}>
              {formatDate(alert.timeStart as string)}
            </span>
          </div>

          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>
              <Calendar size={14} />
              Fin:
            </span>
            <span className={styles.metaValue}>
              {formatDate(alert.timeEnd as string)}
            </span>
          </div>
        </div>

        <div className={styles.metaRow}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>
              <Info size={14} />
              Cause:
            </span>
            <span className={styles.metaValue}>
              {getAlertCauseLabel(alert.cause as any)}
            </span>
          </div>

          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>
              <AlertTriangle size={14} />
              Effet:
            </span>
            <span className={styles.metaValue}>
              {getAlertEffectLabel(alert.effect as any)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to determine if a color is light or dark
function isLightColor(color: string): boolean {
  // Remove the hash if it exists
  const hex = color.replace("#", "");

  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;

  // Calculate brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Return true if the color is light
  return brightness > 155;
}
