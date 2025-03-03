'use client';

import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AlertList from './components/AlertList';
import { AlertCircle, BarChart2, History } from 'lucide-react';
import useSWR from 'swr';
import { Alert } from '@/lib/types';

// Fetcher personnalisé avec anti-cache
const fetcher = (url: string) => fetch(`${url}?t=${new Date().getTime()}`).then(res => res.json());

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'activeAlerts' | 'completedAlerts'>('dashboard');

  // Charger toutes les alertes pour calculer le nombre d'alertes de chaque type
  const { data: allAlerts } = useSWR<Alert[]>('/api/alerts', fetcher);

  // Calculer le nombre d'alertes actives et terminées
  const getAlertCounts = () => {
    if (!allAlerts) return { activeCount: 0, completedCount: 0 };
    
    const now = new Date();
    
    let activeCount = 0;
    let completedCount = 0;
    
    allAlerts.forEach(alert => {
      const timeEndDate = alert.timeEnd ? new Date(alert.timeEnd) : null;
      if (timeEndDate === null || timeEndDate >= now) {
        activeCount++;
      } else {
        completedCount++;
      }
    });
    
    return { activeCount, completedCount };
  };

  const { activeCount, completedCount } = getAlertCounts();

  return (
    <div className="container">
      <h1 className="font-bold mb-2 text-center">
        Transport en Commun - Montpellier
      </h1>

      {/* Onglets */}
      <div className="flex border-b mb-8 overflow-x-auto">
        <button
          className={`flex items-center py-3 px-6 focus:outline-none whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'border-b-2 border-blue-500 text-blue-500 font-medium'
              : 'text-gray-500 hover:text-blue-500'
          }`}
          onClick={() => setActiveTab('dashboard')}
        >
          <BarChart2 className="w-5 h-5 mr-2" />
          Tableau de bord
        </button>
        <button
          className={`flex items-center py-3 px-6 focus:outline-none whitespace-nowrap ${
            activeTab === 'activeAlerts'
              ? 'border-b-2 border-blue-500 text-blue-500 font-medium'
              : 'text-gray-500 hover:text-blue-500'
          }`}
          onClick={() => setActiveTab('activeAlerts')}
        >
          <AlertCircle className="w-5 h-5 mr-2" />
          Alertes actives
          {activeCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">{activeCount}</span>
          )}
        </button>
        <button
          className={`flex items-center py-3 px-6 focus:outline-none whitespace-nowrap ${
            activeTab === 'completedAlerts'
              ? 'border-b-2 border-blue-500 text-blue-500 font-medium'
              : 'text-gray-500 hover:text-blue-500'
          }`}
          onClick={() => setActiveTab('completedAlerts')}
        >
          <History className="w-5 h-5 mr-2" />
          Alertes terminées
          {completedCount > 0 && (
            <span className="ml-2 bg-green-500 text-white text-xs rounded-full px-2 py-1">{completedCount}</span>
          )}
        </button>
      </div>

      {/* Contenu */}
      <div className="mt-6">
        {activeTab === 'dashboard' ? (
          <Dashboard />
        ) : activeTab === 'activeAlerts' ? (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <AlertCircle className="w-6 h-6 mr-2 text-red-500" />
              Alertes actives {activeCount > 0 && `(${activeCount})`}
            </h2>
            <AlertList showOnlyActive={true} compact={true} />
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <History className="w-6 h-6 mr-2 text-green-500" />
              Alertes terminées {completedCount > 0 && `(${completedCount})`}
            </h2>
            <AlertList showOnlyCompleted={true} compact={true} />
          </div>
        )}
      </div>
    </div>
  );
}