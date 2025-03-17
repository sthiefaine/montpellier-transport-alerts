"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Filter,
  Calendar,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Alert } from "@/lib/types";
import styles from "./AlertsContainer.module.css";
import AlertCard from "./AlertCard";

export default function AlertsContainer() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "upcoming">("active");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "yesterday" | "week" | "month">("today");
  const [routeFilter, setRouteFilter] = useState<string>("");

  // Fetch alerts with the current filters
  const fetchAlerts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build the query params based on filters
      const params = new URLSearchParams();

      if (statusFilter === "active") {
        params.append("active", "true");
      } else if (statusFilter === "completed") {
        params.append("completed", "true");
      } else if (statusFilter === "upcoming") {
        params.append("upcoming", "true");
      }

      if (timeFilter !== "all") {
        params.append("timeFrame", timeFilter);
      }

      if (routeFilter) {
        params.append("route", routeFilter);
      }

      console.log("Fetching alerts with params:", params.toString());
      const response = await fetch(`/api/alerts?${params.toString()}`);

      if (!response.ok) {
        throw new Error(
          `Erreur lors de la récupération des alertes: ${response.status}`
        );
      }

      const alertsData = await response.json();
      setAlerts(alertsData);
    } catch (err) {
      console.error("Error fetching alerts:", err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch of alerts
  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, timeFilter, routeFilter]); // Re-fetch when any filter changes

  // Handle manual refresh
  const handleRefresh = () => {
    fetchAlerts();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.sectionTitle}>
          <AlertTriangle size={20} className={styles.icon} />
          <span>{alerts.length} alertes trouvées</span>
        </h2>

        <button
          onClick={handleRefresh}
          className={styles.refreshButton}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? styles.spinning : ""} />
          <span>{isLoading ? "Chargement..." : "Rafraîchir"}</span>
        </button>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>
            <Clock size={16} />
            <span>Statut:</span>
          </label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "completed" | "upcoming")
            }
            className={styles.select}
          >
            <option value="all">Toutes</option>
            <option value="active">En cours</option>
            <option value="upcoming">À venir</option>
            <option value="completed">Terminées</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>
            <Calendar size={16} />
            <span>Période:</span>
          </label>
          <select
            value={timeFilter}
            onChange={(e) =>
              setTimeFilter(
                e.target.value as "all" | "today" | "yesterday" | "week" | "month"
              )
            }
            className={styles.select}
          >
            <option value="all">Toutes dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="yesterday">Hier</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Chargement des alertes...</p>
        </div>
      ) : error ? (
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>{error}</p>
          <button className={styles.retryButton} onClick={handleRefresh}>
            Réessayer
          </button>
        </div>
      ) : alerts.length === 0 ? (
        <div className={styles.noAlerts}>
          <p>Aucune alerte ne correspond à vos critères de recherche.</p>
        </div>
      ) : (
        <div className={styles.alertsList}>
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} compact={false} />
          ))}
        </div>
      )}
    </div>
  );
}