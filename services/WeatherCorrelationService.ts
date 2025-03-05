// app/services/WeatherCorrelationService.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Analyse la corrélation entre la météo et les performances pour une date donnée
 * @param date Date à analyser
 */
const analyzeWeatherImpact = async (date: Date): Promise<void> => {
  try {
    console.log(
      `Analyse de l'impact météo pour le ${date.toISOString().split("T")[0]}`
    );

    // 1. Supprimer les anciennes analyses pour cette date
    await clearPreviousAnalysis(date);

    // 2. Analyser les corrélations quotidiennes
    await analyzeDailyCorrelations(date);

    // 3. Analyser les corrélations horaires
    await analyzeHourlyCorrelations(date);

    console.log("Analyse de l'impact météo terminée");
  } catch (error) {
    console.error("Erreur lors de l'analyse de l'impact météo:", error);
    throw error;
  }
};

/**
 * Supprime les analyses précédentes pour éviter les doublons
 */
const clearPreviousAnalysis = async (date: Date): Promise<void> => {
  // Supprimer les corrélations quotidiennes
  await prisma.dailyWeatherImpact.deleteMany({
    where: {
      dailyMetric: {
        date: date,
      },
    },
  });

  // Supprimer les corrélations horaires
  await prisma.hourlyWeatherImpact.deleteMany({
    where: {
      hourlyMetric: {
        date: date,
      },
    },
  });
};

/**
 * Analyse les corrélations au niveau journalier
 */
const analyzeDailyCorrelations = async (date: Date): Promise<void> => {
  // Récupérer toutes les métriques quotidiennes pour cette date
  const dailyMetrics = await prisma.dailyMetric.findMany({
    where: {
      date: date,
    },
  });

  if (dailyMetrics.length === 0) {
    console.log("Aucune métrique quotidienne trouvée pour cette date");
    return;
  }

  // Récupérer les données météo quotidiennes pour cette date
  const weatherData = await prisma.weatherData.findMany({
    where: {
      date: date,
      hour: {
        lte: 20, // Prendre les données jusqu'à 20h pour avoir une vue complète de la journée
        gte: 6, // Commencer à 6h pour couvrir les heures de service
      },
    },
    orderBy: {
      hour: "asc",
    },
  });

  if (weatherData.length === 0) {
    console.log("Aucune donnée météo trouvée pour cette date");
    return;
  }

  // Agréger les données météo pour avoir une vue d'ensemble de la journée
  const aggregatedWeather = aggregateWeatherData(weatherData);

  // Pour chaque métrique, calculer l'impact de la météo
  for (const metric of dailyMetrics) {
    for (const weather of aggregatedWeather) {
      // Calculer un score d'impact basé sur différents facteurs météo
      const impactScore = calculateWeatherImpact(metric, weather);

      // Enregistrer la corrélation
      await prisma.dailyWeatherImpact.create({
        data: {
          dailyMetricId: metric.id,
          weatherId: weather.id,
          impactScore,
        },
      });
    }
  }

  console.log(`${dailyMetrics.length} métriques quotidiennes analysées`);
};

/**
 * Analyse les corrélations au niveau horaire
 */
const analyzeHourlyCorrelations = async (date: Date): Promise<void> => {
  // Récupérer toutes les métriques horaires pour cette date
  const hourlyMetrics = await prisma.hourlyMetric.findMany({
    where: {
      date: date,
    },
  });

  if (hourlyMetrics.length === 0) {
    console.log("Aucune métrique horaire trouvée pour cette date");
    return;
  }

  // Pour chaque heure, établir une corrélation
  let correlationsCreated = 0;

  for (const metric of hourlyMetrics) {
    // Récupérer les données météo pour cette même heure
    const weatherData = await prisma.weatherData.findMany({
      where: {
        date: date,
        hour: metric.hour,
      },
    });

    if (weatherData.length === 0) continue;

    for (const weather of weatherData) {
      // Calculer un score d'impact basé sur les conditions météo
      const impactScore = calculateHourlyWeatherImpact(metric, weather);

      // Enregistrer la corrélation
      await prisma.hourlyWeatherImpact.create({
        data: {
          hourlyMetricId: metric.id,
          weatherId: weather.id,
          impactScore,
        },
      });

      correlationsCreated++;
    }
  }

  console.log(`${correlationsCreated} corrélations horaires créées`);
};

