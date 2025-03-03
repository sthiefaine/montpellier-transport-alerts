import { useState, useEffect } from "react";
import useSWR from "swr";
import AlertCard from "./AlertCard";
import { Alert, AlertFilters } from "@/lib/types";

interface AlertListProps {
  showOnlyActive?: boolean;
  routeFilter?: string;
  stopFilter?: string;
  maxItems?: number;
  compact?: boolean;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AlertList({
  showOnlyActive = false,
  routeFilter,
  stopFilter,
  maxItems,
  compact = false,
}: AlertListProps) {
  // Construire l'URL avec les paramètres de filtre
  const getApiUrl = () => {
    const params = new URLSearchParams();
    if (showOnlyActive) params.append("active", "true");
    if (routeFilter) params.append("route", routeFilter);
    if (stopFilter) params.append("stop", stopFilter);

    return `/api/alerts?${params.toString()}`;
  };

  const { data, error, isLoading } = useSWR<Alert[]>(getApiUrl, fetcher, {
    refreshInterval: 5 * 60 * 1000, // Rafraîchir toutes les 5 minutes
  });

  // Limiter le nombre d'alertes si maxItems est défini
  const alerts = maxItems && data ? data.slice(0, maxItems) : data;

  if (isLoading) {
    return <div className="text-center py-8">Chargement des alertes...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Erreur lors du chargement des alertes. Veuillez réessayer plus tard.
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucune alerte {showOnlyActive ? "active " : ""}trouvée.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} compact={compact} />
      ))}
    </div>
  );
}
