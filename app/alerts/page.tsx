'use client';

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import AlertList from '../components/AlertList';

export default function AlertsPage() {
  const [showActive, setShowActive] = useState<boolean>(true);
  const [routeFilter, setRouteFilter] = useState<string>('');
  const [stopFilter, setStopFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  // Fonction pour gérer la soumission du formulaire de recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.startsWith('route:')) {
      setRouteFilter(searchInput.substring(6).trim());
      setStopFilter('');
    } else if (searchInput.startsWith('stop:')) {
      setStopFilter(searchInput.substring(5).trim());
      setRouteFilter('');
    } else {
      // Si aucun préfixe n'est spécifié, on considère que c'est une recherche de route
      setRouteFilter(searchInput);
      setStopFilter('');
    }
  };

  // Fonction pour effacer les filtres
  const clearFilters = () => {
    setRouteFilter('');
    setStopFilter('');
    setSearchInput('');
  };

  return (
    <div className="container">
      <h1 className="font-bold mb-8">Alertes de Transport</h1>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Filter className="w-5 h-5 mr-2" /> Filtres
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Filtre actif/tous */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <div className="flex space-x-2">
              <button
                className={`px-4 py-2 rounded-md ${
                  showActive
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                onClick={() => setShowActive(true)}
              >
                Alertes actives
              </button>
              <button
                className={`px-4 py-2 rounded-md ${
                  !showActive
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                onClick={() => setShowActive(false)}
              >
                Toutes les alertes
              </button>
            </div>
          </div>

          {/* Recherche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recherche (utilisez 'route:' ou 'stop:' pour préciser)
            </label>
            <form onSubmit={handleSearch} className="flex">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ex: route:1 ou stop:COMEDIE"
                className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Search className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        {/* Affichage des filtres actifs */}
        {(routeFilter || stopFilter) && (
          <div className="mt-4">
            <div className="flex items-center text-sm text-gray-700">
              <span className="font-medium mr-2">Filtres actifs:</span>
              {routeFilter && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md mr-2 flex items-center">
                  Route: {routeFilter}
                  <button
                    onClick={() => {
                      setRouteFilter('');
                      setSearchInput('');
                    }}
                    className="ml-1 text-blue-500 hover:text-blue-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
              {stopFilter && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md mr-2 flex items-center">
                  Arrêt: {stopFilter}
                  <button
                    onClick={() => {
                      setStopFilter('');
                      setSearchInput('');
                    }}
                    className="ml-1 text-blue-500 hover:text-blue-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-gray-500 hover:text-gray-700 text-sm ml-2"
              >
                Effacer tous les filtres
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste des alertes */}
      <AlertList showOnlyActive={showActive} routeFilter={routeFilter} stopFilter={stopFilter} />
    </div>
  );
}