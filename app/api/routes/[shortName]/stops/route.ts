// app/api/routes/[shortName]/stops/route.ts
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Types pour les modèles de données
type StopSequenceWithStop = Prisma.StopSequenceGetPayload<{
  include: {
    stop: {
      select: {
        id: true;
        name: true;
        code: true;
        lat: true;
        lon: true;
      };
    };
  };
}>;

type StopTimeWithStop = Prisma.StopTimeGetPayload<{
  include: {
    stop: {
      select: {
        id: true;
        name: true;
        code: true;
        lat: true;
        lon: true;
      };
    };
  };
}>;

type TripWithDetails = Prisma.TripGetPayload<{
  select: {
    id: true;
    routeId: true;
    directionId: true;
    headsign: true;
  };
}>;

type StopsListWithStop = Prisma.StopsListGetPayload<{
  include: {
    stop: {
      select: {
        id: true;
        name: true;
        code: true;
        lat: true;
        lon: true;
      };
    };
  };
}>;

// Interface pour les arrêts enrichis
interface EnhancedStop {
  id: string;
  name: string;
  code?: string | null;
  lat?: number;
  lon?: number;
  position: number;
  directionId: number;
  isTerminus?: boolean;
  routeId?: string;
  headsign?: string | null;
  // Informations additionnelles de StopsList
  lignesPassantes?: string | null;
  lignesEtDirections?: string | null;
  station?: string | null;
  commune?: string | null;
  source?: "tram" | "bus" | null;
  // ID StopsList pour tracking
  stopsListId?: number;
}

// Interface pour les informations de position
interface PositionInfo {
  position: number;
  directionId: number;
  isTerminus: boolean;
  routeId: string;
  headsign?: string | null;
}

