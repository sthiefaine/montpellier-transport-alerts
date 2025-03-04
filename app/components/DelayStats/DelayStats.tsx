// components/DelayStats.tsx
import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import axios from "axios";

const COLORS = ["#00C49F", "#FF8042", "#FFBB28"];

export default function DelayStats() {
  const [summary, setSummary] = useState<any>(null);
  const [routeDelays, setRouteDelays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [summaryRes, routesRes] = await Promise.all([
          axios.get("/api/gtfs/delays/summary"),
          axios.get("/api/gtfs/delays/by-route"),
        ]);

        setSummary(summaryRes.data);
        setRouteDelays(routesRes.data);
      } catch (err) {
        console.error(
          "Erreur lors du chargement des statistiques de retard:",
          err
        );
        setError("Impossible de charger les statistiques de retard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Rafraîchir toutes les 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold mb-2">Ponctualité du réseau</h3>
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold mb-2">Ponctualité du réseau</h3>
        <div className="text-center text-red-500 py-10">
          {error || "Aucune donnée disponible"}
        </div>
      </div>
    );
  }

  // Créer les données pour le graphique camembert de ponctualité
  const punctualityData = [
    { name: "À l'heure", value: summary.punctuality_rate || 0 },
    { name: "En retard", value: summary.late_rate || 0 },
    { name: "En avance", value: summary.early_rate || 0 },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-bold mb-4">Ponctualité du réseau</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Graphique de ponctualité */}
        <div>
          <div className="text-xs text-center mb-2 font-medium">
            Répartition de la ponctualité (24h)
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={punctualityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {punctualityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Statistiques clés */}
        <div className="flex flex-col justify-center">
          <div className="text-xs font-medium mb-2">
            Indicateurs de ponctualité
          </div>

          <div className="bg-gray-50 rounded p-2 mb-2">
            <div className="text-xs text-gray-600">Retard moyen</div>
            <div className="text-xl font-bold">
              {summary.avg_delay_seconds < 60
                ? `${summary.avg_delay_seconds} sec`
                : `${Math.round(summary.avg_delay_seconds / 60)} min`}
            </div>
          </div>

          <div className="bg-gray-50 rounded p-2 mb-2">
            <div className="text-xs text-gray-600">Retard maximum observé</div>
            <div className="text-xl font-bold">
              {Math.round(summary.max_delay_seconds / 60)} min
            </div>
          </div>

          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-600">Observations</div>
            <div className="text-xl font-bold">
              {summary.total_observations.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Graphique des retards par ligne */}
      {routeDelays.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-2">
            Retard moyen par ligne (en secondes)
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routeDelays.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="route_number" />
                <YAxis unit="s" />
                <Tooltip
                  formatter={(value) => [`${value} secondes`, "Retard moyen"]}
                  labelFormatter={(value) => `Ligne ${value}`}
                />
                <Legend />
                <Bar
                  dataKey="avg_delay_seconds"
                  name="Retard moyen"
                  fill="#0088FE"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
