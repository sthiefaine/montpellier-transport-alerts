export interface Alert {
  id: string;
  timeStart: string | Date;
  timeEnd: string | Date | null;
  cause: AlertCause;
  effect: AlertEffect;
  headerText: string;
  descriptionText: string;
  url: string | null;
  routeIds: string | null;
  stopIds: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export enum AlertCause {
  UNKNOWN_CAUSE = "UNKNOWN_CAUSE",
  OTHER_CAUSE = "OTHER_CAUSE",
  TECHNICAL_PROBLEM = "TECHNICAL_PROBLEM",
  STRIKE = "STRIKE",
  DEMONSTRATION = "DEMONSTRATION",
  ACCIDENT = "ACCIDENT",
  HOLIDAY = "HOLIDAY",
  WEATHER = "WEATHER",
  MAINTENANCE = "MAINTENANCE",
  CONSTRUCTION = "CONSTRUCTION",
  POLICE_ACTIVITY = "POLICE_ACTIVITY",
  MEDICAL_EMERGENCY = "MEDICAL_EMERGENCY",
}

export enum AlertEffect {
  NO_SERVICE = "NO_SERVICE",
  REDUCED_SERVICE = "REDUCED_SERVICE",
  SIGNIFICANT_DELAYS = "SIGNIFICANT_DELAYS",
  DETOUR = "DETOUR",
  ADDITIONAL_SERVICE = "ADDITIONAL_SERVICE",
  MODIFIED_SERVICE = "MODIFIED_SERVICE",
  OTHER_EFFECT = "OTHER_EFFECT",
  UNKNOWN_EFFECT = "UNKNOWN_EFFECT",
  STOP_MOVED = "STOP_MOVED",
  NO_EFFECT = "NO_EFFECT",
  ACCESSIBILITY_ISSUE = "ACCESSIBILITY_ISSUE",
}

export interface AlertStats {
  activeCount: number;
  completedCount: number;
  totalCount: number;
  effectCounts: EffectCount[];
  causeCounts: CauseCount[];
  topRoutes: {
    routeIds: string;
    count: number;
  }[];
  includesComplements?: boolean;
}

export interface CauseCount {
  cause: AlertCause;
  causeLabel?: string;
  count: number;
}

export interface EffectCount {
  effect: AlertEffect;
  effectLabel?: string;
  count: number;
}

export interface RouteCount {
  routeIds: string;
  count: number;
}

export interface AlertFilters {
  active?: boolean;
  completed?: boolean;
  route?: string;
  stop?: string;
}
