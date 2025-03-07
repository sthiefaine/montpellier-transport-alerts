"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Clock, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { formatReadableDate } from "../IncidentCalendar";

// Types
interface TransportLine {
  id: string;
  shortName: string;
  longName: string;
  color: string;
}

interface DelayData {
  routeId: string;
  date: string;
  avgDelay: number;
  onTimeRate: number;
  lateRate: number;
  earlyRate: number;
  observations: number;
}

interface DelayStatAverage {
  avgDelay: number;
  onTimeRate: number;
  lateRate: number;
  earlyRate: number;
}

interface TrendInfo {
  trend: "up" | "down";
  value: string;
}

type PeriodType = "day" | "week" | "month";

export default function DelayStats() {
  const [transportLines, setTransportLines] = useState<TransportLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<string>("all");
  const [delayData, setDelayData] = useState<DelayData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<PeriodType>("week");

  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [hourlyDataLoading, setHourlyDataLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Fonction pour récupérer et agréger les données horaires
  const fetchHourlyData = async () => {
    setHourlyDataLoading(true);
    try {
      // Utiliser l'API existante sans spécifier de routeId pour obtenir toutes les lignes
      const response = await fetch(
        `/api/gtfs/metrics/hourly?date=${selectedDate}`
      );
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data = await response.json();

      // Initialiser un tableau pour les 24 heures
      const aggregatedData = Array(24)
        .fill(0)
        .map((_, i) => ({
          hour: `${i}h`,
          avgDelay: 0,
          onTimeRate: 0,
          observations: 0,
          routeCount: 0,
        }));

      // Traiter chaque ligne
      if (data.routes && Array.isArray(data.routes)) {
        data.routes.forEach((route: { hourlyData?: any[] }) => {
          if (route.hourlyData && Array.isArray(route.hourlyData)) {
            route.hourlyData.forEach(
              (hourItem: {
                hour: number;
                observations: number;
                avgDelay: number;
                onTimeRate: number;
              }) => {
                const hour = hourItem.hour;
                const hourEntry = aggregatedData[hour];

                // Pondérer les valeurs par le nombre d'observations
                if (hourItem.observations > 0) {
                  const totalObs =
                    hourEntry.observations + hourItem.observations;

                  // Calculer la moyenne pondérée du retard
                  hourEntry.avgDelay =
                    (hourEntry.avgDelay * hourEntry.observations +
                      hourItem.avgDelay * hourItem.observations) /
                    totalObs;

                  // Calculer la moyenne pondérée du taux de ponctualité
                  hourEntry.onTimeRate =
                    (hourEntry.onTimeRate * hourEntry.observations +
                      hourItem.onTimeRate * 100 * hourItem.observations) /
                    totalObs;

                  hourEntry.observations += hourItem.observations;
                  hourEntry.routeCount++;
                }
              }
            );
          }
        });
      }

      // Ne garder que les heures avec des données
      const filteredData = aggregatedData.filter(
        (item) => item.observations > 0
      );
      setHourlyData(filteredData);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données horaires:",
        error
      );
    } finally {
      setHourlyDataLoading(false);
    }
  };

  // Charger les données au chargement et quand la date change
  useEffect(() => {
    fetchHourlyData();
  }, [selectedDate]);

  useEffect(() => {
    const fetchTransportLines = async () => {
      try {
        const response = await fetch("/api/transport-lines");
        const data = await response.json();
        setTransportLines(data);
      } catch (error) {
        console.error("Erreur lors du chargement des lignes:", error);
      }
    };

    fetchTransportLines();
  }, []);

  useEffect(() => {
    const fetchDelayData = async () => {
      setLoading(true);
      try {
        let url = `/api/gtfs/metrics/daily?period=${period}`;
        if (selectedLine !== "all") {
          url += `&routeId=${selectedLine}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        setDelayData(data);
      } catch (error) {
        console.error(
          "Erreur lors du chargement des données de retard:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDelayData();
  }, [selectedLine, period]);

  // Préparer les données pour le graphique d'évolution des retards
  const prepareChartData = () => {
    return delayData.map((day) => ({
      date: new Date(day.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      avgDelay: day.avgDelay,
      onTime: day.onTimeRate * 100,
      late: day.lateRate * 100,
      early: day.earlyRate * 100,
    }));
  };

  // Calculer les statistiques moyennes
  const calculateAverages = () => {
    if (delayData.length === 0)
      return { avgDelay: 0, onTimeRate: 0, lateRate: 0, earlyRate: 0 };

    const sum = delayData.reduce(
      (acc, day) => ({
        avgDelay: acc.avgDelay + day.avgDelay,
        onTimeRate: acc.onTimeRate + day.onTimeRate,
        lateRate: acc.lateRate + day.lateRate,
        earlyRate: acc.earlyRate + day.earlyRate,
      }),
      { avgDelay: 0, onTimeRate: 0, lateRate: 0, earlyRate: 0 }
    );

    return {
      avgDelay: sum.avgDelay / delayData.length,
      onTimeRate: sum.onTimeRate / delayData.length,
      lateRate: sum.lateRate / delayData.length,
      earlyRate: sum.earlyRate / delayData.length,
    };
  };

  const chartData = prepareChartData();
  const averages = calculateAverages();

  // Déterminer la tendance par rapport à la période précédente (simulation)
  const getTrend = (): TrendInfo => {
    // Simulation de tendance - dans un cas réel, on comparerait avec les données de la période précédente
    const trend = Math.random() > 0.5 ? "up" : "down";
    const value = (Math.random() * 10).toFixed(1);
    return { trend, value };
  };

  const delayTrend = getTrend();
  const onTimeTrend = getTrend();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-2 shadow border rounded">
        <p className="text-sm font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.dataKey === "avgDelay" &&
              `Retard moyen : ${Math.round(entry.value)} sec`}
            {entry.dataKey === "onTimeRate" &&
              `Taux à l'heure : ${entry.value.toFixed(1)}%`}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Analyse des retards</h2>
          <p className="text-gray-600">Performance de ponctualité du réseau</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <select
            className="rounded-md border border-gray-300 px-3 py-2"
            value={selectedLine}
            onChange={(e) => setSelectedLine(e.target.value)}
          >
            <option value="all">Toutes les lignes</option>
            {transportLines.map((line) => (
              <option key={line.id} value={line.id}>
                Ligne {line.shortName} - {line.longName}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border border-gray-300 px-3 py-2"
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value as "day" | "week" | "month")
            }
          >
            <option value="day">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">30 derniers jours</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Chargement des données...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Indicateurs clés */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="pt-6">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">
                      Retard moyen
                    </p>
                    <p className="text-2xl font-bold">
                      {averages.avgDelay.toFixed(0)} sec
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-2 flex items-center text-sm">
                  {delayTrend.trend === "down" ? (
                    <>
                      <ArrowDown className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-green-600">
                        -{delayTrend.value}%
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowUp className="h-4 w-4 text-red-500 mr-1" />
                      <span className="text-red-600">+{delayTrend.value}%</span>
                    </>
                  )}
                  <span className="ml-1 text-gray-500">
                    vs période précédente
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="pt-6">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">
                      Taux de ponctualité
                    </p>
                    <p className="text-2xl font-bold">
                      {(averages.onTimeRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div
                    className={`p-2 rounded-full ${
                      averages.onTimeRate > 0.8
                        ? "bg-green-100 text-green-600"
                        : averages.onTimeRate > 0.6
                        ? "bg-yellow-100 text-yellow-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-2 flex items-center text-sm">
                  {onTimeTrend.trend === "up" ? (
                    <>
                      <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-green-600">
                        +{onTimeTrend.value}%
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                      <span className="text-red-600">
                        -{onTimeTrend.value}%
                      </span>
                    </>
                  )}
                  <span className="ml-1 text-gray-500">
                    vs période précédente
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="pt-6">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">
                      Taux de retard
                    </p>
                    <p className="text-2xl font-bold">
                      {(averages.lateRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-full text-red-600">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Passages avec &gt; 60s de retard
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="pt-6">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm text-gray-500 font-medium">
                      Taux d'avance
                    </p>
                    <p className="text-2xl font-bold">
                      {(averages.earlyRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-full text-blue-600">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Passages en avance de &gt; 60s
                </p>
              </div>
            </div>
          </div>

          {/* Graphique d'évolution */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="border-b border-gray-200 p-4">
              <h3 className="text-lg font-medium">Évolution des retards</h3>
            </div>
            <div className="p-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgDelay"
                      name="Retard moyen (sec)"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="onTime"
                      name="Taux à l'heure (%)"
                      stroke="#82ca9d"
                    />
                    <Line
                      type="monotone"
                      dataKey="late"
                      name="Taux en retard (%)"
                      stroke="#ff7300"
                    />
                    <Line
                      type="monotone"
                      dataKey="early"
                      name="Taux en avance (%)"
                      stroke="#0088fe"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Analyse par heure de la journée */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  Répartition des retards par heure
                </h3>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1 border rounded"
                />
              </div>
            </div>
            <div className="p-4">
              {hourlyDataLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : hourlyData.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-64 text-gray-500">
                  <p>Aucune donnée disponible pour cette date</p>
                  <button
                    onClick={fetchHourlyData}
                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  >
                    Réessayer
                  </button>
                </div>
              ) : (
                <>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis
                          yAxisId="left"
                          orientation="left"
                          stroke="#8884d8"
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#82ca9d"
                          tickFormatter={(value) => `${value.toFixed(0)}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="avgDelay"
                          name="Retard moyen (sec)"
                          fill="#8884d8"
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="onTimeRate"
                          name="Taux à l'heure (%)"
                          fill="#82ca9d"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-4 text-sm text-gray-600 text-center">
                    Données du{" "}
                    {new Date(selectedDate).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
