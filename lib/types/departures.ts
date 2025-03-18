export interface EnhancedStop {
  id: string;
  name: string;
  code?: string | null;
  lat?: number;
  lon?: number;
  position: number;
  directionId: number;
  isTerminus?: boolean;
  routeId?: string;
  headsign?: string | null;
  // Informations additionnelles de StopsList
  lignesPassantes?: string | null;
  lignesEtDirections?: string | null;
  station?: string | null;
  commune?: string | null;
  source?: 'tram' | 'bus' | null;
}

export interface Route {
  id: string;
  shortName: string;
  longName: string;
  color?: string | null;
  type: number;
  routeId?: string;
  // Added properties that might be in the API response
  number?: string;
  name?: string;
  alternativeIds?: string[];
  routeIds?: string[];
  directions?: {
    id: string;
    name: string;
    directionId: number;
    allRouteIds?: string[];
  }[];
}

export interface TerminusByRoute {
  [routeId: string]: {
    [directionId: string]: string;
  };
}

// Simplified version of Stop for the component props
export interface Stop extends Partial<EnhancedStop> {
  id: string;
  name: string;
}

export interface DeparturesFinderProps {
  initialRoutes: Route[];
  initialPopularStops: Stop[];
  terminusByRoute: TerminusByRoute;
}