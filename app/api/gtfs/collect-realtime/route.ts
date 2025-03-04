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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

  // Préparer les données à insérer
  const delaysToInsert: any[] = [];

  for (const entity of feed.entity) {
    if (entity.tripUpdate) {
      const tripUpdate = entity.tripUpdate;
      // Vérifier que trip existe et contient les propriétés nécessaires
      if (!tripUpdate.trip) continue;

      const tripId = String(tripUpdate.trip.tripId || "");
      const routeId = String(tripUpdate.trip.routeId || "");

      // Vérifier que stopTimeUpdate est un tableau
      if (
        !tripUpdate.stopTimeUpdate ||
        !Array.isArray(tripUpdate.stopTimeUpdate)
      )
        continue;

      for (const stu of tripUpdate.stopTimeUpdate) {
        // Vérifier que scheduleRelationship existe
        if (!stu.scheduleRelationship) continue;

        // Convertir scheduleRelationship en string
        const scheduleRelationshipStr = String(stu.scheduleRelationship);

        // Traiter seulement les mises à jour planifiées ou sautées
        if (["SCHEDULED", "SKIPPED"].includes(scheduleRelationshipStr)) {
          const stopId = String(stu.stopId || "");
          const status = scheduleRelationshipStr;

          // Traiter l'arrivée si elle existe
          if (stu.arrival) {
            // Extraire time et delay en gérant les undefined
            let actualTimeValue = null;
            
            if (stu.arrival.time) {
              // Convertir en nombre normal au lieu de BigInt
              if (typeof stu.arrival.time === "object" && "low" in stu.arrival.time) {
                actualTimeValue = Number(stu.arrival.time.low || 0);
              } else {
                actualTimeValue = Number(stu.arrival.time);
              }
            }

            const delay =
              stu.arrival.delay !== undefined && stu.arrival.delay !== null
                ? Number(stu.arrival.delay)
                : null;

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
    }
  }

  console.log(
    `Préparation de ${delaysToInsert.length} enregistrements à insérer`
  );

  // Insérer les données
  const result = await prisma.realtimeDelay.createMany({
    data: delaysToInsert.map((delay) => ({
      tripId: delay.tripId,
      routeId: delay.routeId,
      stopId: delay.stopId,
      scheduledTime: delay.scheduledTime,
      actualTime: delay.actualTime,
      delay: delay.delay,
      status: delay.status,
    })),
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
}