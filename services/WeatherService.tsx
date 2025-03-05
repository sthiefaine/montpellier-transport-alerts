// app/services/weatherService.ts
import axios from 'axios';

// Interface pour les données météo
export interface WeatherData {
  date: Date;
  hour?: number;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  humidity: number;
  cloudCover: number;
  weatherCode: number;
  weatherType: string;
  snowDepth?: number;
  snowfall?: number;
  isRain: boolean;
  isSnow: boolean;
  isFog: boolean;
  isStorm: boolean;
  location: string;
  latitude: number;
  longitude: number;
}

// Mapping des codes météo WMO vers des descriptions lisibles
const weatherCodeMap: { [key: number]: string } = {
  0: "Ciel dégagé",
  1: "Principalement dégagé",
  2: "Partiellement nuageux",
  3: "Nuageux",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine légère",
  53: "Bruine modérée",
  55: "Bruine dense",
  56: "Bruine verglaçante légère",
  57: "Bruine verglaçante dense",
  61: "Pluie légère",
  63: "Pluie modérée",
  65: "Pluie forte",
  66: "Pluie verglaçante légère",
  67: "Pluie verglaçante forte",
  71: "Neige légère",
  73: "Neige modérée",
  75: "Neige forte",
  77: "Grésil",
  80: "Averses de pluie légères",
  81: "Averses de pluie modérées",
  82: "Averses de pluie violentes",
  85: "Averses de neige légères",
  86: "Averses de neige fortes",
  95: "Orage",
  96: "Orage avec grêle légère",
  99: "Orage avec grêle forte"
};

// Paramètres par défaut pour les requêtes API
const defaultParams = {
  latitude: 0,
  longitude: 0,
  timezone: 'auto',
  hourly: 'temperature_2m,relative_humidity_2m,precipitation,rain,snowfall,snow_depth,weathercode,cloudcover,windspeed_10m',
  daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum',
  // Attribution requise pour utiliser l'API gratuitement
  'attribution_url': 'weather-api.example.com',
  'attribution_function': 'business',
};

/**
 * Récupère les données météo historiques
 * @param startDate Date de début (format YYYY-MM-DD)
 * @param endDate Date de fin (format YYYY-MM-DD)
 * @param latitude Latitude du lieu
 * @param longitude Longitude du lieu
 * @param location Identifiant de l'emplacement (ex: "city-center")
 * @returns Données météo formatées
 */
export async function getHistoricalWeather(
  startDate: string,
  endDate: string,
  latitude: number,
  longitude: number,
  location: string = 'default'
): Promise<WeatherData[]> {
  try {
    // Configuration de la requête
    const params = {
      ...defaultParams,
      latitude,
      longitude,
      start_date: startDate,
      end_date: endDate,
    };

    // Appel à l'API Open-Meteo
    const response = await axios.get('https://archive-api.open-meteo.com/v1/archive', { params });
    const data = response.data;

    // Vérification des erreurs
    if (data.error) {
      throw new Error(`Erreur Open-Meteo: ${data.reason}`);
    }

    return parseHourlyWeatherData(data, location, latitude, longitude);
  } catch (error) {
    console.error('Erreur lors de la récupération des données météo:', error);
    throw error;
  }
}

/**
 * Récupère les prévisions météo
 * @param latitude Latitude du lieu
 * @param longitude Longitude du lieu
 * @param location Identifiant de l'emplacement
 * @returns Données de prévision formatées
 */
export async function getForecast(
  latitude: number,
  longitude: number,
  location: string = 'default'
): Promise<WeatherData[]> {
  try {
    // Configuration de la requête
    const params = {
      ...defaultParams,
      latitude,
      longitude,
      forecast_days: 7, // Prévisions sur 7 jours
    };

    // Appel à l'API Open-Meteo
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', { params });
    const data = response.data;

    // Vérification des erreurs
    if (data.error) {
      throw new Error(`Erreur Open-Meteo: ${data.reason}`);
    }

    return parseHourlyWeatherData(data, location, latitude, longitude);
  } catch (error) {
    console.error('Erreur lors de la récupération des prévisions météo:', error);
    throw error;
  }
}

/**
 * Analyse les données horaires de la réponse API
 */
function parseHourlyWeatherData(
  data: any, 
  location: string,
  latitude: number,
  longitude: number
): WeatherData[] {
  const weatherData: WeatherData[] = [];

  if (data.hourly) {
    const hourly = data.hourly;
    const times = hourly.time;
    const temps = hourly.temperature_2m;
    const humidity = hourly.relative_humidity_2m;
    const precip = hourly.precipitation;
    const rain = hourly.rain;
    const snowfall = hourly.snowfall || Array(times.length).fill(0);
    const snowDepth = hourly.snow_depth || Array(times.length).fill(0);
    const codes = hourly.weathercode;
    const clouds = hourly.cloudcover;
    const wind = hourly.windspeed_10m;

    // Traiter chaque heure
    for (let i = 0; i < times.length; i++) {
      const timestamp = new Date(times[i]);
      const weatherCode = codes[i];
      
      // Déterminer les conditions météo
      const isRain = rain[i] > 0 || (weatherCode >= 51 && weatherCode <= 67) || 
                 (weatherCode >= 80 && weatherCode <= 82);
      const isSnow = snowfall[i] > 0 || (weatherCode >= 71 && weatherCode <= 77) || 
                 (weatherCode >= 85 && weatherCode <= 86);
      const isFog = weatherCode === 45 || weatherCode === 48;
      const isStorm = weatherCode >= 95 && weatherCode <= 99;

      weatherData.push({
        date: new Date(timestamp.toISOString().split('T')[0]),
        hour: timestamp.getHours(),
        temperature: temps[i],
        precipitation: precip[i],
        windSpeed: wind[i],
        humidity: humidity[i],
        cloudCover: clouds[i],
        weatherCode: weatherCode,
        weatherType: weatherCodeMap[weatherCode] || "Inconnu",
        snowDepth: snowDepth[i],
        snowfall: snowfall[i],
        isRain,
        isSnow,
        isFog,
        isStorm,
        location,
        latitude,
        longitude
      });
    }
  }

  return weatherData;
}

const weatherService = {
  getHistoricalWeather,
  getForecast
};

export default weatherService;