import { SetStateAction, useState } from "react";
import useSWR from "swr";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  History,
} from "lucide-react";
import { AlertStats, AlertEffect } from "@/lib/types";
import { getAlertEffectLabel } from "@/lib/utils";
import IncidentCalendar from "./IncidentCalendar";
import TramMap from "./TramMap";
import { useTramLines } from "@/services/tramLinesService";
import TramLineSummary from "./Summary/TramLine";

const COLORS = [
  "#FF0000",
  "#FF6B00",
  "#FFB800",
  "#FFE400",
  "#A0C800",
  "#00C80A",
  "#00C1C8",
  "#0092C8",
  "#0056C8",
  "#5700C8",
  "#A800C8",
  "#C8006B",
];

const fetcher = async (url: string) => {
  console.log(`Fetching data from: ${url} at`, new Date().toLocaleTimeString());
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur lors du fetch");
  return res.json();
};

const StatCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow p-3 animate-pulse">
    <div className="flex items-center">
      <div className="w-5 h-5 bg-gray-200 rounded-full mr-2 flex-shrink-0"></div>
      <div className="w-full">
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
      </div>
    </div>
  </div>
);

const ChartSkeleton = ({ title }: { title: string }) => (
  <div className="bg-white rounded-lg shadow p-3">
    <h3 className="text-sm font-bold mb-2">{title}</h3>
    <div className="h-80 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-32 h-32 bg-gray-200 rounded-full mb-4"></div>
        <div className="w-48 h-3 bg-gray-200 rounded mb-2"></div>
        <div className="w-40 h-3 bg-gray-200 rounded mb-2"></div>
        <div className="w-36 h-3 bg-gray-200 rounded"></div>
      </div>
    </div>
  </div>
);

const TableSkeleton = ({ title }: { title: string }) => (
  <div className="bg-white rounded-lg shadow p-3">
    <h3 className="text-sm font-bold mb-2">{title}</h3>
    <div className="animate-pulse">
      <div className="h-8 bg-gray-100 w-full mb-2"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-6 bg-gray-200 w-full mb-2"></div>
      ))}
    </div>
  </div>
);

const MapSkeleton = () => (
  <div className="bg-white rounded-lg shadow p-3">
    <h3 className="text-sm font-bold mb-2">Carte du réseau de tramway</h3>
    <div className="h-[400px] bg-gray-100 rounded animate-pulse flex items-center justify-center">
      <div className="text-gray-400">Chargement de la carte...</div>
    </div>
  </div>
);

