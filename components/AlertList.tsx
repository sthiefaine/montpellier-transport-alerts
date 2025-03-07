import { useState, useEffect } from 'react';
import useSWR from 'swr';
import AlertCard from './AlertCard';
import { Alert, AlertFilters } from '@/lib/types';
import { RefreshCw } from 'lucide-react';

interface AlertListProps {
  showOnlyActive?: boolean;
  showOnlyCompleted?: boolean;
  routeFilter?: string;
  stopFilter?: string;
  maxItems?: number;
  compact?: boolean;
}


const fetcher = (url: string) => fetch(`${url}&t=${new Date().getTime()}`).then(res => res.json());

export default function AlertList({
  showOnlyActive = false,
  showOnlyCompleted = false,
  routeFilter,
  stopFilter,
  maxItems,
  compact = false,
}: AlertListProps) {
  
  const getApiUrl = () => {
    const params = new URLSearchParams();
    
    
    
    if (routeFilter) {
      params.append('route', routeFilter);
    }
    
    if (stopFilter) {
      params.append('stop', stopFilter);
    }
    
    return `/api/alerts?${params.toString()}`;
  };

  
  const { data, error, isLoading, mutate } = useSWR<Alert[]>(getApiUrl(), fetcher);

  
  const handleRefresh = () => {
    mutate();
  };

  
  const filteredAlerts = () => {
    if (!data) return [];
    
    const now = new Date();
    
    if (showOnlyActive) {
      
      return data.filter(alert => {
        const timeEndDate = alert.timeEnd ? new Date(alert.timeEnd) : null;
        return timeEndDate === null || timeEndDate >= now;
      });
    } 
    
    if (showOnlyCompleted) {
      
      return data.filter(alert => {
        const timeEndDate = alert.timeEnd ? new Date(alert.timeEnd) : null;
        return timeEndDate !== null && timeEndDate < now;
      });
    }
    
    
    return data;
  };

  
  const alerts = filteredAlerts();
  const limitedAlerts = maxItems ? alerts.slice(0, maxItems) : alerts;

  if (isLoading) {
    return <div className="text-center py-8">Chargement des alertes...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Erreur lors du chargement des alertes. 
        <button onClick={handleRefresh} className="ml-2 underline">Réessayer</button>
      </div>
    );
  }

  if (!limitedAlerts || limitedAlerts.length === 0) {
    const statusText = showOnlyActive 
                       ? 'active' 
                       : showOnlyCompleted 
                         ? 'terminée' 
                         : '';
    
    return (
      <div className="text-center py-8 bg-white rounded-lg shadow p-6">
        <p className="text-lg mb-2">Aucune alerte {statusText} trouvée.</p>
        {showOnlyActive && (
          <p className="text-gray-600 mb-4">Toutes les lignes fonctionnent normalement.</p>
        )}
        {showOnlyCompleted && (
          <p className="text-gray-600 mb-4">L'historique des alertes sera affiché ici.</p>
        )}
        <button onClick={handleRefresh} className="text-blue-500 underline">Rafraîchir</button>
      </div>
    );
  }

  return (
    <div>
      
      <div className="flex justify-end mb-4">
        <button 
          onClick={handleRefresh}
          className="flex items-center text-blue-500 hover:text-blue-700"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Rafraîchir les alertes
        </button>
      </div>
      
      <div className="space-y-4">
        {limitedAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} compact={compact} />
        ))}
      </div>
    </div>
  );
}