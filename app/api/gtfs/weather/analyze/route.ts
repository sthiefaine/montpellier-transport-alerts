// app/api/gtfs/weather/analyze/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import WeatherCorrelationService from "@/services/WeatherCorrelationService";

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

// API pour analyser l'impact de la météo
export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const daysParam = url.searchParams.get('days') || '1';
    
    // Déterminer la période d'analyse
    const targetDates: Date[] = [];
    
    if (dateParam) {
      // Analyser une date spécifique
      const targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: "Format de date invalide" },
          { status: 400 }
        );
      }
      targetDates.push(targetDate);
    } else {
      // Analyser les N derniers jours
      const days = parseInt(daysParam, 10);
      if (isNaN(days) || days <= 0 || days > 30) {
        return NextResponse.json(
          { error: "Paramètre 'days' invalide. Doit être entre 1 et 30." },
          { status: 400 }
        );
      }
      
      // Générer les dates à analyser
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 1; i <= days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        targetDates.push(date);
      }
    }
    
    console.log(`Analyse de l'impact météo pour ${targetDates.length} jour(s)`);
    
    // Lancer l'analyse pour chaque date
    const results = [];
    
    for (const date of targetDates) {
      const dateStr = date.toISOString().split('T')[0];
      console.log(`Traitement de la date: ${dateStr}`);
      
      try {
        // Analyser l'impact météo
        await WeatherCorrelationService.analyzeWeatherImpact(date);
        
        // Récupérer un résumé des corrélations créées
        const dailyCorrelations = await prisma.dailyWeatherImpact.count({
          where: {
            dailyMetric: {
              date: date
            }
          }
        });
        
        const hourlyCorrelations = await prisma.hourlyWeatherImpact.count({
          where: {
            hourlyMetric: {
              date: date
            }
          }
        });
        
        results.push({
          date: dateStr,
          dailyCorrelations,
          hourlyCorrelations,
          status: "success"
        });
      } catch (error) {
        results.push({
          date: dateStr,
          error: error instanceof Error ? error.message : "Erreur inconnue",
          status: "error"
        });
      }
    }
    
    return NextResponse.json({
      status: "success",
      dates: results,
      message: `Analyse de l'impact météo terminée pour ${targetDates.length} jour(s)`
    });
  } catch (error) {
    console.error("Erreur lors de l'analyse de l'impact météo:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}