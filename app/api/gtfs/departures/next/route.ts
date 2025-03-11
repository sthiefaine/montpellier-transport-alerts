// app/api/gtfs/departures/next/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // Récupérer tous les stopId (pour supporter les arrêts multiples)
    const stopIds = url.searchParams.getAll("stopId");
    const routeId = url.searchParams.get("routeId");
    const directionId = url.searchParams.get("directionId");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    // Nouveau paramètre pour le seuil de temps minimum en secondes (par défaut à 10)
    const minTimeThreshold = parseInt(
      url.searchParams.get("minTimeThreshold") || "30"
    );

    // Date actuelle
    const now = new Date();
    // Date limite pour le filtre (now + minTimeThreshold secondes)
    const minTimestamp = Math.floor(now.getTime() / 1000) + minTimeThreshold;

    console.log(
      `Filtrage des départs avec un seuil minimum de ${minTimeThreshold} secondes`
    );
    console.log(
      `Timestamp actuel: ${Math.floor(
        now.getTime() / 1000
      )}, Timestamp minimum: ${minTimestamp}`
    );

    // Filtres de base
    const whereClause: any = {
      collectedAt: {
        // Utiliser uniquement les données récentes (15 dernières minutes)
        gte: new Date(now.getTime() - 15 * 60 * 1000),
      },
      status: "SCHEDULED",
      // Filtrer uniquement les départs futurs avec un délai minimum
      AND: [
        {
          OR: [
            // Cas 1: Nous avons un actualTime (heure de passage réellement prévue)
            {
              actualTime: {
                gt: minTimestamp, // Utiliser le timestamp avec le seuil minimum
              },
            },
            // Cas 2: Nous n'avons pas d'actualTime mais un delay positif
            {
              actualTime: null,
              delay: { gt: 0 },
            },
          ],
        },
      ],
    };

    // Ajouter le filtre par arrêt(s) si spécifié(s)
    if (stopIds && stopIds.length > 0) {
      if (stopIds.length === 1) {
        // Si un seul arrêt, utiliser l'égalité simple
        whereClause.stopId = stopIds[0];
      } else {
        // Si plusieurs arrêts, utiliser l'opérateur in de Prisma
        whereClause.stopId = {
          in: stopIds,
        };
      }
    }

    // Ajouter le filtre par route si spécifié
    if (routeId) {
      whereClause.routeId = routeId;
    }

    // Ajouter le filtre par direction si spécifié
    if (directionId !== null && directionId !== undefined) {
      whereClause.trip = {
        directionId: parseInt(directionId),
      };
    }

    // Récupérer les prochains départs avec les détails correspondants
    const nextDepartures = await prisma.realtimeDelay.findMany({
      where: whereClause,
      take: limit * 3, // Récupérer plus de résultats pour tenir compte des doublons
      orderBy: {
        actualTime: "asc",
      },
      select: {
        tripId: true,
        routeId: true,
        stopId: true,
        delay: true,
        actualTime: true,
        route: {
          select: {
            shortName: true,
            longName: true,
            color: true,
          },
        },
        stop: {
          select: {
            name: true,
            code: true,
          },
        },
        trip: {
          select: {
            headsign: true,
            directionId: true,
          },
        },
      },
    });

    console.log(
      `Récupéré ${nextDepartures.length} départs avant déduplication`
    );

    // Si aucun départ n'est trouvé
    if (nextDepartures.length === 0) {
      return NextResponse.json([]);
    }

    // Dédupliquer les résultats par ligne, destination et heure prévue
    const deduplicatedDepartures = [];
    const uniqueKeys = new Set();

    for (const departure of nextDepartures) {
      // Calculer l'heure de référence (heure planifiée)
      let scheduledTime = null;

      // Si nous avons un actualTime et un delay, nous pouvons calculer l'heure planifiée
      if (departure.actualTime && departure.delay !== null) {
        const actualTimeMs = BigInt(departure.actualTime) * BigInt(1000); // Convertir en millisecondes
        scheduledTime = new Date(
          Number(actualTimeMs) - Number(departure.delay) * 1000
        );
      }

      if (!scheduledTime) continue;

      // Créer une clé unique basée sur la ligne, la destination, l'arrêt et l'heure planifiée
      // Arrondir l'heure planifiée à la minute pour regrouper les départs très proches
      const scheduledMinute = Math.floor(scheduledTime.getTime() / 60000);
      const directionHeadsign = departure.trip?.headsign || "";
      // Inclure l'ID de l'arrêt dans la clé unique pour éviter la déduplication entre arrêts différents
      const uniqueKey = `${departure.routeId}_${directionHeadsign}_${departure.stopId}_${scheduledMinute}`;

      if (!uniqueKeys.has(uniqueKey)) {
        uniqueKeys.add(uniqueKey);
        deduplicatedDepartures.push(departure);

        // Arrêter quand on atteint la limite demandée
        if (deduplicatedDepartures.length >= limit) break;
      }
    }

    console.log(
      `Nombre de départs après déduplication: ${deduplicatedDepartures.length}`
    );

    // Enrichir les données avec les heures calculées
    const formattedDepartures = deduplicatedDepartures.map((departure) => {
      // Calculer l'heure de référence (heure planifiée)
      let scheduledTime = null;
      let estimatedTime = null;

      if (departure.actualTime) {
        const actualTimeMs = BigInt(departure.actualTime) * BigInt(1000); 
        estimatedTime = new Date(Number(actualTimeMs));

        // Calculer l'heure planifiée en soustrayant le retard
        if (departure.delay !== null) {
          scheduledTime = new Date(
            Number(actualTimeMs) - departure.delay * 1000
          );
        } else {
          scheduledTime = estimatedTime; 
        }
      }

      return {
        tripId: departure.tripId,
        line: {
          id: departure.routeId,
          number: departure.route.shortName,
          name: departure.route.longName,
          color: departure.route.color ? `#${departure.route.color}` : null,
        },
        stop: {
          id: departure.stopId,
          name: departure.stop.name,
          code: departure.stop.code,
        },
        direction: {
          id: departure.trip?.directionId,
          headsign: departure.trip?.headsign || "Direction inconnue",
        },
        delay: departure.delay,
        scheduledTime: scheduledTime ? scheduledTime.toISOString() : null,
        estimatedTime: estimatedTime ? estimatedTime.toISOString() : null,
        // Pour l'affichage formaté des heures
        formattedScheduled: scheduledTime ? formatTime(scheduledTime) : null,
        formattedEstimated: estimatedTime ? formatTime(estimatedTime) : null,
      };
    });

    return NextResponse.json(formattedDepartures);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des prochains départs:",
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

// Fonction utilitaire pour formater l'heure en HH:MM
function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}