// Interface pour l'arrêt apparié
interface MatchedStop {
  stopId: string;
  position: number;
  directionId: number;
  isTerminus: boolean;
  routeId: string;
  headsign?: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shortName: string }> }
): Promise<Response> {
  try {
    const shortName = (await params).shortName;

    if (!shortName) {
      return new Response(
        JSON.stringify({ error: "Missing shortName parameter" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Finding stops for route ${shortName} with StopsList prioritized`
    );

    // 1. Trouver d'abord tous les arrêts de cette ligne dans StopsList
    const stopsListEntries: StopsListWithStop[] =
      await prisma.stopsList.findMany({
        where: {
          OR: [
            { lignesPassantes: { contains: shortName } },
            { lignesEtDirections: { contains: shortName } },
          ],
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
      });

    console.log(
      `Found ${stopsListEntries.length} stops in StopsList for line ${shortName}`
    );

    if (stopsListEntries.length === 0) {
      // Si aucun arrêt dans StopsList, revenir à l'approche originale
      return fallbackToOriginalApproach(shortName);
    }

    // 2. Trouver les routes associées à ce shortName
    const routes = await prisma.route.findMany({
      where: { shortName: shortName },
      select: { id: true },
    });

    if (routes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No routes found with this shortName" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const routeIds: string[] = routes.map((r) => r.id);
    console.log(`Found ${routeIds.length} routes with shortName ${shortName}`);

    // 3. Construire une Map pour les arrêts issus de StopsList
    const stopsListMap = new Map<string, EnhancedStop>();
    const stopsWithKnownPositions: EnhancedStop[] = [];
    const stopsWithoutPositions: EnhancedStop[] = [];

    // Organiser les arrêts de StopsList
    for (const entry of stopsListEntries) {
      const stopData: EnhancedStop = {
        id: entry.stopId || `stopsList_${entry.id}`, // Utiliser stopId s'il existe, sinon créer un ID unique
        name: entry.description,
        lat: entry.lat,
        lon: entry.lon,
        lignesPassantes: entry.lignesPassantes,
        lignesEtDirections: entry.lignesEtDirections,
        station: entry.station,
        commune: entry.commune,
        source: entry.source as "tram" | "bus" | null,
        stopsListId: entry.id,
        // Ces champs seront remplis plus tard
        position: 999999, // Valeur par défaut élevée
        directionId: 0, // Valeur par défaut
        isTerminus: false,
        // Si on a un stop lié, utiliser ses données
        ...(entry.stop && {
          code: entry.stop.code,
          // On garde le nom de StopsList car il est souvent plus descriptif
        }),
      };

      // Si on a un stopId, on peut l'utiliser pour chercher la position
      if (entry.stopId) {
        stopsListMap.set(entry.stopId, stopData);
        stopsWithKnownPositions.push(stopData);
      } else {
        // Sinon, on le met de côté
        stopsWithoutPositions.push(stopData);
      }
    }

    // 4. Chercher les séquences d'arrêts pour ces routes
    const stopSequences: StopSequenceWithStop[] =
      await prisma.stopSequence.findMany({
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
        `Found ${stopSequences.length} stop sequences to determine order`
      );

      // Collecter les positions et directions pour chaque arrêt
      const positionMap = new Map<string, PositionInfo>();

      for (const seq of stopSequences) {
        const key = seq.stopId;
        // Si l'arrêt existe dans notre Map de StopsList
        if (stopsListMap.has(key)) {
          const stop = stopsListMap.get(key)!;

          // Ne mettre à jour que si meilleure position ou si c'est un terminus
          if (seq.position < stop.position || seq.isTerminus) {
            // Mettre à jour les informations de position et direction
            stop.position = seq.position;
            stop.directionId = seq.directionId;
            stop.isTerminus = seq.isTerminus;
            stop.routeId = seq.routeId;

            // Ajouter le code si disponible
            if (stop.code === undefined || stop.code === null) {
              stop.code = seq.stop.code;
            }

            // Mettre à jour dans la Map
            stopsListMap.set(key, stop);
          }
        }

        // Enregistrer cette position dans tous les cas pour les appariements futurs
        if (!positionMap.has(key)) {
          positionMap.set(key, {
            position: seq.position,
            directionId: seq.directionId,
            isTerminus: seq.isTerminus,
            routeId: seq.routeId,
          });
        } else if (
          seq.position < positionMap.get(key)!.position ||
          seq.isTerminus
        ) {
          positionMap.set(key, {
            position: seq.position,
            directionId: seq.directionId,
            isTerminus: seq.isTerminus,
            routeId: seq.routeId,
          });
        }
      }

      // 5. Essayer d'apparier les arrêts sans stopId par coordonnées géographiques
      for (const stop of stopsWithoutPositions) {
        // Chercher l'arrêt GTFS le plus proche par coordonnées
        let closestStop: MatchedStop | null = null;
        let minDistance = 0.00005; // Environ 50m en degrés
        let closestGtfsStop = null; // Pour stocker les données complètes du stop

        for (const [stopId, posInfo] of positionMap.entries()) {
          // Récupérer les coordonnées de cet arrêt GTFS
          const gtfsStop = await prisma.stop.findUnique({
            where: { id: stopId },
            select: {
              lat: true,
              lon: true,
              code: true, // Récupérer aussi le code
            },
          });

          if (
            gtfsStop &&
            gtfsStop.lat &&
            gtfsStop.lon &&
            stop.lat &&
            stop.lon
          ) {
            const distance = Math.sqrt(
              Math.pow(stop.lat - gtfsStop.lat, 2) +
                Math.pow(stop.lon - gtfsStop.lon, 2)
            );

            if (distance < minDistance) {
              minDistance = distance;
              closestStop = {
                stopId,
                ...posInfo,
              };
              closestGtfsStop = gtfsStop;
            }
          }
        }

        // Si on a trouvé un arrêt proche, utiliser ses infos de position
        if (closestStop && closestGtfsStop) {
          stop.position = closestStop.position;
          stop.directionId = closestStop.directionId;
          stop.isTerminus = closestStop.isTerminus;
          stop.routeId = closestStop.routeId;

          // Récupérer aussi le code s'il est disponible
          if (closestGtfsStop.code) {
            stop.code = closestGtfsStop.code;
          }

          // Ajouter à la liste des arrêts avec position connue
          stopsWithKnownPositions.push(stop);
        }
      }
    } else {
      // Si pas de séquences, essayer avec les voyages
      console.log(
        `No sequences found, trying with trips for line ${shortName}`
      );

      // 6. Utiliser des voyages (trips) pour déterminer l'ordre
      const trips: TripWithDetails[] = await prisma.trip.findMany({
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

      if (trips.length > 0) {
        console.log(`Found ${trips.length} trips for route ${shortName}`);

        // Regrouper par direction
        const tripsByDirection = new Map<string, TripWithDetails>();
        trips.forEach((trip) => {
          const key = `${trip.routeId}-${trip.directionId || 0}`;
          if (!tripsByDirection.has(key)) {
            tripsByDirection.set(key, trip);
          }
        });

        console.log(`Selected ${tripsByDirection.size} representative trips`);

        // Pour chaque voyage représentatif, récupérer ses arrêts
        for (const trip of tripsByDirection.values()) {
          const stopTimes: StopTimeWithStop[] = await prisma.stopTime.findMany({
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

          // Identifier les terminus
          const firstStopId = stopTimes[0].stopId;
          const lastStopId = stopTimes[stopTimes.length - 1].stopId;

          // Mettre à jour les positions pour les arrêts de StopsList
          for (let i = 0; i < stopTimes.length; i++) {
            const st = stopTimes[i];
            const isTerminus =
              st.stopId === firstStopId || st.stopId === lastStopId;

            // Si cet arrêt est dans notre Map
            if (stopsListMap.has(st.stopId)) {
              const stop = stopsListMap.get(st.stopId)!;

              // Ne mettre à jour que si meilleure position ou si c'est un terminus
              if (st.stopSequence < stop.position || isTerminus) {
                stop.position = st.stopSequence;
                stop.directionId = trip.directionId || 0;
                stop.isTerminus = isTerminus;
                stop.routeId = trip.routeId;
                stop.headsign = trip.headsign;

                // Ajouter le code s'il est disponible
                if (stop.code === undefined || stop.code === null) {
                  stop.code = st.stop.code;
                }

                stopsListMap.set(st.stopId, stop);
              }
            }

            // Essayer d'apparier les arrêts sans stopId par coordonnées
            for (const stop of stopsWithoutPositions) {
              if (
                st.stop &&
                st.stop.lat &&
                st.stop.lon &&
                stop.lat &&
                stop.lon
              ) {
                const distance = Math.sqrt(
                  Math.pow(stop.lat - st.stop.lat, 2) +
                    Math.pow(stop.lon - st.stop.lon, 2)
                );

                // Si assez proche (environ 50m)
                if (distance < 0.0005) {
                  stop.position = st.stopSequence;
                  stop.directionId = trip.directionId || 0;
                  stop.isTerminus = isTerminus;
                  stop.routeId = trip.routeId;
                  stop.headsign = trip.headsign;

                  // Ajouter le code s'il est disponible
                  if (stop.code === undefined || stop.code === null) {
                    stop.code = st.stop.code;
                  }

                  // Ajouter à la liste avec positions
                  if (!stopsWithKnownPositions.includes(stop)) {
                    stopsWithKnownPositions.push(stop);
                  }
                }
              }
            }
          }
        }
      }
    }

    // 7. Ajouter les arrêts restants sans position à la fin
    const remainingStops = stopsWithoutPositions.filter(
      (stop) => !stopsWithKnownPositions.includes(stop)
    );

    // Combiner tous les arrêts
    const allStops: EnhancedStop[] = [
      ...stopsWithKnownPositions,
      ...remainingStops,
    ];

    // 8. Trier par direction puis par position puis par stop_code
    allStops.sort((a, b) => {
      // D'abord par direction
      if (a.directionId !== b.directionId) {
        return a.directionId - b.directionId;
      }

      // Ensuite par position (si connue)
      if (a.position !== b.position) {
        return a.position - b.position;
      }

      // Enfin par stop_code si disponible
      if (a.code && b.code) {
        // Si les deux codes sont numériques, faire une comparaison numérique
        const aCodeNum = parseInt(a.code);
        const bCodeNum = parseInt(b.code);

        if (!isNaN(aCodeNum) && !isNaN(bCodeNum)) {
          return aCodeNum - bCodeNum;
        }

        // Sinon, comparaison alphanumérique
        return a.code.localeCompare(b.code);
      }

      // Si un seul a un code, mettre celui qui a un code en premier
      if (a.code) return -1;
      if (b.code) return 1;

      // Si aucun n'a de code, comparer par nom
      return a.name.localeCompare(b.name);
    });

    console.log(`Returning ${allStops.length} stops for line ${shortName}`);
    return new Response(JSON.stringify(allStops), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching stops from StopsList:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch stops",
        details: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Fonction fallback pour utiliser l'ancienne méthode si nécessaire
async function fallbackToOriginalApproach(
  shortName: string
): Promise<Response> {
  console.log(`Falling back to original approach for line ${shortName}`);

  try {
    // 1. Trouver toutes les routes qui partagent ce shortName
    const routes = await prisma.route.findMany({
      where: { shortName: shortName },
      select: { id: true },
    });

    if (routes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No routes found with this shortName" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const routeIds: string[] = routes.map((r) => r.id);

    // 2. Essayer d'abord d'utiliser StopSequence pour avoir l'ordre exact
    const stopSequences: StopSequenceWithStop[] =
      await prisma.stopSequence.findMany({
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

    let baseStops: EnhancedStop[] = [];

    if (stopSequences.length > 0) {
      // Convertir les séquences en arrêts
      const stopsMap = new Map<string, EnhancedStop>();

      // Utiliser une Map pour éviter les doublons, avec une clé composite
      stopSequences.forEach((seq) => {
        const key = `${seq.stop.id}-${seq.directionId}`;

        if (
          !stopsMap.has(key) ||
          seq.isTerminus ||
          stopsMap.get(key)!.position > seq.position
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
            routeId: seq.routeId,
          });
        }
      });

      // Convertir en tableau
      baseStops = Array.from(stopsMap.values());
    } else {
      // 3. Si StopSequence est vide, essayer via les trips de chaque route
      const trips: TripWithDetails[] = await prisma.trip.findMany({
        where: {
          routeId: { in: routeIds },
        },
        select: {
          id: true,
          routeId: true,
          directionId: true,
          headsign: true,
        },
        take: 100,
      });

      if (trips.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Regrouper les trips par direction pour ne traiter qu'un voyage par direction
      const tripsByDirection = new Map<string, TripWithDetails>();
      trips.forEach((trip) => {
        const key = `${trip.routeId}-${trip.directionId ?? 0}`;
        if (!tripsByDirection.has(key)) {
          tripsByDirection.set(key, trip);
        }
      });

      // Récupérer les arrêts pour chaque voyage
      const stopsMap = new Map<string, EnhancedStop>();

      for (const trip of tripsByDirection.values()) {
        const stopTimes: StopTimeWithStop[] = await prisma.stopTime.findMany({
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

        // Identifier les terminus
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

          if (
            !stopsMap.has(key) ||
            isTerminus ||
            stopsMap.get(key)!.position > st.stopSequence
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

      // Convertir la Map en tableau
      baseStops = Array.from(stopsMap.values());
    }

    // 4. Enrichir les arrêts avec les informations de StopsList
    const stopIds = baseStops.map((stop) => stop.id);
    const stopsListEntries = await prisma.stopsList.findMany({
      where: {
        stopId: { in: stopIds },
      },
      select: {
        stopId: true,
        description: true,
        lignesPassantes: true,
        lignesEtDirections: true,
        station: true,
        commune: true,
        source: true,
      },
    });

    // Créer un mapping pour un accès facile
    const stopsListMap = new Map<
      string,
      {
        description: string;
        lignesPassantes: string | null;
        lignesEtDirections: string | null;
        station: string | null;
        commune: string | null;
        source: string | null;
      }
    >();

    stopsListEntries.forEach((entry) => {
      if (entry.stopId) {
        stopsListMap.set(entry.stopId, {
          description: entry.description,
          lignesPassantes: entry.lignesPassantes,
          lignesEtDirections: entry.lignesEtDirections,
          station: entry.station,
          commune: entry.commune,
          source: entry.source,
        });
      }
    });

    // Enrichir les arrêts avec les informations additionnelles
    const enrichedStops = baseStops.map((stop) => {
      const additionalInfo = stopsListMap.get(stop.id);

      if (additionalInfo) {
        return {
          ...stop,
          name:
            additionalInfo.description?.length > stop.name.length
              ? additionalInfo.description
              : stop.name,
          lignesPassantes: additionalInfo.lignesPassantes,
          lignesEtDirections: additionalInfo.lignesEtDirections,
          station: additionalInfo.station,
          commune: additionalInfo.commune,
          source: additionalInfo.source as "tram" | "bus" | null,
        };
      }

      return stop;
    });

    // Tri amélioré avec stop_code
    enrichedStops.sort((a, b) => {
      // D'abord par direction
      if (a.directionId !== b.directionId) {
        return a.directionId - b.directionId;
      }

      // Ensuite par position (si connue)
      if (a.position !== b.position) {
        return a.position - b.position;
      }

      // Enfin par stop_code si disponible
      if (a.code && b.code) {
        // Si les deux codes sont numériques, faire une comparaison numérique
        const aCodeNum = parseInt(a.code);
        const bCodeNum = parseInt(b.code);

        if (!isNaN(aCodeNum) && !isNaN(bCodeNum)) {
          return aCodeNum - bCodeNum;
        }

        // Sinon, comparaison alphanumérique
        return a.code.localeCompare(b.code);
      }

      // Si un seul a un code, mettre celui qui a un code en premier
      if (a.code) return -1;
      if (b.code) return 1;

      // Si aucun n'a de code, comparer par nom
      return a.name.localeCompare(b.name);
    });

    return new Response(JSON.stringify(enrichedStops), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fallback approach:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch stops",
        details: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