const CalendarSkeleton = () => (
  <div className="bg-white rounded-lg shadow p-3">
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 w-1/4 mb-4"></div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-6 bg-gray-200 rounded"></div>
        ))}
      </div>
      {[...Array(5)].map((_, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
          {[...Array(7)].map((_, dayIndex) => (
            <div key={dayIndex} className="h-10 bg-gray-100 rounded"></div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

type DashboardProps = {
  setActiveTab: (
    value: SetStateAction<"activeAlerts" | "dashboard" | "completedAlerts">
  ) => void;
};

export default function Dashboard({ setActiveTab }: DashboardProps) {
  const [showAllStats, setShowAllStats] = useState<boolean>(true);

  const {
    tramLinesData,
    isLoading: tramLinesLoading,
    error: tramLinesError,
  } = useTramLines();

  const statsUrl = showAllStats
    ? "/api/alerts/stats/summary?includeAll=true"
    : "/api/alerts/stats/summary";

  const {
    data: stats,
    error,
    isLoading,
    mutate,
  } = useSWR<AlertStats>(statsUrl, fetcher, {
    refreshInterval: 2 * 60 * 1000,
    revalidateOnMount: true,
  });

  const handleRefresh = () => {
    mutate();
  };

  const effectData =
    !isLoading && stats?.effectCounts && Array.isArray(stats.effectCounts)
      ? stats.effectCounts.map((item, index) => ({
          name: getAlertEffectLabel(item.effect as AlertEffect),
          value: item.count,
          color: COLORS[index % COLORS.length],
        }))
      : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2 ">
          <button
            className={`px-3 py-1 rounded-md text-sm cursor-pointer ${
              !showAllStats
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => setShowAllStats(false)}
            disabled={isLoading}
          >
            Alertes actives uniquement
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm cursor-pointer ${
              showAllStats
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => setShowAllStats(true)}
            disabled={isLoading}
          >
            Toutes les alertes
          </button>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center text-blue-500 hover:text-blue-700 text-sm"
          disabled={isLoading}
        >
          <RefreshCw
            className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`}
          />
          {isLoading ? "Chargement..." : "Rafraîchir"}
        </button>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : error ? (
          <div className="col-span-4 text-center py-4 text-red-500">
            <div>Erreur lors du chargement des statistiques:</div>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
            <button
              onClick={handleRefresh}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
            >
              Réessayer
            </button>
          </div>
        ) : !stats ? (
          <div className="col-span-4 text-center py-4 text-gray-500">
            Aucune donnée disponible.
            <div className="mt-2">
              <button
                onClick={handleRefresh}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
              >
                Rafraîchir
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-3 cursor-pointer">
              <div
                className="flex items-center"
                onClick={() => setActiveTab("activeAlerts")}
              >
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="text-gray-500 text-xs">Alertes actives</h3>
                  <p className="text-xl font-bold">{stats.activeCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3 cursor-pointer">
              <div
                className="flex items-center"
                onClick={() => setActiveTab("completedAlerts")}
              >
                <History className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="text-gray-500 text-xs">Alertes terminées</h3>
                  <p className="text-xl font-bold">
                    {stats.completedCount || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="text-gray-500 text-xs">Total alertes</h3>
                  <p className="text-xl font-bold">
                    {stats.totalCount ||
                      stats.activeCount + (stats.completedCount || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-3">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-orange-500 mr-2 flex-shrink-0" />
                <div>
                  <h3 className="text-gray-500 text-xs">
                    Type le plus courant
                    {showAllStats ? " (toutes)" : " (actives)"}
                  </h3>
                  {stats.effectCounts && stats.effectCounts.length > 0 ? (
                    <p className="text-sm font-bold truncate max-w-full">
                      {getAlertEffectLabel(
                        stats.effectCounts[0].effect as AlertEffect
                      )}
                    </p>
                  ) : (
                    <p className="text-sm">Aucune donnée</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Graphiques et tableaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading ? (
          <>
            <ChartSkeleton title="Répartition des alertes par type" />
            <TableSkeleton title="Routes les plus affectées" />
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-3">
              <h3 className="text-sm font-bold mb-2">
                Répartition des alertes par type
                {showAllStats ? " (toutes)" : " (actives)"}
              </h3>

              {effectData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart
                      margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                    >
                      <Pie
                        data={effectData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={65}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                      >
                        {effectData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [`${value} alertes`, name]}
                        contentStyle={{ fontSize: "12px" }}
                      />
                      <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{ fontSize: "12px", paddingLeft: "10px" }}
                        formatter={(value, entry, index) => (
                          <span style={{ color: entry.color }}>
                            {value}: {entry.payload?.value} (
                            {(
                              (entry.payload?.value /
                                effectData.reduce(
                                  (sum, item) => sum + item.value,
                                  0
                                )) *
                              100
                            ).toFixed(0)}
                            %)
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Aucune donnée disponible pour le graphique.
                  {!showAllStats && stats?.activeCount === 0 && (
                    <div className="mt-1">
                      <p>Il n'y a aucune alerte active actuellement.</p>
                      <button
                        onClick={() => setShowAllStats(true)}
                        className="mt-1 text-blue-500 underline text-xs"
                      >
                        Afficher toutes les alertes à la place
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-3">
              <h3 className="text-sm font-bold mb-2">
                Routes les plus affectées
                {showAllStats ? " (toutes)" : " (actives)"}
              </h3>

              {stats?.topRoutes && stats.topRoutes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-2 px-2 text-left font-medium">
                          Routes
                        </th>
                        <th className="py-2 px-2 text-right w-16 font-medium">
                          Nombre
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topRoutes.map((route, index) => (
                        <tr
                          key={index}
                          className={
                            index < stats.topRoutes.length - 1 ? "border-b" : ""
                          }
                        >
                          <td className="py-2 px-2 text-sm font-medium">
                            {route.routeIds.split(",").join(", ")}
                          </td>
                          <td className="py-2 px-2 text-right text-sm font-bold">
                            {route.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-3 text-gray-500 text-sm">
                  Aucune donnée disponible.
                  {!showAllStats && stats?.activeCount === 0 && (
                    <div className="mt-1">
                      <p>Il n'y a aucune alerte active actuellement.</p>
                      <button
                        onClick={() => setShowAllStats(true)}
                        className="mt-1 text-blue-500 underline text-xs"
                      >
                        Afficher toutes les alertes à la place
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Calendrier d'incidents */}
      {isLoading ? (
        <CalendarSkeleton />
      ) : (
        <div className="bg-white rounded-lg shadow p-3">
          <IncidentCalendar fixedMonths={9} />
        </div>
      )}

      <div className="flex gap-3 flex-wrap sm:flex-nowrap">
        {tramLinesLoading ? (
          <MapSkeleton />
        ) : (
          <div className="bg-white rounded-lg shadow p-3">
            <h3 className="text-sm font-bold mb-2">
              Carte du réseau de tramway
            </h3>
            {tramLinesData ? (
              <TramMap tramLinesData={tramLinesData} height="400px" />
            ) : (
              <div className="h-[400px] bg-gray-100 rounded flex items-center justify-center text-gray-500">
                {tramLinesError
                  ? "Impossible de charger la carte du réseau de tramway."
                  : "Chargement de la carte..."}
              </div>
            )}
          </div>
        )}

        {/* Résumé des lignes de tramway */}
        <div className="bg-white rounded-lg shadow p-3">
          <TramLineSummary
            tramLinesData={tramLinesData}
            isLoading={tramLinesLoading}
            error={tramLinesError}
          />
        </div>
      </div>
    </div>
  );
}