/**
 * Agrège les données météo horaires en données journalières
 */
const aggregateWeatherData = (weatherData: any[]): any[] => {
  // Regrouper par location
  const locationGroups: { [key: string]: any[] } = {};

  weatherData.forEach((data) => {
    if (!locationGroups[data.location]) {
      locationGroups[data.location] = [];
    }
    locationGroups[data.location].push(data);
  });

  // Pour chaque emplacement, créer une agrégation
  const aggregatedData = [];

  for (const location in locationGroups) {
    const locationData = locationGroups[location];

    // Agréger les données pour ce lieu
    aggregatedData.push({
      id: locationData[0].id, // Utiliser l'ID du premier enregistrement
      location: location,
      date: locationData[0].date,
      hour: null, // Null pour indiquer une agrégation journalière
      temperature: average(locationData.map((d) => d.temperature)),
      precipitation: sum(locationData.map((d) => d.precipitation)),
      windSpeed: average(locationData.map((d) => d.windSpeed)),
      humidity: average(locationData.map((d) => d.humidity)),
      cloudCover: average(locationData.map((d) => d.cloudCover)),
      weatherCode: mostFrequent(locationData.map((d) => d.weatherCode)),
      weatherType: determineOverallWeatherType(locationData),
      isRain: locationData.some((d) => d.isRain),
      isSnow: locationData.some((d) => d.isSnow),
      isFog: locationData.some((d) => d.isFog),
      isStorm: locationData.some((d) => d.isStorm),
    });
  }

  return aggregatedData;
};

/**
 * Calcule la corrélation entre la météo et les performances quotidiennes
 */
const calculateWeatherImpact = (metric: any, weather: any): number => {
  // Ici, nous implémentons une logique simplifiée pour estimer l'impact de la météo
  // Des algorithmes plus sophistiqués pourraient utiliser l'apprentissage automatique

  let impact = 0;

  // Impact des précipitations
  if (weather.precipitation > 0) {
    // Les précipitations ont généralement un impact négatif
    // Plus elles sont importantes, plus l'impact est fort
    const precipitationImpact = Math.min(weather.precipitation / 10, 1);
    impact += precipitationImpact * 0.3; // Pondération de 30% pour les précipitations
  }

  // Impact de la neige (plus fort que la pluie)
  if (weather.isSnow) {
    impact += 0.4; // Impact significatif
  }

  // Impact du brouillard
  if (weather.isFog) {
    impact += 0.2;
  }

  // Impact des orages
  if (weather.isStorm) {
    impact += 0.3;
  }

  // Impact de la température (froid extrême ou chaleur extrême)
  const tempImpact = calculateTemperatureImpact(weather.temperature);
  impact += tempImpact * 0.2; // Pondération de 20%

  // Normaliser l'impact entre 0 et 1
  impact = Math.min(Math.max(impact, 0), 1);

  // Vérifier si les performances sont corrélées à la météo
  // Un retard élevé avec un impact météo élevé renforce la corrélation
  const performanceCorrelation = correlateWeatherWithPerformance(
    metric,
    impact
  );

  return performanceCorrelation;
};

/**
 * Calcule la corrélation entre la météo et les performances horaires
 */
