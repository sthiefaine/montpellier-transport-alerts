// app/api/gtfs/weather/collect/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import WeatherService from "@/services/WeatherService";

const prisma = new PrismaClient();
const CRON_SECRET = process.env.CRON_SECRET;

// Fonction pour vérifier l'authentification
function validateAuth(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === CRON_SECRET;
}

// Configuration des lieux à surveiller
// Vous pouvez ajouter plusieurs emplacements si votre réseau couvre une grande zone
const LOCATIONS = [
  {
    id: "city-center",
    name: "Centre-ville",
    latitude: 43.6108, // Remplacez par les coordonnées de votre ville
    longitude: 3.8767  // Exemple pour Montpellier
  }
];

// Récupérer les données méteo historiques pour les derniers jours
export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const daysParam = url.searchParams.get('days') || '7';
    const days = parseInt(daysParam, 10);
    
    if (isNaN(days) || days <= 0 || days > 92) { // Open-Meteo limite à ~3 mois d'historique
      return NextResponse.json({ 
        error: "Paramètre 'days' invalide. Doit être entre 1 et 92." 
      }, { status: 400 });
    }
    
    // Calculer les dates pour la plage de récupération
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`Récupération des données météo du ${startDateStr} au ${endDateStr}`);
    
    // Récupérer les données pour chaque emplacement
    const results = [];
    
    for (const location of LOCATIONS) {
      console.log(`Traitement de l'emplacement: ${location.name}`);
      
      // Récupérer les données météo historiques
      const weatherData = await WeatherService.getHistoricalWeather(
        startDateStr,
        endDateStr,
        location.latitude,
        location.longitude,
        location.id
      );
      
      console.log(`${weatherData.length} points de données récupérés pour ${location.id}`);
      
      // Insérer ou mettre à jour les données dans la base de données
      const savedRecords = await saveWeatherData(weatherData);
      
      results.push({
        location: location.id,
        dataPoints: weatherData.length,
        saved: savedRecords
      });
    }
    
    return NextResponse.json({
      status: "success",
      period: {
        start: startDateStr,
        end: endDateStr
      },
      locations: results,
      message: "Données météo récupérées avec succès"
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des données météo:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Sauvegarder les données météo
async function saveWeatherData(weatherData: any[]): Promise<number> {
  let savedCount = 0;
  
  // Traiter par lots pour éviter les problèmes de performance
  const batchSize = 100;
  
  for (let i = 0; i < weatherData.length; i += batchSize) {
    const batch = weatherData.slice(i, i + batchSize);
    
    const operations = batch.map(data => {
      return prisma.weatherData.upsert({
        where: {
          date_hour_location: {
            date: data.date,
            hour: data.hour || 0,
            location: data.location
          }
        },
        update: {
          temperature: data.temperature,
          precipitation: data.precipitation,
          windSpeed: data.windSpeed,
          humidity: data.humidity,
          cloudCover: data.cloudCover,
          weatherCode: data.weatherCode,
          weatherType: data.weatherType,
          snowDepth: data.snowDepth || null,
          snowfall: data.snowfall || null,
          isRain: data.isRain,
          isSnow: data.isSnow,
          isFog: data.isFog,
          isStorm: data.isStorm,
          latitude: data.latitude,
          longitude: data.longitude
        },
        create: {
          date: data.date,
          hour: data.hour || 0,
          temperature: data.temperature,
          precipitation: data.precipitation,
          windSpeed: data.windSpeed,
          humidity: data.humidity,
          cloudCover: data.cloudCover,
          weatherCode: data.weatherCode,
          weatherType: data.weatherType,
          snowDepth: data.snowDepth || null,
          snowfall: data.snowfall || null,
          isRain: data.isRain,
          isSnow: data.isSnow,
          isFog: data.isFog,
          isStorm: data.isStorm,
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude
        }
      });
    });
    
    const results = await prisma.$transaction(operations);
    savedCount += results.length;
  }
  
  return savedCount;
}