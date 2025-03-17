import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    
    // Récupérer tous les paramètres de la requête
    const stopIds = url.searchParams.getAll("stopId");
    const routeId = url.searchParams.get("routeId");
    const directionId = url.searchParams.get("directionId");
    
    // Limite demandée et limite étendue pour la requête
    const requestedLimit = parseInt(url.searchParams.get("limit") || "10");
    const queryLimit = Math.max(requestedLimit * 5, 30); // Au moins 30 résultats bruts
    
    // Paramètre pour le seuil de temps minimum en secondes
    const minTimeThreshold = parseInt(url.searchParams.get("minTimeThreshold") || "0");
    
    // Paramètre pour définir la fenêtre de collecte des données (en minutes)
    const dataWindowMinutes = parseInt(url.searchParams.get("dataWindow") || "60");
    
    // Paramètre pour le nombre max de départs par route+arrêt
    let maxPerRouteStop = parseInt(url.searchParams.get("maxPerRouteStop") || "2");
    
    // Nombre minimal de départs différents à retourner (pour éviter trop de doublons)
    const minUniqueRoutes = parseInt(url.searchParams.get("minUniqueRoutes") || "1");
    
    // Paramètre pour activer/désactiver le fallback vers les horaires théoriques
    const useFallback = url.searchParams.get("useFallback") !== "false"; // Par défaut à true
    
    // Date actuelle
    const now = new Date();
    
    // Timestamp minimum pour filtrer les départs
    const minTimestamp = Math.floor(now.getTime() / 1000) + minTimeThreshold;
    
    // Timestamp maximum pour limiter les départs trop lointains (3 heures max)
    const maxTimestamp = Math.floor(now.getTime() / 1000) + 3 * 60 * 60;
    
    console.log(`[API] Timestamp actuel: ${Math.floor(now.getTime() / 1000)}`);
    console.log(`[API] Arrêts demandés: ${stopIds.join(', ')}`);

    // Filtres de base
    const whereClause: any = {
      collectedAt: {
        // Utiliser une fenêtre de temps configurable
        gte: new Date(now.getTime() - dataWindowMinutes * 60 * 1000),
      },
      status: "SCHEDULED",
      // Filtrer les départs dans la plage de temps valide
      AND: [
        {
          OR: [
            // Départs avec heure prévue
            {
              actualTime: {
                gt: minTimestamp,
                lt: maxTimestamp,
              },
            },
            // Départs sans heure prévue mais avec un retard positif
            {
              actualTime: null,
              delay: { gt: 0 },
            },
          ],
        },
      ],
    };

    // Ajouter le filtre par arrêt(s)
    if (stopIds && stopIds.length > 0) {
      if (stopIds.length === 1) {
        whereClause.stopId = stopIds[0];
      } else {
        whereClause.stopId = {
          in: stopIds,
        };
      }
    }

    // Ajouter le filtre par route
    if (routeId) {
      whereClause.routeId = routeId;
    }

    // Ajouter le filtre par direction
    if (directionId !== null && directionId !== undefined) {
      whereClause.trip = {
        directionId: parseInt(directionId),
      };
    }

    // Récupérer les prochains départs
    const nextDepartures = await prisma.realtimeDelay.findMany({
      where: whereClause,
      take: queryLimit * 10,
      orderBy: {
        actualTime: "asc",
      },
      select: {
        tripId: true,
        routeId: true,
        stopId: true,
        delay: true,
        actualTime: true,
        collectedAt: true,
        route: {
          select: {
            shortName: true,
            longName: true,
            color: true,
            type: true,
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

    console.log(`[API] Récupéré ${nextDepartures.length} départs temps réel`);

    // Prétraitement des départs pour calculer les heures
    const processedDepartures = nextDepartures.map((departure) => {
      let scheduledTime = null;
      let estimatedTime = null;

      // Calculer les heures estimée et planifiée
      if (departure.actualTime) {
        const actualTimeMs = BigInt(departure.actualTime) * BigInt(1000);
        estimatedTime = new Date(Number(actualTimeMs));

        if (departure.delay !== null) {
          scheduledTime = new Date(Number(actualTimeMs) - departure.delay * 1000);
        } else {
          scheduledTime = estimatedTime;
        }
      }

      // Ignorer les départs sans heure estimée valide
      if (!estimatedTime) return null;

      // Clés d'identification
      const routeKey = departure.routeId;
      const stopKey = departure.stopId;
      const directionKey = departure.trip?.headsign || "";
      const routeStopKey = `${routeKey}_${stopKey}`;
      
      // Clé unique qui identifie ce voyage spécifique à cet arrêt spécifique
      const tripStopKey = `${departure.tripId}_${stopKey}`;
      
      // Formater le départ pour l'API
      return {
        tripId: departure.tripId,
        routeId: departure.routeId,
        stopId: departure.stopId,
        directionHeadsign: directionKey,
        routeStopKey,
        tripStopKey,
        estimatedTime,
        scheduledTime,
        isRealtime: true, // Indiquer que c'est un départ en temps réel
        collectedAt: departure.collectedAt, // Utiliser pour déterminer la prédiction la plus récente
        line: {
          id: departure.routeId,
          number: departure.route.shortName,
          name: departure.route.longName,
          color: departure.route.color ? `#${departure.route.color}` : null,
          type: departure.route.type,
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
        timestampMs: estimatedTime.getTime(),
        timeKey: formatTime(estimatedTime), // Ajouter une clé de temps pour regrouper les départs à la même minute
      };
    }).filter(Boolean); // Filtrer les éléments null

    console.log(`[API] Départs temps réel valides après prétraitement: ${processedDepartures.length}`);

    // Phase 1: Déduplication pour le même voyage au même arrêt (même tripId + stopId)
    // Garder uniquement la prédiction la plus récente pour chaque combinaison tripId+stopId
    const tripStopMap = new Map();
    for (const departure of processedDepartures) {
      if (!departure) continue; // Vérifier si departure est null et continuer si c'est le cas
      const key = departure.tripStopKey;
      const existing = tripStopMap.get(key);
      
      // Garder la prédiction la plus récente en se basant sur collectedAt
      if (!existing || departure.collectedAt > existing.collectedAt) {
        tripStopMap.set(key, departure);
      }
    }
    
    // Convertir la Map en tableau
    const dedupedDepartures = Array.from(tripStopMap.values());
    console.log(`[API] Départs temps réel après déduplication tripId+stopId: ${dedupedDepartures.length}`);

    // Vérifier si on a besoin de compléter avec des horaires théoriques
    let theoreticalDepartures: any[] = [];
    
    if (useFallback && dedupedDepartures.length < requestedLimit) {
      console.log(`[API] Recherche d'horaires théoriques pour compléter (manquent ${requestedLimit - dedupedDepartures.length} départs)`);
      
      // Horaires théoriques des prochaines heures
      const currentTimeString = formatTimeForGTFS(now);
      const nowTime = now.getTime();
      
      // Déterminer le jour de la semaine pour les services
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      
      // Exclusion des trip_id déjà traités en temps réel
      const existingTripIds = new Set(dedupedDepartures.map(d => d.tripId));
      
      // Construire la clause where pour les horaires théoriques
      const stopTimeWhereClause: any = {
        departureTime: {
          gte: currentTimeString,
        },
      };
      
      if (stopIds && stopIds.length > 0) {
        if (stopIds.length === 1) {
          stopTimeWhereClause.stopId = stopIds[0];
        } else {
          stopTimeWhereClause.stopId = {
            in: stopIds,
          };
        }
      }
      
      // Rechercher les horaires théoriques
      const theoreticalResults = await prisma.stopTime.findMany({
        where: stopTimeWhereClause,
        take: queryLimit,
        orderBy: {
          departureTime: "asc",
        },
        select: {
          tripId: true,
          stopId: true,
          arrivalTime: true,
          departureTime: true,
          stopSequence: true,
          trip: {
            select: {
              routeId: true,
              directionId: true,
              headsign: true,
              route: {
                select: {
                  shortName: true,
                  longName: true,
                  color: true,
                  type: true,
                },
              },
            },
          },
          stop: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });
      
      console.log(`[API] Récupéré ${theoreticalResults.length} horaires théoriques`);
      
      // Convertir les horaires théoriques au même format que les temps réel
      const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
      
      theoreticalDepartures = theoreticalResults
        .filter((result) => !existingTripIds.has(result.tripId)) // Exclure ceux déjà en temps réel
        .map((result) => {
          // Convertir l'heure théorique en timestamp
          const departureTimeParts = result.departureTime.split(':');
          let hours = parseInt(departureTimeParts[0], 10);
          const minutes = parseInt(departureTimeParts[1], 10);
          const seconds = parseInt(departureTimeParts[2], 10);
          
          // Gérer les heures > 23 (service après minuit du jour suivant)
          let dateStr = currentDate;
          if (hours >= 24) {
            const nextDay = new Date(now);
            nextDay.setDate(nextDay.getDate() + 1);
            dateStr = nextDay.toISOString().split('T')[0];
            hours = hours % 24;
          }
          
          // Créer un timestamp et une date
          const scheduledTime = new Date(`${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          const timestampMs = scheduledTime.getTime();
          
          // Ne garder que les départs futurs et dans la fenêtre spécifiée
          if (timestampMs < nowTime || timestampMs > nowTime + (3 * 60 * 60 * 1000)) {
            return null;
          }
          
          // Formatage des données au même format que les départs temps réel
          const routeId = result.trip?.routeId || '';
          const stopId = result.stopId;
          const directionHeadsign = result.trip?.headsign || '';
          
          return {
            tripId: result.tripId,
            routeId: routeId,
            stopId: stopId,
            directionHeadsign: directionHeadsign,
            routeStopKey: `${routeId}_${stopId}`,
            tripStopKey: `${result.tripId}_${stopId}`,
            estimatedTime: scheduledTime,
            scheduledTime: scheduledTime,
            isRealtime: false, // Indiquer que c'est un horaire théorique
            collectedAt: new Date(), // Utiliser la date actuelle
            line: {
              id: routeId,
              number: result.trip?.route?.shortName || '',
              name: result.trip?.route?.longName || '',
              color: result.trip?.route?.color ? `#${result.trip?.route?.color}` : null,
              type: result.trip?.route?.type || 0,
            },
            stop: {
              id: stopId,
              name: result.stop?.name || '',
              code: result.stop?.code || null,
            },
            direction: {
              id: result.trip?.directionId,
              headsign: directionHeadsign || "Direction inconnue",
            },
            delay: 0, // Pas de retard pour les horaires théoriques
            timestampMs: timestampMs,
            timeKey: formatTime(scheduledTime), // Ajouter une clé de temps pour regrouper les départs à la même minute
          };
        })
        .filter(Boolean); // Filtrer les éléments null
        
      console.log(`[API] Horaires théoriques valides après filtrage: ${theoreticalDepartures.length}`);
    }
    
    // Fusionner les départs temps réel et théoriques
    const allDepartures = [...dedupedDepartures, ...theoreticalDepartures];
    console.log(`[API] Total départs après fusion: ${allDepartures.length}`);
    
    // Phase supplémentaire: Déduplication forte basée sur les horaires identiques pour la même ligne/direction
    const uniqueTimeMap = new Map<string, any>();
    const uniqueDepartures: any[] = [];
    
    // Trier d'abord par heure pour traiter les plus proches en premier
    allDepartures.sort((a, b) => a.timestampMs - b.timestampMs);
    for (const departure of allDepartures) {
      // Clé unique basée sur ligne + direction + heure formatée en minutes
      const uniqueTimeKey = `${departure.line.number}_${departure.direction.headsign}_${departure.timeKey}`;
      
      // Ne garder qu'un seul départ par minute pour chaque ligne/direction
      if (!uniqueTimeMap.has(uniqueTimeKey)) {
        uniqueTimeMap.set(uniqueTimeKey, departure);
        uniqueDepartures.push(departure);
      } else {
        // Pour un départ à la même minute, on préfère le départ en temps réel
        const existingDeparture = uniqueTimeMap.get(uniqueTimeKey);
        if (departure.isRealtime === true && existingDeparture.isRealtime === false) {
          // Remplacer le départ théorique par le départ temps réel
          const index = uniqueDepartures.indexOf(existingDeparture);
          if (index !== -1) {
            uniqueDepartures[index] = departure;
            uniqueTimeMap.set(uniqueTimeKey, departure);
          }
        }
      }
    }
    
    console.log(`[API] Départs après déduplication par horaire: ${uniqueDepartures.length}`);
    
    // Tri par heure estimée de départ
    uniqueDepartures.sort((a, b) => a.timestampMs - b.timestampMs);
    
    // Calculer le nombre de routes distinctes
    const uniqueRouteIds = new Set(uniqueDepartures.map(d => d.routeId));
    const routeCount = uniqueRouteIds.size;
    
    // Ajuster dynamiquement maxPerRouteStop si nécessaire pour atteindre le minimum de départs
    if (routeCount > 0 && routeCount * maxPerRouteStop < requestedLimit) {
      const oldMax = maxPerRouteStop;
      maxPerRouteStop = Math.ceil(requestedLimit / routeCount);
      console.log(`[API] Ajustement de maxPerRouteStop: ${oldMax} -> ${maxPerRouteStop} (${routeCount} routes distinctes)`);
    }
    
    // Phase 2: Déduplication intelligente pour garder les départs les plus pertinents
    // Pour chaque combinaison route+arrêt, garder au plus maxPerRouteStop départs
    const routeStopCounts = new Map<string, number>();
    const uniqueRoutes = new Set<string>();
    const filteredDepartures = [];
    
    // Première passe: répartir équitablement les places disponibles entre les routes
    for (const departure of uniqueDepartures) {
      const key = departure.routeStopKey;
      const count = routeStopCounts.get(key) || 0;
      
      if (count < maxPerRouteStop) {
        filteredDepartures.push(departure);
        routeStopCounts.set(key, count + 1);
        uniqueRoutes.add(departure.routeId);
        
        // Si on a atteint assez de départs, on peut s'arrêter
        if (filteredDepartures.length >= requestedLimit) {
          break;
        }
      }
    }
    
    // Seconde passe si on n'a pas assez de départs: ignorer la limite par route
    if (filteredDepartures.length < requestedLimit && uniqueDepartures.length > filteredDepartures.length) {
      console.log(`[API] Pas assez de départs avec la limite par route, ajout sans restriction`);
      
      // Créer un ensemble des tripIds déjà inclus
      const includedTripIds = new Set(filteredDepartures.map(d => d.tripId));
      
      // Ajouter des départs supplémentaires sans tenir compte de la limite par route
      for (const departure of uniqueDepartures) {
        // Éviter les doublons de tripId
        if (!includedTripIds.has(departure.tripId)) {
          filteredDepartures.push(departure);
          includedTripIds.add(departure.tripId);
          uniqueRoutes.add(departure.routeId);
          
          // Si on a atteint assez de départs, on peut s'arrêter
          if (filteredDepartures.length >= requestedLimit) {
            break;
          }
        }
      }
    }
    
    // Trier les départs par timestamp
    filteredDepartures.sort((a, b) => a.timestampMs - b.timestampMs);
    
    console.log(`[API] Départs après filtrage: ${filteredDepartures.length}`);
    console.log(`[API] Lignes uniques: ${uniqueRoutes.size}`);

    // Phase 3: Formatage final pour l'API
    const formattedDepartures = filteredDepartures.map((departure) => {
      return {
        tripId: departure.tripId,
        line: departure.line,
        stop: departure.stop,
        direction: departure.direction,
        delay: departure.delay,
        isRealtime: departure.isRealtime,
        scheduledTime: departure.scheduledTime ? departure.scheduledTime.toISOString() : null,
        estimatedTime: departure.estimatedTime ? departure.estimatedTime.toISOString() : null,
        formattedScheduled: departure.scheduledTime ? formatTime(departure.scheduledTime) : null,
        formattedEstimated: departure.estimatedTime ? formatTime(departure.estimatedTime) : null,
      };
    });

    // Si on a toujours moins de départs que demandé, on peut ajouter un log
    if (formattedDepartures.length < requestedLimit) {
      console.log(`[API] Attention: Seulement ${formattedDepartures.length}/${requestedLimit} départs disponibles`);
    }

    // Limiter au nombre exact demandé
    const finalDepartures = formattedDepartures.slice(0, requestedLimit);
    
    return NextResponse.json(finalDepartures);
  } catch (error) {
    console.error("[API] Erreur lors de la récupération des départs:", error);
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

// Fonction pour formater l'heure au format GTFS (HH:MM:SS)
function formatTimeForGTFS(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}