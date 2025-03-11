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

// Fonction pour calculer les métriques quotidiennes à partir des métriques horaires
async function calculateDailyMetricsFromHourly(
  targetDate: Date,
  routeId: string
) {
  // Début et fin de la journée
  const startDate = new Date(
    `${targetDate.toISOString().split("T")[0]}T00:00:00Z`
  );
  const endDate = new Date(
    `${targetDate.toISOString().split("T")[0]}T23:59:59.999Z`
  );

  // Récupérer toutes les métriques horaires pour cette route et cette date
  const hourlyMetrics = await prisma.hourlyMetric.findMany({
    where: {
      date: startDate,
      routeId: routeId,
    },
  });

  // Si aucune métrique horaire, retourner null
  if (hourlyMetrics.length === 0) {
    console.log(
      `Aucune métrique horaire trouvée pour ${routeId} à la date ${
        startDate.toISOString().split("T")[0]
      }`
    );
    return null;
  }

  console.log(
    `Trouvé ${
      hourlyMetrics.length
    } métriques horaires pour ${routeId} à la date ${
      startDate.toISOString().split("T")[0]
    }`
  );

  // Calculer les totaux et moyennes
  let totalObservations = 0;
  let totalDelaySum = 0;
  let maxDelay = -Infinity;
  let minDelay = Infinity;

  // Sommes pondérées pour les taux
  let weightedOnTimeRate60 = 0;
  let weightedLateRate60 = 0;
  let weightedEarlyRate60 = 0;
  let weightedOnTimeRate30 = 0;
  let weightedLateRate30 = 0;
  let weightedEarlyRate30 = 0;
  let weightedOnTimeRate120 = 0;
  let weightedLateRate120 = 0;
  let weightedEarlyRate120 = 0;

  // Sommes pondérées pour la répartition des retards
  let weightedDelayUnder30s = 0;
  let weightedDelay30to60s = 0;
  let weightedDelay60to120s = 0;
  let weightedDelay120to300s = 0;
  let weightedDelayOver300s = 0;

  // Parcourir toutes les métriques horaires
  for (const metric of hourlyMetrics) {
    totalObservations += metric.observations;
    totalDelaySum += metric.avgDelay * metric.observations;
    maxDelay = Math.max(maxDelay, metric.maxDelay);
    minDelay = Math.min(minDelay, metric.minDelay);

    // Pondération des taux selon le nombre d'observations
    weightedOnTimeRate60 += metric.onTimeRate60 * metric.observations;
    weightedLateRate60 += metric.lateRate60 * metric.observations;
    weightedEarlyRate60 += metric.earlyRate60 * metric.observations;
    weightedOnTimeRate30 += metric.onTimeRate30 * metric.observations;
    weightedLateRate30 += metric.lateRate30 * metric.observations;
    weightedEarlyRate30 += metric.earlyRate30 * metric.observations;
    weightedOnTimeRate120 += metric.onTimeRate120 * metric.observations;
    weightedLateRate120 += metric.lateRate120 * metric.observations;
    weightedEarlyRate120 += metric.earlyRate120 * metric.observations;

    // Pondération de la répartition des retards
    weightedDelayUnder30s += metric.delayUnder30s * metric.observations;
    weightedDelay30to60s += metric.delay30to60s * metric.observations;
    weightedDelay60to120s += metric.delay60to120s * metric.observations;
    weightedDelay120to300s += metric.delay120to300s * metric.observations;
    weightedDelayOver300s += metric.delayOver300s * metric.observations;
  }

  // Calculer les moyennes pondérées
  const avgDelay =
    totalObservations > 0 ? totalDelaySum / totalObservations : 0;

  // Calculer les pourcentages pondérés
  const onTimeRate60 =
    totalObservations > 0 ? weightedOnTimeRate60 / totalObservations : 0;
  const lateRate60 =
    totalObservations > 0 ? weightedLateRate60 / totalObservations : 0;
  const earlyRate60 =
    totalObservations > 0 ? weightedEarlyRate60 / totalObservations : 0;
  const onTimeRate30 =
    totalObservations > 0 ? weightedOnTimeRate30 / totalObservations : 0;
  const lateRate30 =
    totalObservations > 0 ? weightedLateRate30 / totalObservations : 0;
  const earlyRate30 =
    totalObservations > 0 ? weightedEarlyRate30 / totalObservations : 0;
  const onTimeRate120 =
    totalObservations > 0 ? weightedOnTimeRate120 / totalObservations : 0;
  const lateRate120 =
    totalObservations > 0 ? weightedLateRate120 / totalObservations : 0;
  const earlyRate120 =
    totalObservations > 0 ? weightedEarlyRate120 / totalObservations : 0;

  // Calculer la répartition des retards
  const delayUnder30s =
    totalObservations > 0 ? weightedDelayUnder30s / totalObservations : 0;
  const delay30to60s =
    totalObservations > 0 ? weightedDelay30to60s / totalObservations : 0;
  const delay60to120s =
    totalObservations > 0 ? weightedDelay60to120s / totalObservations : 0;
  const delay120to300s =
    totalObservations > 0 ? weightedDelay120to300s / totalObservations : 0;
  const delayOver300s =
    totalObservations > 0 ? weightedDelayOver300s / totalObservations : 0;

  // Compter les trajets et arrêts uniques
  const uniqueTrips = await prisma.realtimeDelay.groupBy({
    by: ["tripId"],
    where: {
      routeId,
      collectedAt: {
        gte: startDate,
        lte: endDate,
      },
      status: "SCHEDULED",
    },
  });

  const uniqueStops = await prisma.realtimeDelay.groupBy({
    by: ["stopId"],
    where: {
      routeId,
      collectedAt: {
        gte: startDate,
        lte: endDate,
      },
      status: "SCHEDULED",
    },
  });

  return {
    totalTrips: uniqueTrips.length,
    totalStops: uniqueStops.length,
    avgDelay,
    maxDelay,
    minDelay,
    onTimeRate60,
    lateRate60,
    earlyRate60,
    onTimeRate30,
    lateRate30,
    earlyRate30,
    onTimeRate120,
    lateRate120,
    earlyRate120,
    delayUnder30s,
    delay30to60s,
    delay60to120s,
    delay120to300s,
    delayOver300s,
  };
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

      try {
        // D'abord essayer d'utiliser les métriques horaires existantes
        const aggregatedMetrics = await calculateDailyMetricsFromHourly(
          targetDate,
          routeId
        );

        if (aggregatedMetrics) {
          console.log(
            `Utilisation des métriques horaires agrégées pour la ligne ${routeId}`
          );

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
              totalTrips: aggregatedMetrics.totalTrips,
              totalStops: aggregatedMetrics.totalStops,
              avgDelay: aggregatedMetrics.avgDelay,
              maxDelay: aggregatedMetrics.maxDelay,
              minDelay: aggregatedMetrics.minDelay,
              onTimeRate60: aggregatedMetrics.onTimeRate60,
              lateRate60: aggregatedMetrics.lateRate60,
              earlyRate60: aggregatedMetrics.earlyRate60,
              onTimeRate30: aggregatedMetrics.onTimeRate30,
              lateRate30: aggregatedMetrics.lateRate30,
              earlyRate30: aggregatedMetrics.earlyRate30,
              onTimeRate120: aggregatedMetrics.onTimeRate120,
              lateRate120: aggregatedMetrics.lateRate120,
              earlyRate120: aggregatedMetrics.earlyRate120,
              delayUnder30s: aggregatedMetrics.delayUnder30s,
              delay30to60s: aggregatedMetrics.delay30to60s,
              delay60to120s: aggregatedMetrics.delay60to120s,
              delay120to300s: aggregatedMetrics.delay120to300s,
              delayOver300s: aggregatedMetrics.delayOver300s,
              route: {
                connect: {
                  id: routeId,
                },
              },
            },
          });

          results.push(result);
          totalProcessed++;
          console.log(`Métriques quotidiennes agrégées pour ligne ${routeId}`);
          continue; // Passer à la ligne suivante
        }

        console.log(`Calcul direct des métriques pour la ligne ${routeId}`);

        // Calculer les métriques pour cette ligne avec les différents seuils
        const metrics = await prisma.$queryRaw`
          SELECT
            COUNT(DISTINCT rd."trip_id") AS total_trips,
            COUNT(DISTINCT rd."stop_id") AS total_stops,
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
          AND rd."collected_at" BETWEEN ${startDate} AND ${endDate}
          AND rd."status" = 'SCHEDULED'
        `;

        if (Array.isArray(metrics) && metrics.length > 0) {
          const metric = metrics[0];

          // Vérifier si nous avons au moins quelques observations
          if (Number(metric.total_trips) === 0) {
            console.log(
              `Ligne ${routeId}: aucun trajet observé, métrique ignorée`
            );
            continue;
          }

          // S'assurer que toutes les valeurs numériques sont converties correctement
          // et prévoir des valeurs par défaut pour éviter les nulls
          const sanitizedMetric = {
            totalTrips: Number(metric.total_trips || 0),
            totalStops: Number(metric.total_stops || 0),
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

          // Supprimer toute entrée existante pour cette combinaison date/route
          await prisma.dailyMetric.deleteMany({
            where: {
              date: startDate,
              routeId,
            },
          });

          // Insérer la nouvelle métrique en utilisant route.connect plutôt que routeId direct
          const result = await prisma.dailyMetric.create({
            data: {
              date: startDate,
              totalTrips: sanitizedMetric.totalTrips,
              totalStops: sanitizedMetric.totalStops,
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
              // Relation avec la route (plutôt que routeId direct)
              route: {
                connect: {
                  id: routeId,
                },
              },
            },
          });

          console.log(
            `Métriques calculées pour ligne ${routeId}: ${
              sanitizedMetric.totalTrips
            } trajets, ponctualité: ${(
              sanitizedMetric.onTimeRate60 * 100
            ).toFixed(1)}%`
          );
          results.push(result);
          totalProcessed++;
        } else {
          console.log(`Ligne ${routeId}: aucune donnée de retard trouvée`);
        }
      } catch (error) {
        console.error(
          `Erreur lors du calcul des métriques pour la ligne ${routeId}:`,
          error
        );
        // Continuer avec la prochaine ligne au lieu d'échouer complètement
        continue;
      }
    }

    console.log(
      `Métriques calculées et enregistrées pour ${totalProcessed} lignes`
    );

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
