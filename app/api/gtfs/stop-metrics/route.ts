// app/api/gtfs/stop-metrics/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get("timeframe") || "today";
    const stopId = url.searchParams.get("stopId");
    const routeId = url.searchParams.get("routeId");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const minObservations = parseInt(url.searchParams.get("minObservations") || "10");
    const day = url.searchParams.get("day");
    const hour = url.searchParams.get("hour") ? parseInt(url.searchParams.get("hour") || "0") : undefined;

    console.log(`Récupération des métriques par arrêt - Période: ${timeframe}${stopId ? `, Arrêt: ${stopId}` : ''}${routeId ? `, Ligne: ${routeId}` : ''}`);

    // Déterminer la date de début en fonction du timeframe
    let startDate = new Date();
    if (day) {
      // Date spécifique au format YYYY-MM-DD
      startDate = new Date(day);
      if (isNaN(startDate.getTime())) {
        // Si la date n'est pas valide, utiliser aujourd'hui
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
      }
    } else if (timeframe === "today") {
      // Début de la journée actuelle
      startDate.setHours(0, 0, 0, 0);
    } else if (timeframe === "yesterday") {
      // Hier
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeframe === "week") {
      // 7 jours en arrière
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeframe === "month") {
      // 30 jours en arrière
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    // Construire la condition where de base
    const whereCondition: any = {
      date: {
        gte: startDate
      },
      observations: {
        gte: minObservations
      }
    };

    // Ajouter les filtres optionnels
    if (stopId) whereCondition.stopId = stopId;
    if (routeId) {
      // Actuellement, HourlyStopMetric n'a pas de routeId
      // Cette requête devra être adaptée à votre modèle exact
      console.warn("Filtrage par routeId non disponible avec HourlyStopMetric");
    }
    if (hour !== undefined) whereCondition.hour = hour;

    // Récupérer les métriques agrégées par arrêt
    const stopMetrics = await prisma.hourlyStopMetric.groupBy({
      by: ['stopId'],
      where: whereCondition,
      _sum: {
        observations: true,
      },
      _avg: {
        avgDelay: true,
        earlyRate60: true,
        onTimeRate60: true,
        lateRate60: true,
        delayUnder30s: true,
        delay30to60s: true,
        delay60to120s: true,
        delay120to300s: true,
        delayOver300s: true
      },
      _min: {
        minDelay: true
      },
      _max: {
        maxDelay: true
      },
      orderBy: {
        _sum: {
          observations: 'desc'
        }
      },
      take: limit
    });

    // Filtre a posteriori pour le seuil minimum d'observations
    // (au lieu d'utiliser having qui a une syntaxe complexe)
    const filteredMetrics = stopMetrics.filter(metric => 
      (metric._sum.observations || 0) >= minObservations
    );

    // Si aucune donnée, retourner un tableau vide
    if (filteredMetrics.length === 0) {
      return NextResponse.json([]);
    }

    // Récupérer les détails des arrêts
    const stopIds = filteredMetrics.map(metric => metric.stopId);
    const stops = await prisma.stop.findMany({
      where: {
        id: {
          in: stopIds
        }
      },
      select: {
        id: true,
        name: true,
        code: true
      }
    });

    // Créer un dictionnaire pour un accès rapide
    const stopMap = new Map(stops.map(stop => [stop.id, stop]));

    // Construire la réponse finale
    const formattedResults = filteredMetrics.map(metric => {
      const stopInfo = stopMap.get(metric.stopId) || { name: 'Unknown', code: null };
      
      // Calculer la ponctualité totale (early + onTime)
      const earlyRate = metric._avg.earlyRate60 || 0;
      const onTimeRate = metric._avg.onTimeRate60 || 0;
      const punctualityRate = earlyRate + onTimeRate;
      
      // Calculer la valeur exacte du retard moyen
      let avgDelay = metric._avg.avgDelay || 0;
      // Arrondir à 0 les très petites valeurs
      if (Math.abs(avgDelay) < 0.5) {
        avgDelay = 0;
      } else {
        // Sinon, préserver une décimale
        avgDelay = parseFloat(avgDelay.toFixed(1));
      }

      return {
        id: metric.stopId,
        name: stopInfo.name,
        code: stopInfo.code,
        avg_delay_seconds: avgDelay,
        punctuality_percentage: parseFloat((punctualityRate * 100).toFixed(1)),
        observations: metric._sum.observations || 0,
        early_percentage: parseFloat((earlyRate * 100).toFixed(1)),
        on_time_percentage: parseFloat((onTimeRate * 100).toFixed(1)),
        late_percentage: parseFloat(((metric._avg.lateRate60 || 0) * 100).toFixed(1)),
        // Données pour le débogage
        min_delay: metric._min.minDelay || 0,
        max_delay: metric._max.maxDelay || 0,
        _debug: {
          delayDistribution: {
            under30s: parseFloat(((metric._avg.delayUnder30s || 0) * 100).toFixed(1)),
            delay30to60s: parseFloat(((metric._avg.delay30to60s || 0) * 100).toFixed(1)),
            delay60to120s: parseFloat(((metric._avg.delay60to120s || 0) * 100).toFixed(1)),
            delay120to300s: parseFloat(((metric._avg.delay120to300s || 0) * 100).toFixed(1)),
            over300s: parseFloat(((metric._avg.delayOver300s || 0) * 100).toFixed(1))
          }
        }
      };
    });

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error("Erreur API stop-metrics:", error);
    if (error instanceof Error) {
      console.error("Message d'erreur:", error.message);
      console.error("Stack trace:", error.stack);
    }
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}