const calculateHourlyWeatherImpact = (metric: any, weather: any): number => {
  // Logique similaire à la méthode quotidienne, mais plus directe
  // car il n'y a pas d'agrégation

  let impact = 0;

  // Impact direct des précipitations horaires
  if (weather.precipitation > 0) {
    impact += Math.min(weather.precipitation / 5, 1) * 0.4; // Pondération plus forte pour les données horaires
  }

  // Impact des conditions extrêmes
  if (weather.isSnow) impact += 0.5;
  if (weather.isFog) impact += 0.3;
  if (weather.isStorm) impact += 0.4;

  // Impact du vent
  if (weather.windSpeed > 30) {
    // Vent fort > 30 km/h
    impact += 0.2;
  }

  // Impact de la température
  impact += calculateTemperatureImpact(weather.temperature) * 0.2;

  // Normaliser
  impact = Math.min(Math.max(impact, 0), 1);

  // Corréler avec les performances
  const performanceCorrelation = correlateWeatherWithPerformance(
    metric,
    impact
  );

  return performanceCorrelation;
};

/**
 * Calcule l'impact de la température
 */
const calculateTemperatureImpact = (temperature: number): number => {
  // Température idéale considérée entre 10°C et 25°C
  if (temperature >= 10 && temperature <= 25) {
    return 0; // Pas d'impact négatif
  }

  // Impact du froid
  if (temperature < 10) {
    return Math.min((10 - temperature) / 10, 1); // Impact augmente quand température baisse
  }

  // Impact de la chaleur
  if (temperature > 25) {
    return Math.min((temperature - 25) / 15, 1); // Impact augmente avec la chaleur
  }

  return 0;
};

/**
 * Corrèle l'impact météo avec les performances observées
 */
const correlateWeatherWithPerformance = (
  metric: any,
  weatherImpact: number
): number => {
  // Normaliser le retard moyen pour avoir une base comparable
  // Échelle arbitraire: considérer qu'un retard de 5 minutes = impact max (1.0)
  const normalizedDelay = Math.min(metric.avgDelay / 300, 1);

  // Si l'impact météo et le retard sont tous deux élevés, forte corrélation
  // Si l'impact météo est élevé mais le retard faible, faible corrélation (bonne résilience)
  // Si l'impact météo est faible mais le retard élevé, faible corrélation (autres causes de retard)

  // Calculer la corrélation comme une fonction de similarité entre les deux valeurs
  // 1 - la différence absolue donne une valeur élevée quand les deux sont proches
  const directCorrelation = 1 - Math.abs(normalizedDelay - weatherImpact);

  // Ajuster en fonction du taux de ponctualité (une ligne avec une ponctualité élevée
  // malgré des conditions météo difficiles est moins impactée)
  const onTimeRate = metric.onTimeRate60 / 100; // Convertir en valeur 0-1

  // Une formule qui prend en compte ces facteurs
  const finalCorrelation =
    directCorrelation * 0.7 + (1 - onTimeRate) * weatherImpact * 0.3;

  return Math.min(Math.max(finalCorrelation, 0), 1);
};

/**
 * Détermine le type météo dominant pour la journée
 */
const determineOverallWeatherType = (weatherData: any[]): string => {
  // Compter l'occurrence de chaque type de temps
  const typeCounts: { [key: string]: number } = {};

  weatherData.forEach((data) => {
    if (!typeCounts[data.weatherType]) {
      typeCounts[data.weatherType] = 0;
    }
    typeCounts[data.weatherType]++;
  });

  // Trouver le type le plus fréquent
  let maxCount = 0;
  let dominantType = "Inconnu";

  for (const type in typeCounts) {
    if (typeCounts[type] > maxCount) {
      maxCount = typeCounts[type];
      dominantType = type;
    }
  }

  return dominantType;
};

// Fonctions utilitaires
const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

const sum = (values: number[]): number => {
  return values.reduce((sum, val) => sum + val, 0);
};

const mostFrequent = (values: any[]): any => {
  if (values.length === 0) return null;

  const counts: { [key: string]: number } = {};
  let maxCount = 0;
  let mostFrequent = values[0];

  values.forEach((value) => {
    const key = String(value);
    counts[key] = (counts[key] || 0) + 1;

    if (counts[key] > maxCount) {
      maxCount = counts[key];
      mostFrequent = value;
    }
  });

  return mostFrequent;
};

// Création de l'objet service
const weatherCorrelationService = {
  analyzeWeatherImpact,
};

export default weatherCorrelationService;
