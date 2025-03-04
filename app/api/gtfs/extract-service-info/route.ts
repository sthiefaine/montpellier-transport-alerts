// app/api/gtfs/extract-service-info/route.ts
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

export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    console.log(
      "Extraction des informations de service et séquence d'arrêts..."
    );

    // 1. Extraire les horaires de service par ligne
    await extractServiceTimes();

    // 2. Extraire la séquence des arrêts
    await extractStopSequences();

    return NextResponse.json({
      status: "success",
      message: "Informations de service et séquence d'arrêts extraites",
    });
  } catch (error) {
    console.error(
      "Erreur lors de l'extraction des informations de service:",
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

// Extraire les horaires de début et fin de service par ligne et par service
async function extractServiceTimes() {
  console.log("Extraction des horaires de service...");

  // Nettoyer la table existante
  await prisma.routeServiceTime.deleteMany({});

  // Extraire les heures de début et fin de service par ligne
  const serviceTimesRaw = await prisma.$queryRaw`
    WITH trip_times AS (
      SELECT 
        t."route_id",
        t."service_id",
        MIN(st."arrival_time") AS first_arrival,
        MAX(st."departure_time") AS last_departure
      FROM "trips" t
      JOIN "stop_times" st ON t."trip_id" = st."trip_id"
      GROUP BY t."route_id", t."service_id"
    )
    SELECT 
      tt."route_id",
      tt."service_id",
      tt.first_arrival AS start_time,
      tt.last_departure AS end_time
    FROM trip_times tt
  `;

  if (!Array.isArray(serviceTimesRaw) || serviceTimesRaw.length === 0) {
    console.log("Aucun horaire de service trouvé");
    return;
  }

  // Insérer les données extraites
  const insertions = [];
  for (const service of serviceTimesRaw) {
    try {
      const result = await prisma.routeServiceTime.create({
        data: {
          routeId: service.route_id,
          serviceId: service.service_id,
          startTime: service.start_time,
          endTime: service.end_time,
        },
      });
      insertions.push(result);
    } catch (error) {
      console.error(
        `Erreur lors de l'insertion de l'horaire pour la ligne ${service.route_id}:`,
        error
      );
    }
  }

  console.log(`${insertions.length} horaires de service insérés`);
}

// Extraire la séquence des arrêts pour chaque ligne
async function extractStopSequences() {
  console.log("Extraction des séquences d'arrêts...");

  // Nettoyer la table existante
  await prisma.stopSequence.deleteMany({});

  // Extraire la séquence des arrêts par ligne et direction
  const stopSequencesRaw = await prisma.$queryRaw`
    WITH trip_stop_counts AS (
      SELECT 
        t."trip_id",
        t."route_id",
        t."direction_id",
        COUNT(st."stop_id") AS stop_count
      FROM "trips" t
      JOIN "stop_times" st ON t."trip_id" = st."trip_id"
      GROUP BY t."trip_id", t."route_id", t."direction_id"
    ),
    trip_with_most_stops AS (
      SELECT 
        tsc."route_id",
        tsc."direction_id",
        tsc."trip_id"
      FROM trip_stop_counts tsc
      INNER JOIN (
        SELECT "route_id", "direction_id", MAX(stop_count) AS max_stops
        FROM trip_stop_counts
        GROUP BY "route_id", "direction_id"
      ) max_tsc ON tsc."route_id" = max_tsc."route_id" 
                AND tsc."direction_id" = max_tsc."direction_id" 
                AND tsc.stop_count = max_tsc.max_stops
      LIMIT 1
    ),
    stop_positions AS (
      SELECT 
        t."route_id",
        t."direction_id",
        st."stop_id",
        st."stop_sequence" AS position,
        CASE 
          WHEN ROW_NUMBER() OVER (PARTITION BY t."route_id", t."direction_id" ORDER BY st."stop_sequence") = 1 
           OR ROW_NUMBER() OVER (PARTITION BY t."route_id", t."direction_id" ORDER BY st."stop_sequence" DESC) = 1
          THEN TRUE
          ELSE FALSE
        END AS is_terminus
      FROM "trips" t
      JOIN trip_with_most_stops tms ON t."trip_id" = tms."trip_id"
      JOIN "stop_times" st ON t."trip_id" = st."trip_id"
      ORDER BY t."route_id", t."direction_id", st."stop_sequence"
    )
    SELECT * FROM stop_positions
  `;

  if (!Array.isArray(stopSequencesRaw) || stopSequencesRaw.length === 0) {
    console.log("Aucune séquence d'arrêts trouvée");
    return;
  }

  // Insérer les données extraites
  const insertions = [];
  for (const sequence of stopSequencesRaw) {
    try {
      const result = await prisma.stopSequence.create({
        data: {
          routeId: sequence.route_id,
          stopId: sequence.stop_id,
          directionId: sequence.direction_id || 0,
          position: Number(sequence.position),
          isTerminus: sequence.is_terminus || false,
        },
      });
      insertions.push(result);
    } catch (error) {
      console.error(
        `Erreur lors de l'insertion de la séquence pour l'arrêt ${sequence.stop_id}:`,
        error
      );
    }
  }

  console.log(`${insertions.length} séquences d'arrêts insérées`);
}
