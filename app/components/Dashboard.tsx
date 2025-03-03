import { useState } from 'react';
import useSWR from 'swr';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertCircle, AlertTriangle, Clock, RefreshCw, History } from 'lucide-react';
import { AlertStats, AlertEffect } from '@/lib/types';
import { getAlertEffectLabel } from '@/lib/utils';

// Couleurs pour le graphique
const COLORS = [
  '#FF0000', // Rouge
  '#FF6B00', // Orange
  '#FFB800', // Jaune orangé
  '#FFE400', // Jaune
  '#A0C800', // Jaune-vert
  '#00C80A', // Vert
  '#00C1C8', // Turquoise
  '#0092C8', // Bleu clair
  '#0056C8', // Bleu
  '#5700C8', // Violet
  '#A800C8', // Magenta
  '#C8006B', // Rose
];
const fetcher = async (url: string) => {
  console.log(`Fetching data from: ${url} at`, new Date().toLocaleTimeString());
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur lors du fetch");
  return res.json();
};

export default function Dashboard() {
  const [showAllStats, setShowAllStats] = useState<boolean>(false);
  
  // Construction de l'URL avec le paramètre pour toutes les alertes
  const statsUrl = showAllStats 
    ? '/api/alerts/stats/summary?includeAll=true' 
    : '/api/alerts/stats/summary';
  
  // SWR avec configuration globale
  const { data: stats, error, isLoading, mutate } = useSWR<AlertStats>(
    statsUrl,
    fetcher,
    {
      refreshInterval: 2*60*1000,
      revalidateOnMount: true,
    }
  );

  const handleRefresh = () => {
    mutate();
  };

  if (isLoading) {
    return <div className="text-center py-4">Chargement des statistiques...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-500">
        <div>Erreur lors du chargement des statistiques:</div>
        <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
        <button onClick={handleRefresh} className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm">
          Réessayer
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-4 text-gray-500">
        Aucune donnée disponible.
        <div className="mt-2">
          <button onClick={handleRefresh} className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
            Rafraîchir
          </button>
        </div>
      </div>
    );
  }

  // Préparation des données pour le graphique circulaire
  const effectData = stats.effectCounts && Array.isArray(stats.effectCounts) 
    ? stats.effectCounts.map((item, index) => ({
        name: getAlertEffectLabel(item.effect as AlertEffect),
        value: item.count,
        color: COLORS[index % COLORS.length],
      }))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {/* Sélecteur de mode de statistiques */}
        <div className="flex space-x-2">
          <button
            className={`px-3 py-1 rounded-md text-sm ${
              !showAllStats
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setShowAllStats(false)}
          >
            Alertes actives uniquement
          </button>
          <button
            className={`px-3 py-1 rounded-md text-sm ${
              showAllStats
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            onClick={() => setShowAllStats(true)}
          >
            Toutes les alertes
          </button>
        </div>
        
        {/* Bouton de rafraîchissement */}
        <button 
          onClick={handleRefresh}
          className="flex items-center text-blue-500 hover:text-blue-700 text-sm"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Rafraîchir
        </button>
      </div>

      {/* Première rangée - 4 cartes plus petites */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Carte pour le nombre d'alertes actives */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
            <div>
              <h3 className="text-gray-500 text-xs">Alertes actives</h3>
              <p className="text-xl font-bold">{stats.activeCount}</p>
            </div>
          </div>
        </div>
        
        {/* Carte pour les alertes terminées */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex items-center">
            <History className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
            <div>
              <h3 className="text-gray-500 text-xs">Alertes terminées</h3>
              <p className="text-xl font-bold">{stats.completedCount || 0}</p>
            </div>
          </div>
        </div>
        
        {/* Carte pour le nombre total d'alertes */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0" />
            <div>
              <h3 className="text-gray-500 text-xs">Total alertes</h3>
              <p className="text-xl font-bold">{stats.totalCount || (stats.activeCount + (stats.completedCount || 0))}</p>
            </div>
          </div>
        </div>
        
        {/* Carte pour le type d'alerte le plus courant */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-orange-500 mr-2 flex-shrink-0" />
            <div>
              <h3 className="text-gray-500 text-xs">
                Type le plus courant
                {showAllStats ? ' (toutes)' : ' (actives)'}
              </h3>
              {stats.effectCounts && stats.effectCounts.length > 0 ? (
                <p className="text-sm font-bold truncate max-w-full">
                  {getAlertEffectLabel(stats.effectCounts[0].effect as AlertEffect)}
                </p>
              ) : (
                <p className="text-sm">Aucune donnée</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Graphique de répartition des effets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg shadow p-3">
          <h3 className="text-sm font-bold mb-2">
            Répartition des alertes par type
            {showAllStats ? ' (toutes)' : ' (actives)'}
          </h3>
          
          {effectData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Pie
                    data={effectData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={65}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    // Suppression des labels sur le graphique lui-même
                  >
                    {effectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [`${value} alertes`, name]}
                    contentStyle={{ fontSize: '12px' }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: '12px', paddingLeft: '10px' }}
                    formatter={(value, entry, index) => (
                      <span style={{ color: entry.color }}>
                        {value}: {entry.payload?.value} ({((entry.payload?.value / effectData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(0)}%)
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              Aucune donnée disponible pour le graphique.
              {!showAllStats && stats.activeCount === 0 && (
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
        
        {/* Liste des routes les plus affectées */}
        <div className="bg-white rounded-lg shadow p-3">
          <h3 className="text-sm font-bold mb-2">
            Routes les plus affectées
            {showAllStats ? ' (toutes)' : ' (actives)'}
          </h3>
          
          {stats.topRoutes && stats.topRoutes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-2 text-left font-medium">Routes</th>
                    <th className="py-2 px-2 text-right w-16 font-medium">Nombre</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topRoutes.map((route, index) => (
                    <tr key={index} className={index < stats.topRoutes.length - 1 ? "border-b" : ""}>
                      <td className="py-2 px-2 text-sm font-medium">{route.routeIds.split(',').join(', ')}</td>
                      <td className="py-2 px-2 text-right text-sm font-bold">{route.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-3 text-gray-500 text-sm">
              Aucune donnée disponible.
              {!showAllStats && stats.activeCount === 0 && (
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
      </div>
    </div>
  );
}