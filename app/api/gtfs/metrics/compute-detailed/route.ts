// app/api/gtfs/metrics/compute-detailed/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Token de sécurité
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

export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Déterminer la date cible (hier par défaut)
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: "Format de date invalide" }, { status: 400 });
      }
    } else {
      // Calculer pour hier par défaut
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
    }

    // Formater la date pour les comparaisons SQL
    const dateString = targetDate.toISOString().split('T')[0];
    
    // Début et fin de la journée ciblée
    const startDate = new Date(`${dateString}T00:00:00Z`);
    const endDate = new Date(`${dateString}T23:59:59.999Z`);

    console.log(`Calcul des métriques détaillées pour ${dateString}`);
    
    // Statistiques à retourner
    const stats = {
      hourlyMetrics: 0,
      stopMetrics: 0
    };

    // 1. Calculer les métriques horaires
    console.log("Calcul des métriques horaires...");
    
    // Supprimer d'abord les métriques existantes pour cette date
    await prisma.hourlyMetric.deleteMany({
      where: { date: startDate }
    });
    
    // Calculer et insérer les nouvelles métriques horaires
    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(startDate);
      hourStart.setHours(hour, 0, 0, 0);
      
      const hourEnd = new Date(startDate);
      hourEnd.setHours(hour, 59, 59, 999);
      
      // Obtenir les lignes actives pendant cette heure
      const activeRoutes = await prisma.$queryRaw`
        SELECT DISTINCT rd."route_id"
        FROM "realtime_delays" rd
        WHERE rd."collected_at" BETWEEN ${hourStart} AND ${hourEnd}
        AND rd."status" = 'SCHEDULED'
      `;
      // Pour chaque ligne active, calculer les métriques
      if (Array.isArray(activeRoutes)) {
        for (const routeObj of activeRoutes) {
          const routeId = routeObj.route_id;
          
          const hourlyStats = await prisma.$queryRaw`
            SELECT
            COUNT(*) AS observations,
            ROUND(AVG(rd."delay")::numeric, 1) AS avg_delay,
            MAX(rd."delay") AS max_delay,
            MIN(rd."delay") AS min_delay,
            ROUND((COUNT(CASE WHEN rd."delay" BETWEEN -60 AND 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS on_time_rate,
            ROUND((COUNT(CASE WHEN rd."delay" > 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS late_rate,
            ROUND((COUNT(CASE WHEN rd."delay" < -60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS early_rate
          FROM "realtime_delays" rd
          WHERE rd."route_id" = ${routeId}
          AND rd."collected_at" BETWEEN ${hourStart} AND ${hourEnd}
          AND rd."status" = 'SCHEDULED'
        `;
        
        if (Array.isArray(hourlyStats) && hourlyStats.length > 0 && hourlyStats[0].observations > 0) {
          const stats = hourlyStats[0];
          
          // Insérer dans la base
          await prisma.hourlyMetric.create({
            data: {
              date: startDate,
              hour,
              routeId,
              avgDelay: Number(stats.avg_delay || 0),
              maxDelay: Number(stats.max_delay || 0),
              minDelay: Number(stats.min_delay || 0),
              observations: Number(stats.observations || 0),
              onTimeRate: Number(stats.on_time_rate || 0),
              lateRate: Number(stats.late_rate || 0),
              earlyRate: Number(stats.early_rate || 0)
            }
          });
          
          stats.hourlyMetrics++;
        }
      }
    }
    }
    
    console.log(`${stats.hourlyMetrics} métriques horaires calculées et enregistrées`);
    
    // 2. Calculer les métriques par arrêt
    console.log("Calcul des métriques par arrêt...");
    
    // Supprimer d'abord les métriques existantes pour cette date
    await prisma.stopMetric.deleteMany({
      where: { date: startDate }
    });
    
    // Trouver toutes les combinaisons route/arrêt uniques pour la journée
    const routeStopCombinations = await prisma.$queryRaw`
      SELECT DISTINCT rd."route_id", rd."stop_id"
      FROM "realtime_delays" rd
      WHERE rd."collected_at" BETWEEN ${startDate} AND ${endDate}
      AND rd."status" = 'SCHEDULED'
    `;
    // Pour chaque combinaison, calculer les métriques
    for (const combo of routeStopCombinations as { route_id: string; stop_id: string }[]) {
      const routeId = combo.route_id;
      const stopId = combo.stop_id;
      
      const stopStats = await prisma.$queryRaw`
        SELECT
          COUNT(*) AS observations,
          ROUND(AVG(rd."delay")::numeric, 1) AS avg_delay,
          MAX(rd."delay") AS max_delay,
          MIN(rd."delay") AS min_delay,
          ROUND((COUNT(CASE WHEN rd."delay" BETWEEN -60 AND 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS on_time_rate,
          ROUND((COUNT(CASE WHEN rd."delay" > 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS late_rate,
          ROUND((COUNT(CASE WHEN rd."delay" < -60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS early_rate
        FROM "realtime_delays" rd
        WHERE rd."route_id" = ${routeId}
        AND rd."stop_id" = ${stopId}
        AND rd."collected_at" BETWEEN ${startDate} AND ${endDate}
        AND rd."status" = 'SCHEDULED'
      `;
      
      if (Array.isArray(stopStats) && stopStats.length > 0 && stopStats[0].observations > 0) {
        const stats = stopStats[0];
        
        // Insérer dans la base
        await prisma.stopMetric.create({
          data: {
            date: startDate,
            routeId,
            stopId,
            avgDelay: Number(stats.avg_delay || 0),
            maxDelay: Number(stats.max_delay || 0),
            minDelay: Number(stats.min_delay || 0),
            observations: Number(stats.observations || 0),
            onTimeRate: Number(stats.on_time_rate || 0),
            lateRate: Number(stats.late_rate || 0),
            earlyRate: Number(stats.early_rate || 0)
          }
        });
        
        stats.stopMetrics++;
      }
    }
    
    console.log(`${stats.stopMetrics} métriques par arrêt calculées et enregistrées`);
    
    return NextResponse.json({
      status: "success",
      date: dateString,
      hourlyMetrics: stats.hourlyMetrics,
      stopMetrics: stats.stopMetrics,
      message: `Métriques détaillées calculées pour ${dateString}`
    });
  } catch (error) {
    console.error("Erreur lors du calcul des métriques détaillées:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}