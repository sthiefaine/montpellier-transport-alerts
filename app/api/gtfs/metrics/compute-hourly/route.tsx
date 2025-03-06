// app/api/gtfs/metrics/compute-hourly/route.ts
export const maxDuration = 300
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

    console.log(`Calcul des métriques horaires pour ${dateString}`);

    // Suppression des métriques horaires existantes pour cette date
    const deleteCount = await prisma.hourlyMetric.deleteMany({
      where: {
        date: startDate,
      },
    });
    console.log(
      `${deleteCount.count} métriques horaires existantes supprimées`
    );

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

    // Pour chaque ligne, calculer les métriques par heure
    for (const routeObj of routesWithData) {
      const routeId = routeObj.route_id;
      console.log(`Calcul des métriques horaires pour la ligne ${routeId}`);

      // Pour chaque heure de la journée (0-23)
      for (let hour = 0; hour < 24; hour++) {
        try {
          // Calculer les limites de cette heure
          const hourStart = new Date(startDate);
          hourStart.setHours(hour, 0, 0, 0);

          const hourEnd = new Date(startDate);
          hourEnd.setHours(hour, 59, 59, 999);

          // Vérifier s'il y a des données pour cette heure
          const hasData = await prisma.realtimeDelay.count({
            where: {
              routeId,
              collectedAt: {
                gte: hourStart,
                lte: hourEnd,
              },
              status: "SCHEDULED",
            },
          });

          if (hasData === 0) {
            // Aucune donnée pour cette heure, passer à la suivante
            continue;
          }

          // Calculer les métriques pour cette ligne et cette heure
          const metrics = await prisma.$queryRaw`
            SELECT
              COUNT(*) AS observations,
              ROUND(AVG(rd."delay")::numeric, 1) AS avg_delay,
              MAX(rd."delay") AS max_delay,
              MIN(rd."delay") AS min_delay,
              
              -- Seuil 60s (standard)
              ROUND((COUNT(CASE WHEN rd."delay" BETWEEN -60 AND 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS on_time_rate_60,
              ROUND((COUNT(CASE WHEN rd."delay" > 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS late_rate_60,
              ROUND((COUNT(CASE WHEN rd."delay" < -60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS early_rate_60,
              
              -- Seuil 30s (plus strict)
              ROUND((COUNT(CASE WHEN rd."delay" BETWEEN -30 AND 30 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS on_time_rate_30,
              ROUND((COUNT(CASE WHEN rd."delay" > 30 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS late_rate_30,
              ROUND((COUNT(CASE WHEN rd."delay" < -30 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS early_rate_30,
              
              -- Seuil 120s (plus souple)
              ROUND((COUNT(CASE WHEN rd."delay" BETWEEN -120 AND 120 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS on_time_rate_120,
              ROUND((COUNT(CASE WHEN rd."delay" > 120 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS late_rate_120,
              ROUND((COUNT(CASE WHEN rd."delay" < -120 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS early_rate_120,
              
              -- Répartition des retards par catégorie (seulement pour les retards positifs)
              ROUND((COUNT(CASE WHEN rd."delay" >= 0 AND rd."delay" < 30 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS delay_under_30s,
              ROUND((COUNT(CASE WHEN rd."delay" >= 30 AND rd."delay" < 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS delay_30_to_60s,
              ROUND((COUNT(CASE WHEN rd."delay" >= 60 AND rd."delay" < 120 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS delay_60_to_120s,
              ROUND((COUNT(CASE WHEN rd."delay" >= 120 AND rd."delay" < 300 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS delay_120_to_300s,
              ROUND((COUNT(CASE WHEN rd."delay" >= 300 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) AS delay_over_300s
            FROM "realtime_delays" rd
            WHERE rd."route_id" = ${routeId}
            AND rd."collected_at" BETWEEN ${hourStart} AND ${hourEnd}
            AND rd."status" = 'SCHEDULED'
          `;

          if (Array.isArray(metrics) && metrics.length > 0) {
            const metric = metrics[0];

            // Vérifier si nous avons au moins quelques observations
            const observations = Number(metric.observations || 0);
            if (observations < 5) {
              console.log(
                `Ligne ${routeId}, heure ${hour}: trop peu d'observations (${observations}), ignorée`
              );
              continue;
            }

            // S'assurer que toutes les valeurs numériques sont converties correctement
            const sanitizedMetric = {
              observations,
              avgDelay: Number(metric.avg_delay || 0),
              maxDelay: Number(metric.max_delay || 0),
              minDelay: Number(metric.min_delay || 0),
              // Seuil 60s
              onTimeRate60: Number(metric.on_time_rate_60 || 0) / 100, // Convertir en décimal (0-1)
              lateRate60: Number(metric.late_rate_60 || 0) / 100,
              earlyRate60: Number(metric.early_rate_60 || 0) / 100,
              // Seuil 30s
              onTimeRate30: Number(metric.on_time_rate_30 || 0) / 100,
              lateRate30: Number(metric.late_rate_30 || 0) / 100,
              earlyRate30: Number(metric.early_rate_30 || 0) / 100,
              // Seuil 120s
              onTimeRate120: Number(metric.on_time_rate_120 || 0) / 100,
              lateRate120: Number(metric.late_rate_120 || 0) / 100,
              earlyRate120: Number(metric.early_rate_120 || 0) / 100,
              // Répartition des retards
              delayUnder30s: Number(metric.delay_under_30s || 0) / 100,
              delay30to60s: Number(metric.delay_30_to_60s || 0) / 100,
              delay60to120s: Number(metric.delay_60_to_120s || 0) / 100,
              delay120to300s: Number(metric.delay_120_to_300s || 0) / 100,
              delayOver300s: Number(metric.delay_over_300s || 0) / 100,
            };

            // Créer la métrique horaire
            const result = await prisma.hourlyMetric.create({
              data: {
                date: startDate,
                hour,
                observations: sanitizedMetric.observations,
                avgDelay: sanitizedMetric.avgDelay,
                maxDelay: sanitizedMetric.maxDelay,
                minDelay: sanitizedMetric.minDelay,
                // Seuil 60s
                onTimeRate60: sanitizedMetric.onTimeRate60,
                lateRate60: sanitizedMetric.lateRate60,
                earlyRate60: sanitizedMetric.earlyRate60,
                // Seuil 30s
                onTimeRate30: sanitizedMetric.onTimeRate30,
                lateRate30: sanitizedMetric.lateRate30,
                earlyRate30: sanitizedMetric.earlyRate30,
                // Seuil 120s
                onTimeRate120: sanitizedMetric.onTimeRate120,
                lateRate120: sanitizedMetric.lateRate120,
                earlyRate120: sanitizedMetric.earlyRate120,
                // Répartition des retards
                delayUnder30s: sanitizedMetric.delayUnder30s,
                delay30to60s: sanitizedMetric.delay30to60s,
                delay60to120s: sanitizedMetric.delay60to120s,
                delay120to300s: sanitizedMetric.delay120to300s,
                delayOver300s: sanitizedMetric.delayOver300s,
                // Relation avec la route
                route: {
                  connect: {
                    id: routeId,
                  },
                },
              },
            });

            results.push(result);
            totalProcessed++;
          }
        } catch (error) {
          console.error(
            `Erreur lors du calcul des métriques pour la ligne ${routeId}, heure ${hour}:`,
            error
          );
          // Continuer avec l'heure suivante
        }
      }
    }

    console.log(
      `Métriques horaires calculées et enregistrées: ${totalProcessed} entrées`
    );

    return NextResponse.json({
      status: "success",
      date: dateString,
      processed: totalProcessed,
      message: `Métriques horaires calculées: ${totalProcessed} entrées`,
    });
  } catch (error) {
    console.error("Erreur lors du calcul des métriques horaires:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
