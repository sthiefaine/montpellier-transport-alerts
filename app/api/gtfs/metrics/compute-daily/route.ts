// app/api/gtfs/metrics/compute-daily/route.ts
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

// Gérer les requêtes GET (pour les cron jobs Vercel)
export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Par défaut, calculer pour hier (paramètre date optionnel pour recalculer un jour spécifique)
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");

    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: "Format de date invalide" },
          { status: 400 }
        );
      }
    } else {
      // Calculer pour hier par défaut
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
    }

    // Formater la date pour les comparaisons SQL
    const dateString = targetDate.toISOString().split("T")[0];

    // Début et fin de la journée ciblée
    const startDate = new Date(`${dateString}T00:00:00Z`);
    const endDate = new Date(`${dateString}T23:59:59.999Z`);

    console.log(`Calcul des métriques quotidiennes pour ${dateString}`);

    // Obtenir toutes les lignes avec des données pour cette journée
    const routesWithData = await prisma.$queryRaw`
      SELECT DISTINCT rd."route_id"
      FROM "realtime_delays" rd
      WHERE rd."collected_at" BETWEEN ${startDate} AND ${endDate}
    `;

    if (!Array.isArray(routesWithData) || routesWithData.length === 0) {
      return NextResponse.json(
        {
          message: "Aucune donnée disponible pour cette journée",
        },
        { status: 404 }
      );
    }

    console.log(`Trouvé ${routesWithData.length} lignes avec des données`);

    // Résultats pour stocker les métriques calculées
    const results = [];
    let totalProcessed = 0;

    // Calculer les métriques pour chaque ligne
    for (const routeObj of routesWithData) {
      const routeId = routeObj.route_id;

      // Calculer les métriques pour cette ligne
      const metrics = await prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT rd."trip_id") AS total_trips,
          COUNT(DISTINCT rd."stop_id") AS total_stops,
          ROUND(AVG(rd."delay")::numeric, 1) AS avg_delay,
          MAX(rd."delay") AS max_delay,
          MIN(rd."delay") AS min_delay,
          ROUND((COUNT(CASE WHEN rd."delay" BETWEEN -60 AND 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS on_time_rate,
          ROUND((COUNT(CASE WHEN rd."delay" > 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS late_rate,
          ROUND((COUNT(CASE WHEN rd."delay" < -60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS early_rate
        FROM "realtime_delays" rd
        WHERE rd."route_id" = ${routeId}
        AND rd."collected_at" BETWEEN ${startDate} AND ${endDate}
        AND rd."status" = 'SCHEDULED'
      `;

      if (Array.isArray(metrics) && metrics.length > 0) {
        const metric = metrics[0];

        // S'assurer que toutes les valeurs numériques sont converties correctement
        const sanitizedMetric = {
          totalTrips: Number(metric.total_trips || 0),
          totalStops: Number(metric.total_stops || 0),
          avgDelay: Number(metric.avg_delay || 0),
          maxDelay: Number(metric.max_delay || 0),
          minDelay: Number(metric.min_delay || 0),
          onTimeRate: Number(metric.on_time_rate || 0),
          lateRate: Number(metric.late_rate || 0),
          earlyRate: Number(metric.early_rate || 0),
        };

        // Supprimer toute entrée existante pour cette combinaison date/route
        await prisma.dailyMetric.deleteMany({
          where: {
            date: startDate,
            routeId,
          },
        });

        // Insérer la nouvelle métrique
        const result = await prisma.dailyMetric.create({
          data: {
            date: startDate,
            routeId,
            ...sanitizedMetric,
          },
        });

        results.push(result);
        totalProcessed++;
      }
    }

    console.log(
      `Métriques calculées et enregistrées pour ${totalProcessed} lignes`
    );

    // Optionnel: supprimer les données brutes plus anciennes que X jours
    // Cette étape est déjà gérée dans la collecte temps réel, mais vous pourriez la déplacer ici

    return NextResponse.json({
      status: "success",
      date: dateString,
      processed: totalProcessed,
      message: `Métriques quotidiennes calculées pour ${totalProcessed} lignes`,
    });
  } catch (error) {
    console.error("Erreur lors du calcul des métriques quotidiennes:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
