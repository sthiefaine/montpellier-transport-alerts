// app/api/routes/[shortName]/stops/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Utiliser la signature de fonction la plus simple possible
export async function GET(request: Request, context: any) {
  try {
    // Extraire le shortName des paramètres de façon sécurisée
    const shortName = context.params?.shortName;
    
    if (!shortName) {
      return NextResponse.json(
        { error: "Missing shortName parameter" },
        { status: 400 }
      );
    }
    
    // 1. Trouver toutes les routes qui partagent ce shortName
    const routes = await prisma.route.findMany({
      where: { shortName: shortName },
      select: { id: true },
    });

    if (routes.length === 0) {
      return NextResponse.json(
        { error: "No routes found with this shortName" },
        { status: 404 }
      );
    }

    const routeIds = routes.map((r) => r.id);
    console.log(
      `Found ${
        routeIds.length
      } routes with shortName ${shortName}: ${routeIds.join(", ")}`
    );

    // 2. Essayer d'abord d'utiliser StopSequence pour avoir l'ordre exact
    const stopSequences = await prisma.stopSequence.findMany({
      where: {
        routeId: { in: routeIds },
      },
      include: {
        stop: {
          select: {
            id: true,
            name: true,
            code: true,
            lat: true,
            lon: true,
          },
        },
      },
      orderBy: [{ directionId: "asc" }, { position: "asc" }],
    });

    if (stopSequences.length > 0) {
      console.log(
        `Found ${stopSequences.length} stop sequences for routes with shortName ${shortName}`
      );

      // Convertir les séquences en arrêts
      const stopsMap = new Map();

      // Utiliser une Map pour éviter les doublons, avec une clé composite
      stopSequences.forEach((seq) => {
        const key = `${seq.stop.id}-${seq.directionId}`;

        // Si cet arrêt existe déjà pour cette direction, ne le remplacer que si:
        // - C'est un terminus ou
        // - La position est prioritaire (plus basse)
        if (
          !stopsMap.has(key) ||
          seq.isTerminus ||
          stopsMap.get(key).position > seq.position
        ) {
          stopsMap.set(key, {
            id: seq.stop.id,
            name: seq.stop.name,
            code: seq.stop.code,
            lat: seq.stop.lat,
            lon: seq.stop.lon,
            position: seq.position,
            directionId: seq.directionId,
            isTerminus: seq.isTerminus,
          });
        }
      });

      // Convertir en tableau
      const stops = Array.from(stopsMap.values());

      // Trier par direction puis par position
      stops.sort((a, b) => {
        if (a.directionId !== b.directionId) {
          return a.directionId - b.directionId;
        }
        return a.position - b.position;
      });

      console.log(`Returning ${stops.length} unique stops from sequences`);
      return NextResponse.json(stops);
    }

    // 3. Si StopSequence est vide, essayer via les trips de chaque route
    console.log(
      `No stop sequences found for shortName ${shortName}, trying with trips...`
    );

    // Récupérer un voyage par ligne et par direction pour avoir les arrêts ordonnés
    const trips = await prisma.trip.findMany({
      where: {
        routeId: { in: routeIds },
      },
      select: {
        id: true,
        routeId: true,
        directionId: true,
        headsign: true,
      },
      take: 100, // Limiter pour des raisons de performance
    });

    if (trips.length === 0) {
      return NextResponse.json([]);
    }

    console.log(
      `Found ${trips.length} trips for routes with shortName ${shortName}`
    );

    // Regrouper les trips par direction pour ne traiter qu'un voyage par direction
    const tripsByDirection = new Map();

    // Regrouper d'abord par routeId puis par directionId
    trips.forEach((trip) => {
      const routeId = trip.routeId;
      const dirId = trip.directionId ?? 0;
      const key = `${routeId}-${dirId}`;

      if (!tripsByDirection.has(key)) {
        tripsByDirection.set(key, trip);
      }
    });

    console.log(
      `Selected ${tripsByDirection.size} trips (one per route and direction)`
    );

    // Récupérer les arrêts pour chaque voyage
    const stopsMap = new Map();

    for (const trip of tripsByDirection.values()) {
      const stopTimes = await prisma.stopTime.findMany({
        where: { tripId: trip.id },
        include: {
          stop: {
            select: {
              id: true,
              name: true,
              code: true,
              lat: true,
              lon: true,
            },
          },
        },
        orderBy: { stopSequence: "asc" },
      });

      if (stopTimes.length === 0) continue;

      // Identifier les terminus (premier et dernier arrêt)
      const firstStopId = stopTimes[0].stopId;
      const lastStopId = stopTimes[stopTimes.length - 1].stopId;

      // Enregistrer tous les arrêts du voyage avec leur direction
      for (let i = 0; i < stopTimes.length; i++) {
        const st = stopTimes[i];
        const directionId = trip.directionId ?? 0;
        const isTerminus =
          st.stopId === firstStopId || st.stopId === lastStopId;

        // Clé composite pour éviter les doublons
        const key = `${st.stopId}-${directionId}`;

        // Ne pas remplacer un arrêt existant sauf si c'est un terminus
        // ou si la position est prioritaire (plus basse)
        if (
          !stopsMap.has(key) ||
          isTerminus ||
          stopsMap.get(key).position > st.stopSequence
        ) {
          stopsMap.set(key, {
            id: st.stop.id,
            name: st.stop.name,
            code: st.stop.code,
            lat: st.stop.lat,
            lon: st.stop.lon,
            position: st.stopSequence,
            directionId: directionId,
            routeId: trip.routeId,
            headsign: trip.headsign,
            isTerminus: isTerminus,
          });
        }
      }
    }

    // Convertir la Map en tableau et trier
    const finalStops = Array.from(stopsMap.values());

    // Trier d'abord par direction, puis par position
    finalStops.sort((a, b) => {
      if (a.directionId !== b.directionId) {
        return a.directionId - b.directionId;
      }
      return a.position - b.position;
    });

    console.log(`Returning ${finalStops.length} unique stops from trips`);

    return NextResponse.json(finalStops);
  } catch (error) {
    console.error("Error fetching stops for route:", error);
    return NextResponse.json(
      { error: "Failed to fetch stops for route", details: String(error) },
      { status: 500 }
    );
  }
}