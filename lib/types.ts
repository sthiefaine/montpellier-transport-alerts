// Types pour les alertes
export interface Alert {
  id: string;
  timeStart: string | Date; // ISO date string ou objet Date
  timeEnd: string | Date | null; // ISO date string ou objet Date
  cause: AlertCause;
  effect: AlertEffect;
  headerText: string;
  descriptionText: string;
  url: string | null;
  routeIds: string | null;
  stopIds: string | null;
  createdAt: string | Date; // ISO date string ou objet Date
  updatedAt: string | Date; // ISO date string ou objet Date
}

// Énumérations pour les causes et effets possibles
export enum AlertCause {
  UNKNOWN_CAUSE = 'UNKNOWN_CAUSE',
  OTHER_CAUSE = 'OTHER_CAUSE',
  TECHNICAL_PROBLEM = 'TECHNICAL_PROBLEM',
  STRIKE = 'STRIKE',
  DEMONSTRATION = 'DEMONSTRATION',
  ACCIDENT = 'ACCIDENT',
  HOLIDAY = 'HOLIDAY',
  WEATHER = 'WEATHER',
  MAINTENANCE = 'MAINTENANCE',
  CONSTRUCTION = 'CONSTRUCTION',
  POLICE_ACTIVITY = 'POLICE_ACTIVITY',
  MEDICAL_EMERGENCY = 'MEDICAL_EMERGENCY'
}

export enum AlertEffect {
  NO_SERVICE = 'NO_SERVICE',
  REDUCED_SERVICE = 'REDUCED_SERVICE',
  SIGNIFICANT_DELAYS = 'SIGNIFICANT_DELAYS',
  DETOUR = 'DETOUR',
  ADDITIONAL_SERVICE = 'ADDITIONAL_SERVICE',
  MODIFIED_SERVICE = 'MODIFIED_SERVICE',
  OTHER_EFFECT = 'OTHER_EFFECT',
  UNKNOWN_EFFECT = 'UNKNOWN_EFFECT',
  STOP_MOVED = 'STOP_MOVED',
  NO_EFFECT = 'NO_EFFECT',
  ACCESSIBILITY_ISSUE = 'ACCESSIBILITY_ISSUE'
}

// Types pour les statistiques
export interface AlertStats {
  activeCount: number;
  completedCount: number;
  totalCount: number;
  effectCounts: EffectCount[];
  topRoutes: RouteCount[];
}

export interface EffectCount {
  effect: AlertEffect;
  count: number;
}

export interface RouteCount {
  routeIds: string;
  count: number;
}

// Types pour les filtres
export interface AlertFilters {
  active?: boolean;
  completed?: boolean;
  route?: string;
  stop?: string;
}