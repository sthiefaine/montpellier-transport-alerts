// app/api/gtfs/departures/next/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const stopId = url.searchParams.get("stopId");
    const routeId = url.searchParams.get("routeId");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    
    // Date actuelle
    const now = new Date();
    
    // Filtres de base
    const whereClause: any = {
      collectedAt: {
        // Utiliser uniquement les données récentes (15 dernières minutes)
        gte: new Date(now.getTime() - 15 * 60 * 1000)
      },
      status: "SCHEDULED",
      // Filtrer uniquement les départs futurs
      AND: [
        {
          OR: [
            // Cas 1: Nous avons un actualTime (heure de passage réellement prévue)
            {
              actualTime: {
                gt: Math.floor(now.getTime() / 1000) // Convertir en timestamp Unix
              }
            },
            // Cas 2: Nous n'avons pas d'actualTime mais un delay positif
            {
              actualTime: null,
              delay: { gt: 0 }
            }
          ]
        }
      ]
    };
    
    // Ajouter le filtre par arrêt si spécifié
    if (stopId) {
      whereClause.stopId = stopId;
    }
    
    // Ajouter le filtre par ligne si spécifié
    if (routeId) {
      whereClause.routeId = routeId;
    }
    
    // Récupérer les prochains départs avec les détails correspondants
    const nextDepartures = await prisma.realtimeDelay.findMany({
      where: whereClause,
      take: limit * 3, // Récupérer plus de résultats pour tenir compte des doublons
      orderBy: {
        actualTime: "asc"
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
            color: true
          }
        },
        stop: {
          select: {
            name: true,
            code: true
          }
        },
        trip: {
          select: {
            headsign: true,
            directionId: true
          }
        }
      }
    });
    
    // Si aucun départ n'est trouvé
    if (nextDepartures.length === 0) {
      return NextResponse.json(
        { message: "Aucun départ trouvé pour les critères spécifiés" },
        { status: 404 }
      );
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
        scheduledTime = new Date(Number(actualTimeMs) - Number(departure.delay) * 1000);
      }
      
      if (!scheduledTime) continue;
      
      // Créer une clé unique basée sur la ligne, la destination et l'heure planifiée
      // Arrondir l'heure planifiée à la minute pour regrouper les départs très proches
      const scheduledMinute = Math.floor(scheduledTime.getTime() / 60000);
      const directionHeadsign = departure.trip?.headsign || "";
      const uniqueKey = `${departure.routeId}_${directionHeadsign}_${scheduledMinute}`;
      
      if (!uniqueKeys.has(uniqueKey)) {
        uniqueKeys.add(uniqueKey);
        deduplicatedDepartures.push(departure);
        
        // Arrêter quand on atteint la limite demandée
        if (deduplicatedDepartures.length >= limit) break;
      }
    }
    
    // Enrichir les données avec les heures calculées
    const formattedDepartures = deduplicatedDepartures.map(departure => {
      // Calculer l'heure de référence (heure planifiée)
      let scheduledTime = null;
      let estimatedTime = null;
      
      // Si nous avons un actualTime et un delay, nous pouvons calculer l'heure planifiée
      if (departure.actualTime) {
        const actualTimeMs = BigInt(departure.actualTime) * BigInt(1000); // Convertir en millisecondes
        estimatedTime = new Date(Number(actualTimeMs));
        
        // Calculer l'heure planifiée en soustrayant le retard
        if (departure.delay !== null) {
          scheduledTime = new Date(Number(actualTimeMs) - departure.delay * 1000);
        } else {
          scheduledTime = estimatedTime; // Par défaut, utiliser la même heure
        }
      }
      
      return {
        tripId: departure.tripId,
        line: {
          id: departure.routeId,
          number: departure.route.shortName,
          name: departure.route.longName,
          color: departure.route.color ? `#${departure.route.color}` : null
        },
        stop: {
          id: departure.stopId,
          name: departure.stop.name,
          code: departure.stop.code
        },
        direction: {
          id: departure.trip?.directionId,
          headsign: departure.trip?.headsign || "Direction inconnue"
        },
        delay: departure.delay,
        scheduledTime: scheduledTime ? scheduledTime.toISOString() : null,
        estimatedTime: estimatedTime ? estimatedTime.toISOString() : null,
        // Pour l'affichage formaté des heures
        formattedScheduled: scheduledTime ? formatTime(scheduledTime) : null,
        formattedEstimated: estimatedTime ? formatTime(estimatedTime) : null
      };
    });
    
    return NextResponse.json(formattedDepartures);
  } catch (error) {
    console.error("Erreur lors de la récupération des prochains départs:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Fonction utilitaire pour formater l'heure en HH:MM
function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}