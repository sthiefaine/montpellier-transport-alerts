// app/api/gtfs/collect-realtime/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import * as GtfsRealtimeBindings from "gtfs-realtime-bindings";

const prisma = new PrismaClient();

// Token de sécurité
const COLLECT_TOKEN = process.env.CRON_SECRET;

// Fonction pour vérifier l'authentification
function validateAuth(request: Request) {
  // Vérifier l'en-tête d'autorisation
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7); // Extraire le token après "Bearer "
  return token === COLLECT_TOKEN;
}

// Gérer les requêtes GET (pour les cron jobs Vercel)
export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    return await collectRealtimeData();
  } catch (error) {
    console.error("Erreur lors de la collecte temps réel:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la collecte temps réel",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Gérer les requêtes POST (pour la rétrocompatibilité)
export async function POST(request: Request) {
  try {
    // Essayer d'abord l'authentification par header
    if (validateAuth(request)) {
      return await collectRealtimeData();
    }

    // Si pas d'en-tête d'autorisation, essayer l'authentification par body (ancienne méthode)
    try {
      const { token } = await request.json();
      if (token !== COLLECT_TOKEN) {
        return NextResponse.json({ error: "Token invalide" }, { status: 401 });
      }
      return await collectRealtimeData();
    } catch (error) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
  } catch (error) {
    console.error("Erreur lors de la collecte temps réel:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la collecte temps réel",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Fonction commune pour collecter les données temps réel
async function collectRealtimeData() {
  console.log("Collecte des données temps réel:", new Date().toISOString());

  // Télécharger les données temps réel
  const response = await axios({
    method: "get",
    url: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/TripUpdate.pb",
    responseType: "arraybuffer",
  });

  // Décoder le protobuf
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(response.data)
  );

  console.log(`Reçu ${feed.entity.length} entités`);

  // Ajouter des compteurs pour suivre le processus de filtrage
  const entityCount = feed.entity.length;
  let tripUpdateCount = 0;
  let validTripCount = 0;
  let validStopTimeCount = 0;
  let validStopIdCount = 0;
  let validArrivalCount = 0;
  let validDepartureCount = 0;
  let validDelayCount = 0;

  // Préparer les données à insérer
  const delaysToInsert: any[] = [];

  for (const entity of feed.entity) {
    if (entity.tripUpdate) {
      tripUpdateCount++;
      const tripUpdate = entity.tripUpdate;
      
      // Vérifier que trip existe et contient les propriétés nécessaires
      if (!tripUpdate.trip) {
        continue;
      }
      validTripCount++;

      const tripId = String(tripUpdate.trip.tripId || "");
      const routeId = String(tripUpdate.trip.routeId || "");

      // Vérifier que stopTimeUpdate est un tableau
      if (!tripUpdate.stopTimeUpdate || !Array.isArray(tripUpdate.stopTimeUpdate)) {
        continue;
      }
      validStopTimeCount++;

      for (const stu of tripUpdate.stopTimeUpdate) {
        // Vérifier que l'arrêt a un ID
        const stopId = String(stu.stopId || "");
        if (!stopId) {
          continue;
        }
        validStopIdCount++;

        // IMPORTANT: Nous n'utilisons plus la vérification de scheduleRelationship
        // Elle semble être présente dans les données mais inaccessible avec la notation standard

        // Traiter directement les arrivées et départs
        const timeInfo = stu.arrival || stu.departure;
        if (!timeInfo) {
          continue;
        }

        if (stu.arrival) validArrivalCount++;
        if (stu.departure) validDepartureCount++;

        // Traiter le délai
        const delay = timeInfo.delay !== undefined && timeInfo.delay !== null
          ? Number(timeInfo.delay)
          : null;

        if (delay === null) {
          continue;
        }
        validDelayCount++;

        // Extraire le timestamp
        let actualTimeValue = null;
        if (timeInfo.time) {
          if (typeof timeInfo.time === "object" && "low" in timeInfo.time) {
            actualTimeValue = Number(timeInfo.time.low || 0);
          } else {
            actualTimeValue = Number(timeInfo.time);
          }
        }

        // Utiliser "SCHEDULED" comme valeur par défaut pour status
        const status = "SCHEDULED";

        // Ajouter l'enregistrement à insérer
        delaysToInsert.push({
          tripId,
          routeId,
          stopId,
          scheduledTime: null,
          actualTime: actualTimeValue,
          delay,
          status,
        });
      }
    }
  }

  console.log(`
  --- Statistiques de filtrage ---
  Entités totales: ${entityCount}
  Avec tripUpdate: ${tripUpdateCount}
  Avec trip valide: ${validTripCount}
  Avec stopTimeUpdate valide: ${validStopTimeCount}
  Avec stopId valide: ${validStopIdCount}
  Avec arrival: ${validArrivalCount}
  Avec departure: ${validDepartureCount}
  Avec delay valide: ${validDelayCount}
  `);

  console.log(
    `Préparation de ${delaysToInsert.length} enregistrements à insérer`
  );

  // Insérer les données
  try {
    // Vérifier qu'il y a des données à insérer
    if (delaysToInsert.length === 0) {
      return NextResponse.json({
        status: "success",
        message: "Aucune donnée valide à insérer",
        collected: 0,
        cleaned: 0
      });
    }

    // Étape 1: Vérifier que les IDs existent
    // Récupérer tous les tripIds, routeIds et stopIds uniques
    const uniqueTripIds = [...new Set(delaysToInsert.map(d => d.tripId))];
    const uniqueRouteIds = [...new Set(delaysToInsert.map(d => d.routeId))];
    const uniqueStopIds = [...new Set(delaysToInsert.map(d => d.stopId))];

    console.log(`IDs uniques - Trips: ${uniqueTripIds.length}, Routes: ${uniqueRouteIds.length}, Stops: ${uniqueStopIds.length}`);

    // Filtrer les délais qui ont des IDs valides
    const validTrips = await prisma.trip.findMany({
      where: { id: { in: uniqueTripIds } },
      select: { id: true }
    });
    const validTripIds = validTrips.map(t => t.id);
    console.log(`Trips valides trouvés: ${validTripIds.length}/${uniqueTripIds.length}`);

    const validRoutes = await prisma.route.findMany({
      where: { id: { in: uniqueRouteIds } },
      select: { id: true }
    });
    const validRouteIds = validRoutes.map(r => r.id);
    console.log(`Routes valides trouvées: ${validRouteIds.length}/${uniqueRouteIds.length}`);

    const validStops = await prisma.stop.findMany({
      where: { id: { in: uniqueStopIds } },
      select: { id: true }
    });
    const validStopIds = validStops.map(s => s.id);
    console.log(`Stops valides trouvés: ${validStopIds.length}/${uniqueStopIds.length}`);

    // Filtrer les délais qui ont des références valides
    const filteredDelays = delaysToInsert.filter(delay => 
      validTripIds.includes(delay.tripId) && 
      validRouteIds.includes(delay.routeId) && 
      validStopIds.includes(delay.stopId)
    );

    console.log(`Délais valides après vérification des références: ${filteredDelays.length}/${delaysToInsert.length}`);

    // Insérer uniquement les délais avec des références valides
    if (filteredDelays.length === 0) {
      return NextResponse.json({
        status: "success",
        message: "Aucune donnée avec références valides à insérer",
        collected: 0,
        cleaned: 0
      });
    }

    const result = await prisma.realtimeDelay.createMany({
      data: filteredDelays,
      skipDuplicates: true,
    });

    console.log(`Inséré ${result.count} enregistrements de délais`);

    // Nettoyage des données anciennes (garder 7 jours)
    const deleteResult = await prisma.realtimeDelay.deleteMany({
      where: {
        collectedAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    console.log(`Nettoyé ${deleteResult.count} anciens enregistrements`);

    return NextResponse.json({
      status: "success",
      collected: result.count,
      cleaned: deleteResult.count,
    });
  } catch (error) {
    console.error("Erreur lors de l'insertion ou du nettoyage:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
    }
    throw error;
  }
}