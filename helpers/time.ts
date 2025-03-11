// Formatter le retard pour l'affichage
export const formatDelay = (seconds: number | null) => {
  if (seconds === null) return "";

  if (seconds === 0) return "À l'heure";

  const absDelay = Math.abs(seconds);
  const isDelayed = seconds > 0;
  const prefix = isDelayed ? "Retard de " : "Avance de ";

  // Pour les petits délais (moins d'une minute), afficher en secondes
  if (absDelay < 60) {
    return `${prefix}${absDelay}s`;
  }

  // Pour les délais importants (plus d'une heure ou plusieurs minutes), 
  // utiliser le format hh:mm:ss ou mm:ss
  const formattedTime = formatSecondsToTime(absDelay);
  
  return `${prefix}${formattedTime}`;
};

export function formatSecondsToTime(seconds: number): string {
  // Pour les très petites valeurs, afficher avec une décimale
  if (Math.abs(seconds) > 0 && Math.abs(seconds) < 60) {
    const isNegative = seconds < 0;
    const absValue = Math.abs(seconds).toFixed(1);
    return isNegative ? `-${absValue}s` : `${absValue}s`;
  }
  
  // Le reste de votre fonction pour les valeurs plus grandes...
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  
  // Calculer heures, minutes, secondes
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const remainingSeconds = Math.floor(absSeconds % 60);
  
  // Créer les parties formatées avec padding
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  
  // Assembler la chaîne finale
  let result;
  if (hours > 0) {
    result = `${formattedHours}h${formattedMinutes}:${formattedSeconds}s`;
  } else {
    result = `${formattedMinutes}:${formattedSeconds}s`;
  }
  
  return isNegative ? `-${result}` : result;
}