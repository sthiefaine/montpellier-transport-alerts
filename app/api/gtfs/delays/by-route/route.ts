// app/api/gtfs/delays/by-route/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get("timeframe") || "today";
    const punctualityThreshold = url.searchParams.get("threshold") || "60";

    console.log(`Récupération des statistiques de ponctualité pour la période: ${timeframe} (seuil: ${punctualityThreshold}s)`);

    // Déterminer la date de début en fonction du timeframe
    let startDate = new Date();
    if (timeframe === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }

    // Récupérer toutes les données pour un traitement manuel plus détaillé
    const hourlyMetrics = await prisma.hourlyMetric.findMany({
      select: {
        routeId: true,
        avgDelay: true,
        observations: true,
        onTimeRate30: true,
        onTimeRate60: true,
        onTimeRate120: true,
        lateRate30: true,
        lateRate60: true,
        lateRate120: true,
        earlyRate30: true,
        earlyRate60: true,
        earlyRate120: true,
        // Inclure d'autres métriques de retard
        delayUnder30s: true,
        delay30to60s: true,
        delay60to120s: true,
        delay120to300s: true,
        delayOver300s: true,
      },
      where: {
        date: {
          gte: startDate
        },
        observations: {
          gt: 0 // S'assurer qu'il y a des observations
        }
      }
    });

    console.log(`Nombre total d'entrées horaires récupérées: ${hourlyMetrics.length}`);

    // Calculer manuellement les statistiques par ligne
    const routeStats = new Map();

    hourlyMetrics.forEach(metric => {
      const routeId = metric.routeId;
      
      if (!routeStats.has(routeId)) {
        routeStats.set(routeId, {
          totalObservations: 0,
          totalDelaySum: 0,
          totalDelay: 0,
          onTimeSum: 0,
          lateSum: 0,
          earlySum: 0,
          // Sommes des distributions de retard pour calculer un retard moyen
          delayUnder30s: 0,
          delay30to60s: 0,
          delay60to120s: 0,
          delay120to300s: 0,
          delayOver300s: 0,
        });
      }
      
      const stats = routeStats.get(routeId);
      
      // Accumuler les observations
      stats.totalObservations += metric.observations;
      
      // Accumuler les délais (s'ils ne sont pas zéro)
      if (metric.avgDelay !== 0) {
        stats.totalDelaySum += metric.avgDelay * metric.observations;
      }
      
      // Accumuler les taux de ponctualité selon le seuil choisi
      let onTimeRate, lateRate, earlyRate;
      switch (punctualityThreshold) {
        case "30":
          onTimeRate = metric.onTimeRate30;
          lateRate = metric.lateRate30;
          earlyRate = metric.earlyRate30;
          break;
        case "120":
          onTimeRate = metric.onTimeRate120;
          lateRate = metric.lateRate120;
          earlyRate = metric.earlyRate120;
          break;
        default:
          onTimeRate = metric.onTimeRate60;
          lateRate = metric.lateRate60;
          earlyRate = metric.earlyRate60;
      }
      
      stats.onTimeSum += onTimeRate * metric.observations;
      stats.lateSum += lateRate * metric.observations;
      stats.earlySum += earlyRate * metric.observations;
      
      // Accumuler les distributions de retard pour un calcul alternatif
      stats.delayUnder30s += metric.delayUnder30s;
      stats.delay30to60s += metric.delay30to60s;
      stats.delay60to120s += metric.delay60to120s;
      stats.delay120to300s += metric.delay120to300s;
      stats.delayOver300s += metric.delayOver300s;
    });

    // Calculer un délai moyen alternatif basé sur les distributions
    routeStats.forEach(stats => {
      const totalDistributionSum = 
        stats.delayUnder30s + 
        stats.delay30to60s + 
        stats.delay60to120s + 
        stats.delay120to300s + 
        stats.delayOver300s;
        
      if (totalDistributionSum > 0) {
        // Calculer un délai moyen pondéré basé sur les points médians des intervalles
        stats.totalDelay = (
          stats.delayUnder30s * 15 +          // Médiane ~15s
          stats.delay30to60s * 45 +           // Médiane ~45s
          stats.delay60to120s * 90 +          // Médiane ~90s
          stats.delay120to300s * 210 +        // Médiane ~210s
          stats.delayOver300s * 450           // Valeur arbitraire ~450s
        ) / totalDistributionSum;
      }
    });

    // Récupérer les informations sur les routes
    const routeIds = Array.from(routeStats.keys());
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        shortName: true,
        longName: true,
        color: true,
      },
      where: {
        id: {
          in: routeIds
        }
      }
    });

    // Construire les résultats finaux
    const formattedResults = routeIds
      .map(routeId => {
        const route = routes.find(r => r.id === routeId);
        const stats = routeStats.get(routeId);
        
        if (!route || stats.totalObservations < 10) return null;

        // Calculer les moyennes pondérées
        const avgDelay = stats.totalObservations > 0 ? stats.totalDelaySum / stats.totalObservations : 0;
        const onTimeRate = stats.totalObservations > 0 ? stats.onTimeSum / stats.totalObservations : 0;
        const lateRate = stats.totalObservations > 0 ? stats.lateSum / stats.totalObservations : 0;
        const earlyRate = stats.totalObservations > 0 ? stats.earlySum / stats.totalObservations : 0;
        
        // Utiliser le délai calculé à partir des distributions si avgDelay est 0
        const finalDelay = avgDelay !== 0 ? avgDelay : stats.totalDelay;

        return {
          route_number: route.shortName || "",
          route_name: route.longName || "",
          color: route.color ? `#${route.color}` : "#ccc",
          avg_delay_seconds: Number(finalDelay.toFixed(1)),
          punctuality_percentage: Number((onTimeRate * 100).toFixed(1)),
          observations: stats.totalObservations,
          early_percentage: Number((earlyRate * 100).toFixed(1)),
          late_percentage: Number((lateRate * 100).toFixed(1)),
          _debug: {
            original_avg_delay: Number(avgDelay.toFixed(1)),
            distribution_avg_delay: Number(stats.totalDelay.toFixed(1)),
            delayUnder30s_pct: Number((stats.delayUnder30s / stats.totalObservations * 100).toFixed(1)),
            delay30to60s_pct: Number((stats.delay30to60s / stats.totalObservations * 100).toFixed(1)),
            delay60to120s_pct: Number((stats.delay60to120s / stats.totalObservations * 100).toFixed(1)),
            delay120to300s_pct: Number((stats.delay120to300s / stats.totalObservations * 100).toFixed(1)),
            delayOver300s_pct: Number((stats.delayOver300s / stats.totalObservations * 100).toFixed(1)),
          }
        };
      })
      .filter(Boolean) // Filtrer les éléments nuls
      .sort((a, b) => {
        if (!a || !b) return 0; // Si l'un des deux est null, considérer comme égal
        return b.observations - a.observations; // Trier par nombre d'observations
      });

    if (formattedResults.length > 0) {
      console.log("Nombre de lignes après traitement:", formattedResults.length);
      console.log("Premier élément:", formattedResults[0]);
    } else {
      console.log("Aucune donnée trouvée après le traitement");
    }

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error("Erreur API by-route avec hourly_metrics:", error);
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