import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertCause, AlertEffect } from './types';

// Fonctions pour obtenir des libellés lisibles pour les causes et effets
export function getAlertCauseLabel(cause: AlertCause): string {
  const labels: Record<AlertCause, string> = {
    [AlertCause.UNKNOWN_CAUSE]: 'Cause inconnue',
    [AlertCause.OTHER_CAUSE]: 'Autre cause',
    [AlertCause.TECHNICAL_PROBLEM]: 'Problème technique',
    [AlertCause.STRIKE]: 'Grève',
    [AlertCause.DEMONSTRATION]: 'Manifestation',
    [AlertCause.ACCIDENT]: 'Accident',
    [AlertCause.HOLIDAY]: 'Jour férié',
    [AlertCause.WEATHER]: 'Conditions météorologiques',
    [AlertCause.MAINTENANCE]: 'Maintenance',
    [AlertCause.CONSTRUCTION]: 'Travaux',
    [AlertCause.POLICE_ACTIVITY]: 'Activité policière',
    [AlertCause.MEDICAL_EMERGENCY]: 'Urgence médicale'
  };

  return labels[cause] || 'Inconnu';
}

export function getAlertEffectLabel(effect: AlertEffect): string {
  const labels: Record<AlertEffect, string> = {
    [AlertEffect.NO_SERVICE]: 'Aucun service',
    [AlertEffect.REDUCED_SERVICE]: 'Service réduit',
    [AlertEffect.SIGNIFICANT_DELAYS]: 'Retards importants',
    [AlertEffect.DETOUR]: 'Déviation',
    [AlertEffect.ADDITIONAL_SERVICE]: 'Service supplémentaire',
    [AlertEffect.MODIFIED_SERVICE]: 'Service modifié',
    [AlertEffect.OTHER_EFFECT]: 'Autre effet',
    [AlertEffect.UNKNOWN_EFFECT]: 'Effet inconnu',
    [AlertEffect.STOP_MOVED]: 'Arrêt déplacé',
    [AlertEffect.NO_EFFECT]: 'Aucun effet',
    [AlertEffect.ACCESSIBILITY_ISSUE]: 'Problème d\'accessibilité'
  };

  return labels[effect] || 'Inconnu';
}

// Fonction pour formater la date
export function formatDate(dateString: string | Date | null): string {
  if (!dateString) return 'Non défini';
  return format(new Date(dateString), 'dd MMMM yyyy à HH:mm', { locale: fr });
}

// Fonction pour déterminer la couleur en fonction de l'effet
export function getAlertColor(effect: string): string {
  switch (effect) {
    case 'NO_SERVICE':
    case 'SIGNIFICANT_DELAYS':
      return 'bg-red-100 border-red-500 text-red-800';
    case 'REDUCED_SERVICE':
    case 'DETOUR':
    case 'MODIFIED_SERVICE':
      return 'bg-orange-100 border-orange-500 text-orange-800';
    case 'ADDITIONAL_SERVICE':
      return 'bg-green-100 border-green-500 text-green-800';
    case 'STOP_MOVED':
    case 'ACCESSIBILITY_ISSUE':
      return 'bg-yellow-100 border-yellow-500 text-yellow-800';
    default:
      return 'bg-blue-100 border-blue-500 text-blue-800';
  }
}

// Fonction pour déterminer une couleur en fonction de la valeur (pour les graphiques)
export function getColorForValue(value: number): string {
  // Échelle de bleu, du plus clair au plus foncé
  if (value > 80) return '#0047AB'; // Bleu cobalt
  if (value > 60) return '#1E90FF'; // Bleu dodger
  if (value > 40) return '#00BFFF'; // Bleu ciel profond
  if (value > 20) return '#87CEEB'; // Bleu ciel
  return '#ADD8E6'; // Bleu clair
}