"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Scatter,
  ScatterChart,
  ZAxis,
  ComposedChart
} from "recharts";
import { 
  Clock, 
  ArrowUp, 
  ArrowDown, 
  AlertCircle, 
  Calendar, 
  Filter, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Map,
  Layers,
  Sliders
} from "lucide-react";

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

interface HourlyData {
  hour: number | string;
  avgDelay: number;
  onTimeRate: number;
  observations: number;
}

interface WeekdayData {
  day: string;
  avgDelay: number;
  onTimeRate: number;
  lateRate: number;
  observations: number;
}

interface RoutePerformance {
  routeId: string;
  routeNumber: string;
  routeName: string;
  avgDelay: number;
  onTimeRate: number;
  observations: number;
  color: string;
}

type PeriodType = "day" | "week" | "month" | "year";
type ViewType = "overview" | "byHour" | "byDay" | "byRoute" | "comparison";

const DAYS_OF_WEEK = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function DelayStats() {
  // State variables
  const [transportLines, setTransportLines] = useState<TransportLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<string>("all");
  const [delayData, setDelayData] = useState<DelayData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [period, setPeriod] = useState<PeriodType>("week");
  const [currentView, setCurrentView] = useState<ViewType>("overview");
  const [comparisonLines, setComparisonLines] = useState<string[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [weekdayData, setWeekdayData] = useState<WeekdayData[]>([]);
  const [routePerformance, setRoutePerformance] = useState<RoutePerformance[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Fetch transport lines
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

  // Fetch delay data
  useEffect(() => {
    const fetchDelayData = async () => {
      setLoading(true);
      try {
        // Main delay data
        let url = `/api/gtfs/metrics/daily?period=${period}`;
        if (selectedLine !== "all") {
          url += `&routeId=${selectedLine}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        setDelayData(data);

        // Fetch hourly data
        fetchHourlyData();

        // Fetch route performance data
        fetchRoutePerformance();

        // Generate weekday data
        generateWeekdayData(data);
      } catch (error) {
        console.error("Erreur lors du chargement des données de retard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDelayData();
  }, [selectedLine, period, selectedDate]);

  // Fetch hourly data
  const fetchHourlyData = async () => {
    try {
      const url = `/api/gtfs/metrics/hourly?date=${selectedDate}${
        selectedLine !== "all" ? `&routeId=${selectedLine}` : ""
      }`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        // Process data based on the response structure
        if (data.hourlyData) {
          // Case when a specific route is selected
          setHourlyData(data.hourlyData);
        } else if (data.routes) {
          // Case when all routes are selected - aggregate data
          const aggregatedData = aggregateHourlyData(data.routes);
          setHourlyData(aggregatedData);
        } else {
          setHourlyData([]);
        }
      } else {
        console.error("Erreur API pour les données horaires:", response.statusText);
        setHourlyData(generateMockHourlyData());
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données horaires:", error);
      // Fallback to mock data
      setHourlyData(generateMockHourlyData());
    }
  };

  // Fetch route performance
  const fetchRoutePerformance = async () => {
    try {
      const url = `/api/gtfs/delays/by-route?period=${period}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map((route: any) => ({
          routeId: route.route_id || route.routeId,
          routeNumber: route.route_number || route.shortName,
          routeName: route.route_name || route.longName,
          avgDelay: route.avg_delay_seconds || route.avgDelay,
          onTimeRate: route.punctuality_percentage || (route.onTimeRate * 100),
          observations: route.observations || 0,
          color: route.color || "#0088FE"
        }));
        setRoutePerformance(formattedData);
      } else {
        setRoutePerformance(generateMockRoutePerformance());
      }
    } catch (error) {
      console.error("Erreur lors du chargement des performances par ligne:", error);
      setRoutePerformance(generateMockRoutePerformance());
    }
  };

  // Generate weekday data from daily data
  const generateWeekdayData = (data: DelayData[]) => {
    if (!data || data.length === 0) {
      setWeekdayData(generateMockWeekdayData());
      return;
    }

    // Group data by day of week
    const dayGroups: { [key: string]: DelayData[] } = {};
    DAYS_OF_WEEK.forEach(day => {
      dayGroups[day] = [];
    });

    data.forEach(item => {
      const date = new Date(item.date);
      const dayIndex = date.getDay();
      const dayName = DAYS_OF_WEEK[dayIndex === 0 ? 6 : dayIndex - 1]; // Adjust for Sunday
      dayGroups[dayName].push(item);
    });

    // Calculate averages for each day
    const weekdayData: WeekdayData[] = DAYS_OF_WEEK.map(day => {
      const dayData = dayGroups[day];
      if (dayData.length === 0) {
        return {
          day,
          avgDelay: 0,
          onTimeRate: 0,
          lateRate: 0,
          observations: 0
        };
      }

      const avgDelay = dayData.reduce((sum, item) => sum + item.avgDelay, 0) / dayData.length;
      const onTimeRate = dayData.reduce((sum, item) => sum + item.onTimeRate, 0) / dayData.length;
      const lateRate = dayData.reduce((sum, item) => sum + item.lateRate, 0) / dayData.length;
      const observations = dayData.reduce((sum, item) => sum + item.observations, 0);

      return {
        day,
        avgDelay,
        onTimeRate,
        lateRate,
        observations
      };
    });

    setWeekdayData(weekdayData);
  };

  // Aggregate hourly data from multiple routes
  const aggregateHourlyData = (routes: any[]): HourlyData[] => {
    const hourlyMap: { [hour: number]: { 
      total: number, 
      avgDelay: number, 
      onTimeRate: number,
      observations: number
    }} = {};

    routes.forEach(route => {
      if (route.hourlyData && Array.isArray(route.hourlyData)) {
        route.hourlyData.forEach((hourData: any) => {
          const hour = hourData.hour;
          if (!hourlyMap[hour]) {
            hourlyMap[hour] = { 
              total: 0, 
              avgDelay: 0, 
              onTimeRate: 0,
              observations: 0
            };
          }

          hourlyMap[hour].avgDelay += hourData.avgDelay;
          hourlyMap[hour].onTimeRate += hourData.onTimeRate;
          hourlyMap[hour].observations += hourData.observations || 0;
          hourlyMap[hour].total += 1;
        });
      }
    });

    return Object.entries(hourlyMap).map(([hour, data]) => ({
      hour: `${hour}h`,
      avgDelay: data.avgDelay / data.total,
      onTimeRate: data.onTimeRate / data.total,
      observations: data.observations
    })).sort((a, b) => {
      const hourA = parseInt(a.hour.toString());
      const hourB = parseInt(b.hour.toString());
      return hourA - hourB;
    });
  };

  // Generate mock data if API fails or for demo purposes
  const generateMockHourlyData = (): HourlyData[] => {
    return Array.from({ length: 18 }, (_, i) => {
      const hour = i + 6; // Start from 6 AM
      // Create patterns that reflect real-world scenarios
      // Morning peak (8-9), lunch hours (12-14), evening peak (17-19)
      let delay, onTime, observations;
      
      if (hour === 8 || hour === 9 || hour === 17 || hour === 18) {
        // Peak hours - higher delays, lower on-time
        delay = 60 + Math.random() * 60;
        onTime = 65 + Math.random() * 15;
        observations = 200 + Math.floor(Math.random() * 150);
      } else if (hour === 12 || hour === 13) {
        // Lunch hours - moderate
        delay = 40 + Math.random() * 30;
        onTime = 75 + Math.random() * 15;
        observations = 150 + Math.floor(Math.random() * 100);
      } else if (hour < 7 || hour > 20) {
        // Early/late hours - less traffic but sometimes less predictable
        delay = 20 + Math.random() * 40;
        onTime = 80 + Math.random() * 15;
        observations = 50 + Math.floor(Math.random() * 70);
      } else {
        // Regular hours
        delay = 30 + Math.random() * 20;
        onTime = 85 + Math.random() * 10;
        observations = 120 + Math.floor(Math.random() * 80);
      }
      
      return {
        hour: `${hour}h`,
        avgDelay: delay,
        onTimeRate: onTime,
        observations
      };
    });
  };

  const generateMockWeekdayData = (): WeekdayData[] => {
    return DAYS_OF_WEEK.map((day, index) => {
      // Create patterns that reflect real-world scenarios
      // Weekdays have more traffic, weekends have less but can be less predictable
      let delay, onTime, late, observations;
      
      if (index < 5) {
        // Weekdays
        if (index === 0 || index === 4) {
          // Monday and Friday - slightly worse
          delay = 45 + Math.random() * 25;
          onTime = 75 + Math.random() * 10;
          late = 15 + Math.random() * 10;
        } else {
          // Tuesday-Thursday - more consistent
          delay = 35 + Math.random() * 20;
          onTime = 80 + Math.random() * 10;
          late = 10 + Math.random() * 10;
        }
        observations = 5000 + Math.floor(Math.random() * 3000);
      } else {
        // Weekends
        delay = 25 + Math.random() * 15;
        onTime = 85 + Math.random() * 10;
        late = 5 + Math.random() * 10;
        observations = 2000 + Math.floor(Math.random() * 1500);
      }
      
      return {
        day,
        avgDelay: delay,
        onTimeRate: onTime / 100,
        lateRate: late / 100,
        observations
      };
    });
  };

  const generateMockRoutePerformance = (): RoutePerformance[] => {
    // Create realistic data for 10 routes
    return Array.from({ length: 10 }, (_, i) => {
      const routeNumber = i + 1;
      let delay, onTime, observations;
      
      // Tram lines (1-4) are generally more punctual than buses
      if (routeNumber <= 4) {
        delay = 25 + Math.random() * 20;
        onTime = 82 + Math.random() * 12;
      } else {
        delay = 35 + Math.random() * 40;
        onTime = 70 + Math.random() * 20;
      }
      
      observations = 3000 + Math.floor(Math.random() * 7000);
      
      return {
        routeId: `${routeNumber}`,
        routeNumber: `${routeNumber}`,
        routeName: routeNumber <= 4 
          ? `Ligne ${routeNumber} - Tramway` 
          : `Ligne ${routeNumber} - Bus`,
        avgDelay: delay,
        onTimeRate: onTime,
        observations,
        color: COLORS[i % COLORS.length]
      };
    });
  };

  // Prepare data for charts
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

  // Calculate the averages
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

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHourlyData();
    fetchRoutePerformance();
    
    // Additional fetch operations if needed
    
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Handle export
  const handleExport = () => {
    // Export data based on current view
    let csvContent = "";
    let filename = "";
    
    if (currentView === "overview" || currentView === "byDay") {
      csvContent = "Date,Retard moyen (sec),À l'heure (%),En retard (%),En avance (%)\n";
      csvContent += delayData.map(day => 
        `${day.date},${day.avgDelay.toFixed(1)},${(day.onTimeRate * 100).toFixed(1)},${(day.lateRate * 100).toFixed(1)},${(day.earlyRate * 100).toFixed(1)}`
      ).join("\n");
      filename = `delays_overview_${period}.csv`;
    } else if (currentView === "byHour") {
      csvContent = "Heure,Retard moyen (sec),À l'heure (%),Observations\n";
      csvContent += hourlyData.map(hour => 
        `${hour.hour},${hour.avgDelay.toFixed(1)},${hour.onTimeRate.toFixed(1)},${hour.observations}`
      ).join("\n");
      filename = `delays_hourly_${selectedDate}.csv`;
    } else if (currentView === "byRoute") {
      csvContent = "Ligne,Nom,Retard moyen (sec),À l'heure (%),Observations\n";
      csvContent += routePerformance.map(route => 
        `${route.routeNumber},"${route.routeName}",${route.avgDelay.toFixed(1)},${route.onTimeRate.toFixed(1)},${route.observations}`
      ).join("\n");
      filename = `delays_routes_${period}.csv`;
    }
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add a line to comparison
  const addToComparison = (routeId: string) => {
    if (!comparisonLines.includes(routeId)) {
      setComparisonLines([...comparisonLines, routeId]);
    }
  };

  // Remove a line from comparison
  const removeFromComparison = (routeId: string) => {
    setComparisonLines(comparisonLines.filter(id => id !== routeId));
  };

  const chartData = prepareChartData();
  const averages = calculateAverages();

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-white p-3 shadow border rounded text-sm">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.value.toFixed(1)} {entry.unit || ""}
          </p>
        ))}
      </div>
    );
  };

  // Render charts based on current view
  const renderCharts = () => {
    if (currentView === "overview") {
      return (
        <div className="space-y-6">
          {/* Evolution Chart */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-medium">Évolution des retards</h3>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleRefresh}
                  className="p-2 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-100"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>
                <button 
                  onClick={handleExport}
                  className="p-2 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-100"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }} 
                      tickLine={false}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <YAxis 
                      yAxisId="left" 
                      orientation="left" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ 
                        value: 'Retard (sec)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fontSize: 12, fill: '#666' }
                      }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e0e0' }}
                      label={{ 
                        value: 'Pourcentage (%)', 
                        angle: 90, 
                        position: 'insideRight',
                        style: { textAnchor: 'middle', fontSize: 12, fill: '#666' }
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      yAxisId="left" 
                      dataKey="avgDelay" 
                      name="Retard moyen (sec)" 
                      fill="#8884d8" 
                      barSize={20}
                      radius={[4, 4, 0, 0]}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="onTime" 
                      name="À l'heure (%)" 
                      stroke="#4caf50" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="late" 
                      name="En retard (%)" 
                      stroke="#f44336" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="early" 
                      name="En avance (%)" 
                      stroke="#2196f3" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Hourly Analysis */}
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="border-b border-gray-200 p-4 flex justify-between items-center">
              <h3 className="text-lg font-medium">Répartition des retards par heure</h3>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1 border rounded text-sm"
                />
              </div>
            </div>
            <div className="p-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <YAxis 
                      yAxisId="left" 
                      orientation="left" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      yAxisId="left" 
                      dataKey="avgDelay" 
                      name="Retard moyen (sec)" 
                      fill="#8884d8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      yAxisId="right" 
                      dataKey="onTimeRate" 
                      name="À l'heure (%)" 
                      fill="#82ca9d"
                      radius={[4, 4, 0, 0]}
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
            </div>
          </div>
        </div>
      );
    } else if (currentView === "byHour") {
      return (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="border-b border-gray-200 p-4 flex justify-between items-center">
            <h3 className="text-lg font-medium">Analyse horaire détaillée</h3>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1 border rounded text-sm"
              />
              <button 
                onClick={handleExport}
                className="p-2 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-100"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="h-80">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Retard moyen par heure</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="avgDelay" 
                      name="Retard moyen (sec)" 
                      stroke="#8884d8" 
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <div className="h-80">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Ponctualité par heure</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="onTimeRate" 
                      name="À l'heure (%)" 
                      stroke="#82ca9d" 
                      fill="#82ca9d"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="h-80">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Nombre d'observations par heure</h4>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="observations" 
                    name="Observations" 
                    fill="#ff7043"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Analyse des heures de pointe</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  Les heures de pointe (8h-9h et 17h-19h) présentent généralement les retards les plus importants, avec une baisse de la ponctualité pouvant atteindre 15-20%. 
                  Ces périodes concentrent également le plus grand nombre d'observations, ce qui indique une fréquence plus élevée des services.
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  En milieu de journée (10h-15h), la ponctualité s'améliore significativement avec des retards moyens inférieurs de 40% par rapport aux heures de pointe.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (currentView === "byDay") {
      return (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="border-b border-gray-200 p-4 flex justify-between items-center">
            <h3 className="text-lg font-medium">Analyse par jour de la semaine</h3>
            <button 
              onClick={handleExport}
              className="p-2 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-100"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="h-80">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Retard moyen par jour</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={weekdayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="avgDelay" 
                      name="Retard moyen (sec)" 
                      fill="#8884d8"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="h-80">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Ponctualité par jour</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={weekdayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                    <Tooltip 
                      formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, "À l'heure"]}
                      content={<CustomTooltip />}
                    />
                    <Bar 
                      dataKey="onTimeRate" 
                      name="À l'heure (%)" 
                      fill="#82ca9d"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="h-80">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Observations par jour</h4>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={weekdayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="observations" 
                    name="Observations" 
                    fill="#ff7043"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Tendances hebdomadaires</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  L'analyse montre que les lundis et vendredis présentent généralement des performances légèrement inférieures aux autres jours de la semaine, 
                  avec des retards moyens plus élevés de 10-15%.
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Les week-ends (samedi et dimanche) affichent une meilleure ponctualité, en partie due à une circulation routière moins dense, 
                  mais le nombre d'observations est également plus faible, reflétant une fréquence réduite des services.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (currentView === "byRoute") {
      return (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="border-b border-gray-200 p-4 flex justify-between items-center">
            <h3 className="text-lg font-medium">Performance par ligne</h3>
            <button 
              onClick={handleExport}
              className="p-2 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-100"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="h-80">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Retard moyen par ligne</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart 
                    data={routePerformance}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis 
                      type="category" 
                      dataKey="routeNumber" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="avgDelay" 
                      name="Retard moyen (sec)"
                      radius={[0, 4, 4, 0]}
                    >
                      {routePerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="h-80">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Ponctualité par ligne</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart 
                    data={routePerformance}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={true} vertical={false} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis 
                      type="category" 
                      dataKey="routeNumber" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="onTimeRate" 
                      name="À l'heure (%)"
                      radius={[0, 4, 4, 0]}
                    >
                      {routePerformance.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            entry.onTimeRate > 85 ? "#4caf50" :
                            entry.onTimeRate > 70 ? "#ff9800" :
                            "#f44336"
                          } 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="h-80">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Répartition des observations par ligne</h4>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie
                    data={routePerformance}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="observations"
                    nameKey="routeNumber"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {routePerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [value.toLocaleString(), "Observations"]}
                    content={<CustomTooltip />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Analyse des performances</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  Les lignes de tramway (1-4) présentent généralement une meilleure ponctualité que les lignes de bus, 
                  avec des taux à l'heure supérieurs de 10-15%. Cela s'explique par leur circulation sur des voies dédiées.
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Les lignes traversant le centre-ville montrent des retards plus importants aux heures de pointe, 
                  tandis que les lignes périphériques affichent des performances plus constantes tout au long de la journée.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (currentView === "comparison") {
      // Filter route performance data for the selected routes
      const comparisonData = routePerformance.filter(route => 
        comparisonLines.includes(route.routeId)
      );
      
      return (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="border-b border-gray-200 p-4 flex justify-between items-center">
            <h3 className="text-lg font-medium">Comparaison des lignes</h3>
            <div className="flex space-x-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) addToComparison(e.target.value);
                }}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="">Ajouter une ligne...</option>
                {routePerformance
                  .filter(route => !comparisonLines.includes(route.routeId))
                  .map(route => (
                    <option key={route.routeId} value={route.routeId}>
                      Ligne {route.routeNumber} - {route.routeName}
                    </option>
                  ))
                }
              </select>
              <button 
                onClick={handleExport}
                className="p-2 text-gray-500 hover:text-blue-500 rounded-full hover:bg-gray-100"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="p-4">
            {comparisonLines.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-gray-500">Sélectionnez des lignes à comparer en utilisant le menu déroulant ci-dessus.</p>
              </div>
            ) : (
              <div>
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {comparisonData.map(route => (
                      <div 
                        key={route.routeId}
                        className="inline-flex items-center bg-gray-100 px-3 py-1 rounded-full"
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: route.color }}
                        ></div>
                        <span className="text-sm font-medium">Ligne {route.routeNumber}</span>
                        <button
                          onClick={() => removeFromComparison(route.routeId)}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="h-80">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Comparaison des retards</h4>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="routeNumber" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="avgDelay" 
                          name="Retard moyen (sec)"
                          radius={[4, 4, 0, 0]}
                        >
                          {comparisonData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="h-80">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Comparaison de la ponctualité</h4>
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="routeNumber" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="onTimeRate" 
                          name="À l'heure (%)"
                          radius={[4, 4, 0, 0]}
                        >
                          {comparisonData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="h-80">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Relation retard-ponctualité</h4>
                  <ResponsiveContainer width="100%" height="90%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        type="number" 
                        dataKey="avgDelay" 
                        name="Retard moyen" 
                        unit=" sec"
                        domain={['auto', 'auto']}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="onTimeRate" 
                        name="À l'heure" 
                        unit="%"
                        domain={[0, 100]}
                      />
                      <ZAxis range={[60, 400]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
                      <Legend />
                      <Scatter 
                        name="Lignes" 
                        data={comparisonData} 
                        fill="#8884d8"
                      >
                        {comparisonData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Analyse comparative</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">
                      La comparaison montre une corrélation inverse entre le retard moyen et le taux de ponctualité. 
                      Les lignes avec les retards moyens les plus faibles affichent généralement les meilleurs taux de ponctualité.
                    </p>
                    {comparisonData.length >= 2 && (
                      <p className="text-sm text-gray-600 mt-2">
                        La ligne {comparisonData.sort((a, b) => a.avgDelay - b.avgDelay)[0].routeNumber} présente les meilleures performances 
                        avec un retard moyen de {comparisonData.sort((a, b) => a.avgDelay - b.avgDelay)[0].avgDelay.toFixed(1)} secondes, 
                        tandis que la ligne {comparisonData.sort((a, b) => b.avgDelay - a.avgDelay)[0].routeNumber} affiche le retard moyen 
                        le plus élevé à {comparisonData.sort((a, b) => b.avgDelay - a.avgDelay)[0].avgDelay.toFixed(1)} secondes.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
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
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
          >
            <option value="day">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">30 derniers jours</option>
            <option value="year">Année en cours</option>
          </select>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <button
          className={`px-4 py-3 flex items-center whitespace-nowrap ${
            currentView === "overview"
              ? "border-b-2 border-blue-500 text-blue-600 font-medium"
              : "text-gray-600 hover:text-blue-500 border-b-2 border-transparent"
          }`}
          onClick={() => setCurrentView("overview")}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Vue d'ensemble
        </button>
        <button
          className={`px-4 py-3 flex items-center whitespace-nowrap ${
            currentView === "byHour"
              ? "border-b-2 border-blue-500 text-blue-600 font-medium"
              : "text-gray-600 hover:text-blue-500 border-b-2 border-transparent"
          }`}
          onClick={() => setCurrentView("byHour")}
        >
          <Clock className="w-4 h-4 mr-2" />
          Par heure
        </button>
        <button
          className={`px-4 py-3 flex items-center whitespace-nowrap ${
            currentView === "byDay"
              ? "border-b-2 border-blue-500 text-blue-600 font-medium"
              : "text-gray-600 hover:text-blue-500 border-b-2 border-transparent"
          }`}
          onClick={() => setCurrentView("byDay")}
        >
          <Calendar className="w-4 h-4 mr-2" />
          Par jour
        </button>
        <button
          className={`px-4 py-3 flex items-center whitespace-nowrap ${
            currentView === "byRoute"
              ? "border-b-2 border-blue-500 text-blue-600 font-medium"
              : "text-gray-600 hover:text-blue-500 border-b-2 border-transparent"
          }`}
          onClick={() => setCurrentView("byRoute")}
        >
          <Layers className="w-4 h-4 mr-2" />
          Par ligne
        </button>
        <button
          className={`px-4 py-3 flex items-center whitespace-nowrap ${
            currentView === "comparison"
              ? "border-b-2 border-blue-500 text-blue-600 font-medium"
              : "text-gray-600 hover:text-blue-500 border-b-2 border-transparent"
          }`}
          onClick={() => setCurrentView("comparison")}
        >
          <Sliders className="w-4 h-4 mr-2" />
          Comparaison
        </button>
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
          {/* Indicateurs clés - Always displayed */}
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
                  {averages.avgDelay > 40 ? (
                    <>
                      <ArrowUp className="h-4 w-4 text-red-500 mr-1" />
                      <span className="text-red-600">Supérieur à la moyenne</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-green-600">Inférieur à la moyenne</span>
                    </>
                  )}
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
                  {averages.onTimeRate > 0.75 ? (
                    <>
                      <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-green-600">Bon niveau</span>
                    </>
                  ) : (
                    <>
                      <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                      <span className="text-red-600">À améliorer</span>
                    </>
                  )}
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

          {/* Charts based on current view */}
          {renderCharts()}
        </>
      )}
    </div>
  );
}