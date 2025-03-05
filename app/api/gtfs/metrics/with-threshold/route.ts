// app/api/gtfs/metrics/with-threshold/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const routeId = url.searchParams.get('routeId');
    const thresholdParam = url.searchParams.get('threshold') || '60';
    
    // Valider le seuil
    const validThresholds = ['30', '60', '120'];
    if (!validThresholds.includes(thresholdParam)) {
      return NextResponse.json({ 
        error: "Seuil invalide. Utilisez 30, 60 ou 120." 
      }, { status: 400 });
    }
    const threshold = thresholdParam;
    
    // Déterminer la date (hier par défaut)
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: "Format de date invalide" }, { status: 400 });
      }
    } else {
      // Hier par défaut
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
      targetDate.setHours(0, 0, 0, 0);
    }
    
    // Construire la clause where
    const whereClause: any = {
      date: targetDate
    };
    
    if (routeId) {
      whereClause.routeId = routeId;
    }
    
    // Récupérer les métriques quotidiennes
    const dailyMetrics = await prisma.dailyMetric.findMany({
      where: whereClause,
      include: {
        route: {
          select: {
            shortName: true,
            longName: true,
            color: true
          }
        }
      }
    });
    
    if (dailyMetrics.length === 0) {
      return NextResponse.json({ 
        message: "Aucune métrique trouvée pour cette date" 
      }, { status: 404 });
    }
    
    // Adapter les résultats en fonction du seuil choisi
    const formattedResults = dailyMetrics.map(metric => {
      // Sélectionner les métriques en fonction du seuil
      let onTimeRate, lateRate, earlyRate;
      
      if (threshold === '30') {
        onTimeRate = metric.onTimeRate30;
        lateRate = metric.lateRate30;
        earlyRate = metric.earlyRate30;
      } else if (threshold === '120') {
        onTimeRate = metric.onTimeRate120;
        lateRate = metric.lateRate120;
        earlyRate = metric.earlyRate120;
      } else {
        // Par défaut: 60s
        onTimeRate = metric.onTimeRate60;
        lateRate = metric.lateRate60;
        earlyRate = metric.earlyRate60;
      }
      
      return {
        date: metric.date.toISOString().split('T')[0],
        routeId: metric.routeId,
        routeNumber: metric.route.shortName,
        routeName: metric.route.longName,
        color: metric.route.color ? `#${metric.route.color}` : null,
        threshold: parseInt(threshold),
        metrics: {
          totalTrips: metric.totalTrips,
          totalStops: metric.totalStops,
          avgDelay: metric.avgDelay,
          maxDelay: metric.maxDelay,
          minDelay: metric.minDelay,
          onTimeRate: onTimeRate,
          lateRate: lateRate,
          earlyRate: earlyRate
        },
        delayBreakdown: {
          under30s: metric.delayUnder30s,
          from30to60s: metric.delay30to60s,
          from60to120s: metric.delay60to120s,
          from120to300s: metric.delay120to300s,
          over300s: metric.delayOver300s
        }
      };
    });
    
    return NextResponse.json({
      date: targetDate.toISOString().split('T')[0],
      threshold: parseInt(threshold),
      routes: formattedResults
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des métriques:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}