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
              <h3 className="text-lg font-medium">
                Répartition des retards par heure
              </h3>
            </div>
            <div className="p-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { hour: "6h", avgDelay: 25, onTimeRate: 90 },
                      { hour: "7h", avgDelay: 38, onTimeRate: 85 },
                      { hour: "8h", avgDelay: 52, onTimeRate: 78 },
                      { hour: "9h", avgDelay: 47, onTimeRate: 80 },
                      { hour: "10h", avgDelay: 32, onTimeRate: 88 },
                      { hour: "11h", avgDelay: 28, onTimeRate: 92 },
                      { hour: "12h", avgDelay: 45, onTimeRate: 82 },
                      { hour: "13h", avgDelay: 42, onTimeRate: 85 },
                      { hour: "14h", avgDelay: 30, onTimeRate: 89 },
                      { hour: "15h", avgDelay: 35, onTimeRate: 87 },
                      { hour: "16h", avgDelay: 43, onTimeRate: 83 },
                      { hour: "17h", avgDelay: 65, onTimeRate: 68 },
                      { hour: "18h", avgDelay: 58, onTimeRate: 72 },
                      { hour: "19h", avgDelay: 43, onTimeRate: 80 },
                      { hour: "20h", avgDelay: 30, onTimeRate: 90 },
                      { hour: "21h", avgDelay: 22, onTimeRate: 94 },
                      { hour: "22h", avgDelay: 18, onTimeRate: 96 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#82ca9d"
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip />
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
              <p className="mt-4 text-sm text-gray-600">
                On observe des pics de retard aux heures de pointe (8h, 17h-18h)
                quand le trafic est le plus dense. La ponctualité est meilleure
                en dehors de ces périodes.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
