'use client';

import React, { useState } from 'react';
import { ArrowRight, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

// Types
interface DelayMetricsSummary {
  globalOnTimeRate: number;
  avgDelay: number;
  worstLine: {
    routeId: string;
    shortName: string;
    onTimeRate: number;
  };
  bestLine: {
    routeId: string;
    shortName: string; 
    onTimeRate: number;
  };
  totalObservations: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DelayStatsSmall() {
  const { data, error, isLoading } = useSWR<DelayMetricsSummary>(
    '/api/gtfs/delays/summary',
    fetcher,
    { refreshInterval: 5 * 60 * 1000 } // Refresh every 5 minutes
  );
  
  const router = useRouter();
  
  const handleViewFullDashboard = () => {
    // Naviguer vers le tableau de bord complet des retards
    router.push('/delays');
  };
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-3 animate-pulse">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold">Performance du réseau</h3>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-16 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-3">
        <h3 className="text-sm font-bold mb-2">Performance du réseau</h3>
        <div className="text-red-500 text-sm">
          Erreur lors du chargement des données de performance.
        </div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-3">
        <h3 className="text-sm font-bold mb-2">Performance du réseau</h3>
        <div className="text-gray-500 text-sm">
          Aucune donnée de performance disponible.
        </div>
      </div>
    );
  }
  
  // Déterminer la classe de couleur en fonction du taux de ponctualité
  const getColorClass = (rate: number) => {
    if (rate >= 85) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const globalRateColor = getColorClass(data.globalOnTimeRate);
  const worstLineColor = getColorClass(data.worstLine?.onTimeRate);
  const bestLineColor = getColorClass(data.bestLine?.onTimeRate);
  
  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold">Performance du réseau</h3>
        <button 
          onClick={handleViewFullDashboard}
          className="text-blue-500 hover:text-blue-700 text-xs flex items-center"
        >
          Tableau de bord détaillé
          <ArrowRight className="w-3 h-3 ml-1" />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Taux de ponctualité global */}
        <div className="border rounded-lg p-2">
          <div className="flex items-center">
            <Clock className={`w-4 h-4 mr-1 ${globalRateColor}`} />
            <span className="text-xs text-gray-500">Ponctualité globale</span>
          </div>
          <div className="mt-1">
            <span className={`text-lg font-bold ${globalRateColor}`}>
              {data.globalOnTimeRate?.toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* Retard moyen */}
        <div className="border rounded-lg p-2">
          <div className="flex items-center">
            <TrendingUp className="w-4 h-4 mr-1 text-blue-500" />
            <span className="text-xs text-gray-500">Retard moyen</span>
          </div>
          <div className="mt-1">
            <span className="text-lg font-bold">
              {data.avgDelay?.toFixed(0)} sec
            </span>
          </div>
        </div>
        
        {/* Ligne la moins ponctuelle */}
        <div className="border rounded-lg p-2">
          <div className="flex items-center">
            <TrendingDown className="w-4 h-4 mr-1 text-red-500" />
            <span className="text-xs text-gray-500">Ligne la moins ponctuelle</span>
          </div>
          <div className="mt-1 flex items-center">
            <span className="bg-gray-100 px-1 text-xs font-bold rounded">
              {data?.worstLine?.shortName}
            </span>
            <span className={`ml-1 text-sm font-bold ${worstLineColor}`}>
              {data?.worstLine?.onTimeRate?.toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* Ligne la plus ponctuelle */}
        <div className="border rounded-lg p-2">
          <div className="flex items-center">
            <TrendingUp className="w-4 h-4 mr-1 text-green-500" />
            <span className="text-xs text-gray-500">Ligne la plus ponctuelle</span>
          </div>
          <div className="mt-1 flex items-center">
            <span className="bg-gray-100 px-1 text-xs font-bold rounded">
              {data?.bestLine?.shortName}
            </span>
            <span className={`ml-1 text-sm font-bold ${bestLineColor}`}>
              {data?.bestLine?.onTimeRate?.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-2 text-xs text-right text-gray-500">
        {data.totalObservations?.toLocaleString()} passages analysés sur les 7 derniers jours
      </div>
    </div>
  );
}