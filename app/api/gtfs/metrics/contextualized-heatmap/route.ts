// app/api/gtfs/metrics/contextualized-heatmap/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const routeId = url.searchParams.get('routeId');
    const metricParam = url.searchParams.get('metric') || 'avgDelay';
    const directionId = url.searchParams.get('directionId') || '0';
    const filterParam = url.searchParams.get('filter') || 'all'; // 'all', 'start', 'middle', 'end'
    
    if (!routeId) {
      return NextResponse.json({ error: "Le paramètre 'routeId' est requis" }, { status: 400 });
    }
    
    // Vérifier que le metric est valide
    const validMetrics = ['avgDelay', 'maxDelay', 'minDelay', 'onTimeRate', 'lateRate', 'earlyRate'];
    if (!validMetrics.includes(metricParam)) {
      return NextResponse.json({ 
        error: "Paramètre 'metric' invalide",
        validOptions: validMetrics
      }, { status: 400 });
    }
    
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
    
    // 1. Obtenir la séquence des arrêts pour cette ligne dans la direction spécifiée
    const stopSequences = await prisma.stopSequence.findMany({
      where: {
        routeId: routeId,
        directionId: parseInt(directionId, 10)
      },
      orderBy: {
        position: 'asc'
      },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
            code: true,
            lat: true,
            lon: true
          }
        }
      }
    });
    
    if (stopSequences.length === 0) {
      return NextResponse.json({ 
        error: "Aucune séquence d'arrêts trouvée pour cette ligne et cette direction" 
      }, { status: 404 });
    }
    
    // 2. Classifier les arrêts selon leur position (début, milieu, fin)
    const totalStops = stopSequences.length;
    const startThreshold = Math.ceil(totalStops * 0.25); // Premier quart
    const endThreshold = Math.floor(totalStops * 0.75);  // Dernier quart
    
    const classifiedStops = stopSequences.map((seq, index) => {
      let segment;
      if (index < startThreshold) segment = 'start';
      else if (index >= endThreshold) segment = 'end';
      else segment = 'middle';
      
      return {
        ...seq,
        segment,
        relativePosition: (index / (totalStops - 1)) // 0 à 1
      };
    });
    
    // 3. Filtrer selon le segment demandé
    let filteredStops = classifiedStops;
    if (filterParam !== 'all') {
      filteredStops = classifiedStops.filter(seq => seq.segment === filterParam);
    }
    
    if (filteredStops.length === 0) {
      return NextResponse.json({ 
        error: `Aucun arrêt dans le segment '${filterParam}' pour cette ligne` 
      }, { status: 404 });
    }
    
    // 4. Obtenir les métriques pour ces arrêts
    const stopIds = filteredStops.map(seq => seq.stopId);
    
    const stopMetrics = await prisma.stopMetric.findMany({
      where: {
        date: targetDate,
        routeId: routeId,
        stopId: {
          in: stopIds
        }
      }
    });
    
    if (stopMetrics.length === 0) {
      return NextResponse.json({ 
        error: "Aucune métrique trouvée pour ces arrêts à cette date" 
      }, { status: 404 });
    }
    
    // 5. Enrichir les données avec l'horaire de service
    const serviceTimes = await prisma.routeServiceTime.findMany({
      where: {
        routeId: routeId
      }
    });
    
    let serviceInfo = null;
    if (serviceTimes.length > 0) {
      // Prendre le premier service disponible (ou idéalement celui qui correspond au jour de la semaine)
      serviceInfo = {
        startTime: serviceTimes[0].startTime,
        endTime: serviceTimes[0].endTime
      };
    }
    
    // 6. Calculer min/max pour normaliser les couleurs
    let minValue = Infinity;
    let maxValue = -Infinity;
    
    stopMetrics.forEach(metric => {
      const value = metric[metricParam as keyof typeof metric] as number;
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    });
    
    // 7. Merger les données de séquence et de métrique
    const mergedData = filteredStops.map(seq => {
      const metric = stopMetrics.find(m => m.stopId === seq.stopId);
      
      if (!metric) {
        return null; // Pas de métrique pour cet arrêt
      }
      
      const value = metric[metricParam as keyof typeof metric] as number;
      
      // Pour certaines métriques, une valeur élevée est positive
      const normalizedValue = metricParam.includes('Rate') 
        ? (value - minValue) / (maxValue - minValue) // Plus c'est élevé, mieux c'est
        : (maxValue - value) / (maxValue - minValue); // Plus c'est bas, mieux c'est
      
      return {
        stop: {
          id: seq.stopId,
          name: seq.stop.name,
          code: seq.stop.code,
          location: {
            lat: seq.stop.lat,
            lon: seq.stop.lon
          }
        },
        sequence: {
          position: seq.position,
          segment: seq.segment,
          relativePosition: seq.relativePosition,
          isTerminus: seq.isTerminus
        },
        metrics: {
          [metricParam]: value,
          observations: metric.observations
        },
        // Pour la visualisation
        intensity: normalizedValue, // Valeur entre 0 et 1
        colorScale: metricParam.includes('Rate') ? normalizedValue : (1 - normalizedValue)
      };
    }).filter(item => item !== null);
    
    // 8. Retourner les données avec les métadonnées
    return NextResponse.json({
      date: targetDate.toISOString().split('T')[0],
      route: {
        id: routeId,
        directionId: parseInt(directionId, 10)
      },
      service: serviceInfo,
      metric: metricParam,
      metricLabel: getMetricLabel(metricParam),
      filter: filterParam,
      minValue,
      maxValue,
      stopCount: mergedData.length,
      totalSequenceLength: totalStops,
      points: mergedData
    });
  } catch (error) {
    console.error("Erreur lors de la génération des données contextualisées:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Fonction helper pour obtenir un libellé lisible de la métrique
function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    'avgDelay': 'Retard moyen (secondes)',
    'maxDelay': 'Retard maximal (secondes)',
    'minDelay': 'Retard minimal (secondes)',
    'onTimeRate': 'Taux de ponctualité (%)',
    'lateRate': 'Taux de retard (%)',
    'earlyRate': 'Taux d\'avance (%)'
  };
  
  return labels[metric] || metric;
}