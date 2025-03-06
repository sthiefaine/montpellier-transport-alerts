// app/api/gtfs/metrics/compute-hourly/route.ts
export const maxDuration = 300;
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

    // Déterminer la date et l'heure cibles (heure précédente par défaut)
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const hourParam = url.searchParams.get("hour");
    const fullDayParam = url.searchParams.get("fullDay") === "true";

    let targetDate: Date;
    let targetHour: number | null = null;

    if (dateParam) {
      // Si une date est spécifiée
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: "Format de date invalide" },
          { status: 400 }
        );
      }

      // Si une heure est également spécifiée
      if (hourParam && !fullDayParam) {
        targetHour = parseInt(hourParam, 10);
        if (isNaN(targetHour) || targetHour < 0 || targetHour > 23) {
          return NextResponse.json(
            { error: "Format d'heure invalide (doit être entre 0 et 23)" },
            { status: 400 }
          );
        }
      }
    } else {
      // Par défaut, utiliser l'heure précédente
      const now = new Date();
      targetDate = new Date(now);

      // Si on est à l'heure 0, il faut revenir au jour précédent à 23h
      if (now.getHours() === 0) {
        targetDate.setDate(targetDate.getDate() - 1);
        targetHour = 23;
      } else {
        targetHour = now.getHours() - 1;
      }
    }

    // Formater la date pour les logs et messages
    const dateString = targetDate.toISOString().split("T")[0];

    if (targetHour !== null) {
      console.log(
        `Calcul des métriques horaires pour ${dateString}, heure ${targetHour}`
      );
    } else {
      console.log(
        `Calcul des métriques horaires pour toute la journée du ${dateString}`
      );
    }

    // Suppression des métriques horaires existantes pour cette date et heure
    if (targetHour !== null) {
      const deleteCount = await prisma.hourlyMetric.deleteMany({
        where: {
          date: targetDate,
          hour: targetHour,
        },
      });
      console.log(
        `${deleteCount.count} métriques existantes supprimées pour ${dateString}, heure ${targetHour}`
      );
    } else {
      const deleteCount = await prisma.hourlyMetric.deleteMany({
        where: {
          date: targetDate,
        },
      });
      console.log(
        `${deleteCount.count} métriques existantes supprimées pour ${dateString}`
      );
    }

    // Obtenir toutes les lignes avec des données pour cette période
    let routesWithData;

    if (targetHour !== null) {
      // Si on ne traite qu'une heure spécifique
      const hourStart = new Date(targetDate);
      hourStart.setHours(targetHour, 0, 0, 0);

      const hourEnd = new Date(targetDate);
      hourEnd.setHours(targetHour, 59, 59, 999);

      routesWithData = await prisma.$queryRaw`
        SELECT DISTINCT rd."route_id"
        FROM "realtime_delays" rd
        WHERE rd."collected_at" BETWEEN ${hourStart} AND ${hourEnd}
      `;
    } else {
      // Si on traite toute la journée
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      routesWithData = await prisma.$queryRaw`
        SELECT DISTINCT rd."route_id"
        FROM "realtime_delays" rd
        WHERE rd."collected_at" BETWEEN ${dayStart} AND ${dayEnd}
      `;
    }

    if (!Array.isArray(routesWithData) || routesWithData.length === 0) {
      return NextResponse.json(
        {
          message: `Aucune donnée disponible pour ${
            targetHour !== null ? `l'heure ${targetHour}` : "cette journée"
          }`,
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
      console.log(`Calcul des métriques pour la ligne ${routeId}`);

      // Déterminer les heures à traiter
      const hoursToProcess =
        targetHour !== null ? [targetHour] : Array.from(Array(24).keys()); // 0-23 si journée complète

      for (const hour of hoursToProcess) {
        try {
          // Calculer les limites de cette heure
          const hourStart = new Date(targetDate);
          hourStart.setHours(hour, 0, 0, 0);

          const hourEnd = new Date(targetDate);
          hourEnd.setHours(hour, 59, 59, 999);

          // Vérifier s'il y a des données pour cette heure
          const observationCount = await prisma.realtimeDelay.count({
            where: {
              routeId,
              collectedAt: {
                gte: hourStart,
                lte: hourEnd,
              },
              status: "SCHEDULED",
            },
          });

          if (observationCount === 0) {
            // Aucune donnée pour cette heure, passer à la suivante
            console.log(
              `Ligne ${routeId}, heure ${hour}: aucune donnée, ignorée`
            );
            continue;
          }

          if (observationCount < 5) {
            console.log(
              `Ligne ${routeId}, heure ${hour}: trop peu d'observations (${observationCount}), ignorée`
            );
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

            // S'assurer que toutes les valeurs numériques sont converties correctement
            const sanitizedMetric = {
              observations: Number(metric.observations || 0),
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
                date: targetDate,
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

            console.log(
              `Métrique créée pour ligne ${routeId}, heure ${hour}: ${
                sanitizedMetric.observations
              } obs, ponctualité ${(sanitizedMetric.onTimeRate60 * 100).toFixed(
                1
              )}%`
            );

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
      hour: targetHour,
      processed: totalProcessed,
      message:
        targetHour !== null
          ? `Métriques horaires calculées pour l'heure ${targetHour}: ${totalProcessed} entrées`
          : `Métriques horaires calculées pour toute la journée: ${totalProcessed} entrées`,
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
