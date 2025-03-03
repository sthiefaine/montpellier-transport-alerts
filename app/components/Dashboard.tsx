import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { AlertStats, AlertEffect } from '@/lib/types';
import { getAlertEffectLabel } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

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

export default function Dashboard() {
  const { data: stats, error, isLoading } = useSWR<AlertStats>('/api/alerts/stats', fetcher, {
    refreshInterval: 2 * 60 * 1000, // Rafraîchir toutes les 5 minutes
  });

  if (isLoading) {
    return <div className="text-center py-8">Chargement des statistiques...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">
      Erreur lors du chargement des statistiques. Veuillez réessayer plus tard.
    </div>;
  }

  if (!stats) {
    return <div className="text-center py-8 text-gray-500">Aucune donnée disponible.</div>;
  }

  // Préparation des données pour le graphique circulaire
  const effectData = stats.effectCounts.map((item, index) => ({
    name: getAlertEffectLabel(item.effect as AlertEffect),
    value: item.count,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Carte pour le nombre d'alertes actives */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
            <div>
              <h3 className="text-gray-500 text-sm">Alertes actives</h3>
              <p className="text-3xl font-bold">{stats.activeCount}</p>
            </div>
          </div>
        </div>
        
        {/* Carte pour l'alerte la plus commune */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-orange-500 mr-3" />
            <div>
              <h3 className="text-gray-500 text-sm">Type d'alerte le plus courant</h3>
              {stats.effectCounts.length > 0 ? (
                <p className="text-xl font-bold">
                  {getAlertEffectLabel(stats.effectCounts[0].effect as AlertEffect)}
                </p>
              ) : (
                <p className="text-xl">Aucune donnée</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Carte pour les routes les plus affectées */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <h3 className="text-gray-500 text-sm">Routes les plus affectées</h3>
              {stats.topRoutes.length > 0 ? (
                <p className="text-xl font-bold">
                  {stats.topRoutes[0].routeIds.split(',').join(', ')}
                </p>
              ) : (
                <p className="text-xl">Aucune donnée</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Graphique de répartition des effets */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Répartition des alertes par type d'effet</h3>
        
        {effectData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={effectData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} : ${(percent * 100).toFixed(0)}%`}
                >
                  {effectData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} alertes`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">Aucune donnée disponible pour le graphique.</div>
        )}
      </div>
      
      {/* Liste des routes les plus affectées */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4">Routes les plus affectées</h3>
        
        {stats.topRoutes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 text-left">Routes</th>
                  <th className="py-2 px-4 text-right">Nombre d'alertes</th>
                </tr>
              </thead>
              <tbody>
                {stats.topRoutes.map((route, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 px-4">{route.routeIds.split(',').join(', ')}</td>
                    <td className="py-2 px-4 text-right">{route.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">Aucune donnée disponible.</div>
        )}
      </div>
    </div>
  );
}