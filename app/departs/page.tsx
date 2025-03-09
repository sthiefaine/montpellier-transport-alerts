"use client";

import React, { useEffect, useState } from "react";
import NextDepartures from "@/components/NextDepartures/NextDepartures";
import { Loader2 } from "lucide-react";
import DeparturesFinder from "@/components/DeparturesFinder/DeparturesFinder";

// Types pour les données
interface Route {
  id: string;
  shortName: string;
  longName: string;
  color?: string | null;
  type: number;
}

interface Stop {
  id: string;
  name: string;
  code?: string | null;
  lat?: number;
  lon?: number;
}

interface TerminusByRoute {
  [routeId: string]: {
    [directionId: string]: string;
  };
}

export default function DeparturesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [popularStops, setPopularStops] = useState<Stop[]>([]);
  const [terminusByRoute, setTerminusByRoute] = useState<TerminusByRoute>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch grouped routes from your API
        const routesResponse = await fetch('/api/routes/grouped');
        
        if (!routesResponse.ok) {
          throw new Error(`Failed to fetch routes: ${routesResponse.status}`);
        }
        
        const groupedRoutes = await routesResponse.json();
        // Transform grouped routes to match the format expected by DeparturesFinder
        const transformedRoutes = groupedRoutes.map((group: { directions: { id?: string; directionId: string; name: string }[]; id: string; number: string; name: string; color?: string | null; type: number }) => ({
          id: group.directions[0]?.id || group.id,
          shortName: group.number,
          longName: group.name,
          color: group.color,
          type: group.type
        }));
        
        // Extraction des données de terminus pour chaque route
        const terminusData: TerminusByRoute = {};
        groupedRoutes.forEach((group: { directions: { id?: string; directionId: string; name: string }[]; id: string }) => {
          const routeId = group.directions[0]?.id || group.id;
          terminusData[routeId] = {};
          
          group.directions.forEach((dir: { directionId: string; name: string }) => {
            terminusData[routeId][dir.directionId.toString()] = dir.name;
          });
        });

        setRoutes(transformedRoutes);
        setTerminusByRoute(terminusData);
        setPopularStops([]);
        setError(null);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement des données...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg">
          <h2 className="text-red-800 text-xl font-semibold mb-2">Erreur</h2>
          <p className="text-red-700">{error}</p>
          <p className="mt-4 text-red-600">Veuillez réessayer ultérieurement ou contacter le support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="grid gap-6">
        
        {/* Recherche avancée */}
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Recherche avancée</h2>
          <DeparturesFinder 
            initialRoutes={routes}
            initialPopularStops={popularStops}
            terminusByRoute={terminusByRoute}
          />
        </div>
      </div>
    </div>
  );
}