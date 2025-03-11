// app/api/gtfs/metrics/compute-stop-hourly/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const forceParam = url.searchParams.get("force") === "true";
    const startHourParam = url.searchParams.get("startHour");

    // Déterminer l'heure de début pour le calcul
    let startHour = new Date();
    startHour.setMinutes(0, 0, 0); // Début de l'heure courante

    // Si on force avec une heure spécifique, la prendre en compte
    if (startHourParam) {
      const parsedHour = parseInt(startHourParam);
      if (!isNaN(parsedHour) && parsedHour >= 0 && parsedHour < 24) {
        startHour.setHours(parsedHour);
      }
    } else {
      // Par défaut, calculer pour l'heure précédente
      startHour.setHours(startHour.getHours() - 1);
    }

    // Calculer la date et l'heure pour les métriques
    const targetDate = startHour.toISOString().split("T")[0]; // Format YYYY-MM-DD
    const targetHour = startHour.getHours();

    console.log(
      `Calcul des métriques horaires par arrêt pour le ${targetDate} à ${targetHour}h...`
    );

    // Supprimer les métriques existantes pour cette période si forcé
    if (forceParam) {
      const deletedCount = await prisma.hourlyStopMetric.deleteMany({
        where: {
          date: new Date(targetDate),
          hour: targetHour,
        },
      });

      console.log(
        `${deletedCount.count} métriques existantes supprimées pour ${targetDate} à ${targetHour}h`
      );
    }

    // Récupérer les données de retard pour la période spécifiée
    const startTime = new Date(targetDate);
    startTime.setHours(targetHour, 0, 0, 0);

    const endTime = new Date(targetDate);
    endTime.setHours(targetHour + 1, 0, 0, 0);

    // Récupérer les retards en temps réel pour la période
    const delays = await prisma.realtimeDelay.findMany({
      where: {
        collectedAt: {
          gte: startTime,
          lt: endTime,
        },
        status: "SCHEDULED",
      },
      select: {
        stopId: true,
        routeId: true,
        delay: true,
      },
    });

    console.log(`${delays.length} retards trouvés pour la période`);

    if (delays.length === 0) {
      return NextResponse.json({
        message: `Aucune donnée de retard trouvée pour ${targetDate} à ${targetHour}h`,
        count: 0,
      });
    }

    // Organiser les données par arrêt
    const stopData = new Map();

    delays.forEach((delay: any) => {
      const key = delay.stopId;

      if (!stopData.has(key)) {
        stopData.set(key, {
          delays: [],
          routeIds: new Set(),
        });
      }

      stopData.get(key).delays.push(delay.delay);
      stopData.get(key).routeIds.add(delay.routeId);
    });

    // Calculer les métriques pour chaque arrêt
    const metricsToCreate = [];

    for (const [stopId, data] of stopData.entries()) {
      const delays = data.delays;

      if (delays.length < 1) continue;

      // Calculer les statistiques de base
      const observations = delays.length;
      const minDelay = Math.min(...delays);
      const maxDelay = Math.max(...delays);
      const avgDelay =
        delays.reduce((sum: any, delay: any) => sum + delay, 0) / observations;

      // Calculer les distributions de retard
      const delayUnder30s =
        delays.filter((d: number) => d >= 0 && d < 30).length / observations;
      const delay30to60s =
        delays.filter((d: number) => d >= 30 && d < 60).length / observations;
      const delay60to120s =
        delays.filter((d: number) => d >= 60 && d < 120).length / observations;
      const delay120to300s =
        delays.filter((d: number) => d >= 120 && d < 300).length / observations;
      const delayOver300s =
        delays.filter((d: number) => d >= 300).length / observations;

      // Calculer les taux de ponctualité avec différents seuils
      const earlyCount30 = delays.filter((d: number) => d < 0).length;
      const onTimeCount30 = delays.filter((d: number) => d >= 0 && d <= 30).length;
      const lateCount30 = delays.filter((d: number) => d > 30).length;

      const earlyCount60 = delays.filter((d: number) => d < 0).length;
      const onTimeCount60 = delays.filter((d: number) => d >= 0 && d <= 60).length;
      const lateCount60 = delays.filter((d: number) => d > 60).length;

      const earlyCount120 = delays.filter((d: number) => d < 0).length;
      const onTimeCount120 = delays.filter((d: number) => d >= 0 && d <= 120).length;
      const lateCount120 = delays.filter((d: number) => d > 120).length;

      // Calculer les taux
      const earlyRate30 = earlyCount30 / observations;
      const onTimeRate30 = onTimeCount30 / observations;
      const lateRate30 = lateCount30 / observations;

      const earlyRate60 = earlyCount60 / observations;
      const onTimeRate60 = onTimeCount60 / observations;
      const lateRate60 = lateCount60 / observations;

      const earlyRate120 = earlyCount120 / observations;
      const onTimeRate120 = onTimeCount120 / observations;
      const lateRate120 = lateCount120 / observations;

      // Créer l'objet de métrique pour cet arrêt
      metricsToCreate.push({
        date: new Date(targetDate),
        hour: targetHour,
        stopId: stopId,
        avgDelay: avgDelay,
        maxDelay: maxDelay,
        minDelay: minDelay,
        observations: observations,
        delayUnder30s: delayUnder30s,
        delay30to60s: delay30to60s,
        delay60to120s: delay60to120s,
        delay120to300s: delay120to300s,
        delayOver300s: delayOver300s,
        earlyRate30: earlyRate30,
        onTimeRate30: onTimeRate30,
        lateRate30: lateRate30,
        earlyRate60: earlyRate60,
        onTimeRate60: onTimeRate60,
        lateRate60: lateRate60,
        earlyRate120: earlyRate120,
        onTimeRate120: onTimeRate120,
        lateRate120: lateRate120,
      });
    }

    // Enregistrer les métriques en base de données
    if (metricsToCreate.length > 0) {
      // Utiliser createMany pour une insertion efficace
      const result = await prisma.hourlyStopMetric.createMany({
        data: metricsToCreate,
        skipDuplicates: true, // Ignorer les doublons
      });

      console.log(
        `${result.count} métriques par arrêt créées pour ${targetDate} à ${targetHour}h`
      );

      return NextResponse.json({
        message: `Métriques par arrêt calculées avec succès pour ${targetDate} à ${targetHour}h`,
        count: result.count,
      });
    } else {
      return NextResponse.json({
        message: `Aucune métrique par arrêt créée pour ${targetDate} à ${targetHour}h`,
        count: 0,
      });
    }
  } catch (error) {
    console.error(
      "Erreur lors du calcul des métriques horaires par arrêt:",
      error
    );

    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
