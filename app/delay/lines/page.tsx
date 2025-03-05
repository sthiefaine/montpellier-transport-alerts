"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
} from "lucide-react";
import dynamic from "next/dynamic";
import DelayNav from "@/app/components/DelayStats/DelayNav";

// Composant pour la carte des lignes qui sera chargé dynamiquement
const LinePerformanceChart = dynamic(
  () => import("@/app/components/DelayStats/LinePerformanceChart"),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse h-64 w-full bg-gray-100 rounded"></div>
      </div>
    ),
  }
);

interface RoutePerformance {
  routeId: string;
  shortName: string;
  longName: string;
  color: string;
  avgDelay: number;
  onTimeRate: number;
  lateRate: number;
  earlyRate: number;
  totalObservations: number;
  timeline?: Array<{
    date: string;
    avgDelay: number;
    onTimeRate: number;
  }>;
}

export default function DelayLinesPage() {
  const [period, setPeriod] = useState("week");
  const [routeData, setRouteData] = useState<RoutePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/gtfs/delays/by-route?period=${period}`
        );
        const data = await response.json();

        if (Array.isArray(data)) {
          setRouteData(data);
          // Sélectionner la première ligne par défaut si aucune n'est sélectionnée
          if (!selectedRoute && data.length > 0) {
            setSelectedRoute(data[0].routeId);
          }
        } else {
          console.error("Format de données inattendu:", data);
          setRouteData([]);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
        setRouteData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  const handleExport = () => {
    // Fonction pour exporter les données en CSV
    if (!routeData.length) return;

    const headers =
      "Ligne,Nom,Retard moyen (sec),À l'heure (%),En retard (%),En avance (%),Observations\n";
    const csvData = routeData
      .map(
        (route) =>
          `${route.shortName},"${route.longName}",${route.avgDelay.toFixed(
            1
          )},${(route.onTimeRate * 100).toFixed(1)},${(
            route.lateRate * 100
          ).toFixed(1)},${(route.earlyRate * 100).toFixed(1)},${
            route.totalObservations
          }`
      )
      .join("\n");

    const csv = headers + csvData;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Créer un lien de téléchargement et cliquer dessus
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `performances-lignes-${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trouver les données de la ligne sélectionnée
  const selectedRouteData = selectedRoute
    ? routeData.find((route) => route.routeId === selectedRoute)
    : null;

  return (
    <div className="container mx-auto px-4 py-6">
      <header className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour à l'accueil
            </Link>

            <h1 className="text-2xl font-bold mt-2 mb-1">
              Performance par lignes
            </h1>
            <p className="text-gray-600">
              Analyse de la ponctualité pour chaque ligne du réseau
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex space-x-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="day">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">30 derniers jours</option>
            </select>

            <button
              onClick={handleExport}
              disabled={loading || !routeData.length}
              className="inline-flex items-center px-3 py-2 rounded-md bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-1" />
              Exporter
            </button>
          </div>
        </div>

        {/* Navigation du dashboard */}
        <div className="mt-6">
          <DelayNav />
        </div>
      </header>

      <main>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Chargement des données...</p>
            </div>
          </div>
        ) : !routeData.length ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">
              Aucune donnée de performance disponible pour les lignes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tableau des performances */}
            <div className="bg-white rounded-lg shadow lg:col-span-2">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium">
                  Classement des lignes par ponctualité
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Ligne
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Nom
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Retard moyen
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        À l'heure
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Observations
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Détails
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {routeData.map((route) => (
                      <tr
                        key={route.routeId}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedRoute === route.routeId ? "bg-blue-50" : ""
                        }`}
                        onClick={() => setSelectedRoute(route.routeId)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-2"
                              style={{ backgroundColor: route.color || "#ccc" }}
                            ></div>
                            <span className="font-medium">
                              {route.shortName}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 truncate max-w-[200px]">
                            {route.longName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            {route.avgDelay.toFixed(1)} sec
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div
                            className={`text-sm font-medium ${
                              route.onTimeRate > 0.8
                                ? "text-green-600"
                                : route.onTimeRate > 0.6
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {(route.onTimeRate * 100).toFixed(1)}%
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                route.onTimeRate > 0.8
                                  ? "bg-green-500"
                                  : route.onTimeRate > 0.6
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${route.onTimeRate * 100}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {route.totalObservations.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            onClick={() => setSelectedRoute(route.routeId)}
                          >
                            Voir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Détails d'une ligne */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium">Détails de la ligne</h2>
              </div>

              {selectedRouteData ? (
                <div className="p-4">
                  <div className="flex items-center mb-4">
                    <div
                      className="w-6 h-6 rounded-full mr-2"
                      style={{
                        backgroundColor: selectedRouteData.color || "#ccc",
                      }}
                    ></div>
                    <h3 className="text-xl font-bold">
                      {selectedRouteData.shortName}
                    </h3>
                  </div>

                  <div className="text-gray-700 mb-4">
                    {selectedRouteData.longName}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-500">Retard moyen</div>
                      <div className="text-xl font-bold">
                        {selectedRouteData.avgDelay.toFixed(1)} sec
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-500">À l'heure</div>
                      <div
                        className={`text-xl font-bold ${
                          selectedRouteData.onTimeRate > 0.8
                            ? "text-green-600"
                            : selectedRouteData.onTimeRate > 0.6
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {(selectedRouteData.onTimeRate * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-500">En retard</div>
                      <div className="text-xl font-bold text-red-600">
                        {(selectedRouteData.lateRate * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-500">En avance</div>
                      <div className="text-xl font-bold text-blue-600">
                        {(selectedRouteData.earlyRate * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {selectedRouteData.timeline &&
                    selectedRouteData.timeline.length > 0 && (
                      <div className="h-64 mt-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Évolution de la ponctualité
                        </h4>
                        <LinePerformanceChart
                          data={selectedRouteData.timeline}
                        />
                      </div>
                    )}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Sélectionnez une ligne pour voir ses détails
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-10 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
        <p>
          Les données présentées sont calculées à partir des passages en temps
          réel des véhicules.
        </p>
        <p className="mt-2">
          © {new Date().getFullYear()} Transport Montpellier
        </p>
      </footer>
    </div>
  );
}
