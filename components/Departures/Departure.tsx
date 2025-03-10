"use client";

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Bus, ArrowDown, Clock, Info } from 'lucide-react';
import NextDepartures from '@/components/NextDepartures/NextDepartures';

// Define interface for stops
interface Stop {
  id: string;
  name: string;
  code?: string;
}

// Define interface for routes
interface Route {
  id: string;
  number: string;
  name: string;
  color?: string;
  type?: number;
  directions?: RouteDirection[];
}

// Define interface for route directions
interface RouteDirection {
  id: string;
  name: string;
  directionId: number;
}

export default function DeparturesContainer() {
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStop, setSelectedStop] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>(''); // The actual route ID to pass to the API
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);
  const [popularStops, setPopularStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'stops' | 'routes'>('stops');

  // Effect to load popular stops and routes on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // In a real application, this would fetch from an API
        // For now, we'll use hardcoded data for the most popular stops
        const popularStopsData = [
          { id: '1240', name: 'Gare Saint-Roch', code: 'STROCH' },
          { id: '1015', name: 'Comédie', code: 'COMED' },
          { id: '1178', name: 'Mosson', code: 'MOSSO' },
          { id: '1104', name: 'Louis Blanc', code: 'LBLAN' },
          { id: '1165', name: 'Odysseum', code: 'ODYSS' },
          { id: '1110', name: 'Place de l\'Europe', code: 'EUROP' },
          { id: '1214', name: 'Corum', code: 'CORUM' },
          { id: '1280', name: 'Albert 1er', code: 'ALB1' },
        ];
        setPopularStops(popularStopsData);
        setStops(popularStopsData);

        // Fetch routes from the API
        try {
          const response = await fetch('/api/routes/grouped');
          if (response.ok) {
            const routesData = await response.json();
            setRoutes(routesData);
          } else {
            // If API fails, fall back to mock data
            console.error("Failed to fetch routes from API, using mock data instead");
          }
        } catch (error) {
          console.error("Error fetching routes:", error);
          // Fall back to empty routes array
          setRoutes([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter stops based on search term
  const filteredStops = stops.filter(stop => 
    stop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (stop.code && stop.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filter routes based on search term
  const filteredRoutes = routes.filter(route => 
    route.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Filters sidebar */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search size={18} />
          Rechercher un départ
        </h2>
        
        <div className="mb-6">
          <div className="relative mb-4">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={16} className="text-gray-400" />
            </span>
            <input
              type="text"
              placeholder="Rechercher un arrêt ou une ligne..."
              className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex border-b border-gray-200 mb-4">
            <button
              className={`py-2 px-4 font-medium ${activeTab === 'stops' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('stops')}
            >
              Arrêts
            </button>
            <button
              className={`py-2 px-4 font-medium ${activeTab === 'routes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('routes')}
            >
              Lignes
            </button>
          </div>

          {activeTab === 'stops' && (
            <div className="max-h-96 overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredStops.length > 0 ? (
                <ul className="space-y-2">
                  {filteredStops.map((stop) => (
                    <li key={stop.id}>
                      <button
                        className={`w-full text-left px-3 py-2 rounded-md flex items-start gap-2 hover:bg-gray-100 transition-colors ${selectedStop === stop.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                        onClick={() => {
                          setSelectedStop(prev => prev === stop.id ? '' : stop.id);
                          setSelectedRoute(''); // Clear route selection
                        }}
                      >
                        <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">{stop.name}</div>
                          {stop.code && <div className="text-xs text-gray-500">Code: {stop.code}</div>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  {searchTerm ? 'Aucun arrêt trouvé' : 'Sélectionnez un arrêt'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="max-h-96 overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              ) : filteredRoutes.length > 0 ? (
                <ul className="space-y-2">
                  {filteredRoutes.map((route) => (
                    <li key={route.id}>
                      <div>
                        <button
                          className={`w-full text-left px-3 py-2 rounded-md flex items-start gap-2 hover:bg-gray-100 transition-colors ${selectedRoute === route.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                          onClick={() => {
                            setSelectedRoute(prev => prev === route.id ? '' : route.id);
                            setSelectedRouteId(''); // Reset the selected route ID
                            setSelectedDirection(null); // Reset direction
                            setSelectedStop(''); // Clear stop selection
                          }}
                        >
                          <div 
                            className={`w-6 h-6 ${route.type === 1 ? 'rounded-full' : 'rounded-md'} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                            style={{ backgroundColor: route.color || '#666' }}
                          >
                            {route.number}
                          </div>
                          <div className="font-medium">{route.name}</div>
                        </button>
                        
                        {/* Show direction options if this route is selected */}
                        {selectedRoute === route.id && route.directions && (
                          <div className="ml-8 mt-2 space-y-1 border-l-2 border-gray-200 pl-2">
                            {route.directions.map(direction => (
                              <button
                                key={direction.id}
                                className={`w-full text-left px-3 py-1.5 text-sm rounded flex items-center gap-2 hover:bg-gray-100 transition-colors ${selectedRouteId === direction.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}
                                onClick={() => {
                                  setSelectedRouteId(direction.id);
                                  setSelectedDirection(direction.directionId);
                                }}
                              >
                                <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>
                                {direction.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  {searchTerm ? 'Aucune ligne trouvée' : 'Sélectionnez une ligne'}
                </div>
              )}
            </div>
          )}
        </div>

        {!selectedStop && !selectedRoute && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
              <Info size={14} />
              Arrêts populaires
            </h3>
            <div className="flex flex-wrap gap-2">
              {popularStops.slice(0, 6).map((stop) => (
                <button
                  key={stop.id}
                  className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full"
                  onClick={() => {
                    setSelectedStop(stop.id);
                    setSelectedRoute('');
                  }}
                >
                  {stop.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="lg:col-span-2">
        {selectedStop ? (
          <NextDepartures 
            stopId={selectedStop} 
            limit={20} 
            refreshInterval={30000} 
            showTitle={true}
            displayMode="auto"
          />
        ) : selectedRouteId ? (
          <NextDepartures 
            routeId={selectedRouteId} 
            limit={20} 
            refreshInterval={30000} 
            showTitle={true}
            displayMode="auto"
          />
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <ArrowDown size={40} className="text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-800">Consultez les prochains départs</h2>
              <p className="text-gray-600 max-w-lg">
                Sélectionnez un arrêt ou une ligne dans le panneau de gauche pour voir les prochains départs.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <button 
                  className="flex items-center justify-center gap-2 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors" 
                  onClick={() => setSelectedStop('1240')} // Gare Saint-Roch as default
                >
                  <MapPin size={18} />
                  <span>Voir départs Gare Saint-Roch</span>
                </button>
                
                <button 
                  className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
                  onClick={() => setActiveTab('routes')}
                >
                  <Bus size={18} />
                  <span>Afficher toutes les lignes</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show some stats or interesting information */}
        {(selectedStop || selectedRouteId) && (
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
              <Clock size={16} />
              <span>Bon à savoir</span>
            </h3>
            <p className="text-sm text-gray-600">
              Les données de départs sont mises à jour en temps réel et montrent l'état actuel du réseau. 
              Les retards peuvent varier en fonction des conditions de circulation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}