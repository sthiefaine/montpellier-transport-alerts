'use client';

import { useState } from 'react';
import { AlertCircle, BarChart2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AlertList from './components/AlertList';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts'>('dashboard');

  return (
    <div className="container">
      <h1 className="font-bold mb-8 text-center">
        Alertes de Transport en Commun - Montpellier
      </h1>

      {/* Onglets */}
      <div className="flex border-b mb-8">
        <button
          className={`flex items-center py-3 px-6 focus:outline-none ${
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
          className={`flex items-center py-3 px-6 focus:outline-none ${
            activeTab === 'alerts'
              ? 'border-b-2 border-blue-500 text-blue-500 font-medium'
              : 'text-gray-500 hover:text-blue-500'
          }`}
          onClick={() => setActiveTab('alerts')}
        >
          <AlertCircle className="w-5 h-5 mr-2" />
          Alertes actives
        </button>
      </div>

      {/* Contenu */}
      <div className="mt-6">
        {activeTab === 'dashboard' ? (
          <Dashboard />
        ) : (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <AlertCircle className="w-6 h-6 mr-2 text-red-500" />
              Alertes actives
            </h2>
            <AlertList showOnlyActive={true} compact={true} />
          </div>
        )}
      </div>
    </div>
  );
}