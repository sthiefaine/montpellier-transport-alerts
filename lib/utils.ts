import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertCause, AlertEffect } from "./types";

export function getAlertCauseLabel(cause: AlertCause): string {
  const labels: Record<AlertCause, string> = {
    [AlertCause.UNKNOWN_CAUSE]: "Cause inconnue",
    [AlertCause.OTHER_CAUSE]: "Autre cause",
    [AlertCause.TECHNICAL_PROBLEM]: "Problème technique",
    [AlertCause.STRIKE]: "Grève",
    [AlertCause.DEMONSTRATION]: "Manifestation",
    [AlertCause.ACCIDENT]: "Accident",
    [AlertCause.HOLIDAY]: "Jour férié",
    [AlertCause.WEATHER]: "Conditions météorologiques",
    [AlertCause.MAINTENANCE]: "Maintenance",
    [AlertCause.CONSTRUCTION]: "Travaux",
    [AlertCause.POLICE_ACTIVITY]: "Activité policière",
    [AlertCause.MEDICAL_EMERGENCY]: "Urgence médicale",
    [AlertCause.TRAFFIC_JAM]: "Circulation difficile",
  };

  return labels[cause] || "Inconnu";
}

export function getAlertEffectLabel(effect: AlertEffect): string {
  const labels: Record<AlertEffect, string> = {
    [AlertEffect.NO_SERVICE]: "Aucun service",
    [AlertEffect.REDUCED_SERVICE]: "Service réduit",
    [AlertEffect.SIGNIFICANT_DELAYS]: "Retards importants",
    [AlertEffect.DETOUR]: "Déviation",
    [AlertEffect.ADDITIONAL_SERVICE]: "Service supplémentaire",
    [AlertEffect.MODIFIED_SERVICE]: "Service modifié",
    [AlertEffect.OTHER_EFFECT]: "Autre effet",
    [AlertEffect.UNKNOWN_EFFECT]: "Effet inconnu",
    [AlertEffect.STOP_MOVED]: "Arrêt déplacé",
    [AlertEffect.NO_EFFECT]: "Aucun effet",
    [AlertEffect.ACCESSIBILITY_ISSUE]: "Problème d'accessibilité",
  };

  return labels[effect] || "Inconnu";
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Non définie";

  const date = new Date(dateString);

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isThisWeek(date: Date): boolean {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6); // Saturday
  endOfWeek.setHours(23, 59, 59, 999);

  return date >= startOfWeek && date <= endOfWeek;
}

export function isThisMonth(date: Date): boolean {
  const today = new Date();
  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function getAlertColor(effect: string): string {
  switch (effect) {
    case "NO_SERVICE":
    case "SIGNIFICANT_DELAYS":
      return "bg-red-100 border-red-500 text-red-800";
    case "REDUCED_SERVICE":
    case "DETOUR":
    case "MODIFIED_SERVICE":
      return "bg-orange-100 border-orange-500 text-orange-800";
    case "ADDITIONAL_SERVICE":
      return "bg-green-100 border-green-500 text-green-800";
    case "STOP_MOVED":
    case "ACCESSIBILITY_ISSUE":
      return "bg-yellow-100 border-yellow-500 text-yellow-800";
    default:
      return "bg-blue-100 border-blue-500 text-blue-800";
  }
}

export function getColorForValue(value: number): string {
  if (value > 80) return "#0047AB";
  if (value > 60) return "#1E90FF";
  if (value > 40) return "#00BFFF";
  if (value > 20) return "#87CEEB";
  return "#ADD8E6";
}
