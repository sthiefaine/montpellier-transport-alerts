
export interface StopGeometry {
  type: string; 
  coordinates: [number, number]; 
}

export interface StopProperties {
  description: string;
  lignes_passantes: string;
  lignes_et_directions: string;
  station: string;
  commune: string;
}

export interface StopFeature {
  type: string; 
  geometry: StopGeometry;
  properties: StopProperties;
}

export interface StopsJsonResponse {
  type: string;
  name: string;
  features: StopFeature[];
}

export interface StopsListEntry {
  id?: number;
  description: string;
  lon: number;
  lat: number;
  lignesPassantes: string | null;
  lignesEtDirections: string | null;
  station: string | null;
  commune: string | null;
  source: 'tram' | 'bus';
  stopId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StopData {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface StopsListResponse {
  data: StopsListEntry[];
  meta: PaginationMeta;
}

export interface StopsListUpdateItem {
  id: number;
  stopId: string;
}

export interface StopsStats {
  total: number;
  tram: number;
  bus: number;
  matched: number;
  matchRate: string;
  communes: Array<{
    name: string | null;
    count: number;
  }>;
  lignes: string[];
}

export interface ImportStopsResponse {
  status: string;
  message: string;
  stats: {
    imported: number;
    matched: number;
    total: number;
  };
}

export interface StopsListFilter {
  source?: 'tram' | 'bus';
  commune?: string;
  lignesPassantes?: {
    contains: string;
  };
  description?: {
    contains: string;
    mode: 'insensitive';
  };
  lat?: {
    gte: number;
    lte: number;
  };
  lon?: {
    gte: number;
    lte: number;
  };
}