export interface IncidentData {
  [date: string]: number;
}

export interface ErrorLabels {
  [level: number]: string;
}

export interface DayItem {
  date: Date;
  dateStr: string;
  isFirstOfMonth: boolean;
  isFirstMondayOfMonth: boolean;
  incidentLevel: number;
  monthName: string;
}

export interface WeekDays {
  weekIndex: number;
  days: DayItem[];
}

export interface IncidentCalendarProps {
  data?: IncidentData;
  year?: number;
  colorScale?: string[];
  emptyColor?: string;
  errorLabels?: ErrorLabels;
}
