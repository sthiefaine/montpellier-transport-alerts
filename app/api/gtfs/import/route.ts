export const maxDuration = 300;
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import * as os from "os";
import AdmZip from "adm-zip";

const prisma = new PrismaClient();

const IMPORT_TOKEN = process.env.CRON_SECRET;

// Fonction pour vérifier l'authentification
function validateAuth(request: Request) {
  // Vérifier l'en-tête d'autorisation
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7); // Extraire le token après "Bearer "
  return token === IMPORT_TOKEN;
}

// Gérer les requêtes GET (pour les cron jobs Vercel)
export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    return await processImport();
  } catch (error) {
    console.error("Erreur lors de l'importation GTFS:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'importation GTFS" },
      { status: 500 }
    );
  }
}

// Gérer les requêtes POST (pour les appels manuels)
export async function POST(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    return await processImport();
  } catch (error) {
    console.error("Erreur lors de l'importation GTFS:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'importation GTFS" },
      { status: 500 }
    );
  }
}

// Fonction commune pour traiter l'importation
async function processImport() {
  // Créer un dossier temporaire pour l'extraction
  const tempDir = path.join(os.tmpdir(), "gtfs-" + Date.now());
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // Télécharger le fichier GTFS
    console.log("Téléchargement des données GTFS statiques...");
    const response = await axios({
      method: "get",
      url: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip",
      responseType: "arraybuffer",
    });

    // Écrire le fichier téléchargé
    const zipPath = path.join(tempDir, "gtfs.zip");
    fs.writeFileSync(zipPath, response.data);

    // Extraire le contenu du zip avec AdmZip
    console.log("Extraction du fichier zip...");
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(tempDir, true);

    console.log("Extraction terminée, début de l'importation");

    // Importer les arrêts
    await importStops(tempDir);

    // Importer les lignes (routes)
    await importRoutes(tempDir);

    // Importer les voyages (trips)
    await importTrips(tempDir);

    // Si vous voulez importer les horaires également
    // await importStopTimes(tempDir);

    return NextResponse.json({
      status: "success",
      message: "Importation GTFS terminée",
    });
  } catch (error) {
    throw error;
  } finally {
    // Nettoyer les fichiers temporaires
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function importStops(extractionPath: string) {
  console.log("Importation des arrêts...");
  const results: any[] = [];

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(path.join(extractionPath, "stops.txt"))
      .pipe(csv())
      .on("data", (data: any) => results.push(data))
      .on("end", async () => {
        try {
          // Avec le schéma mis à jour avec onDelete: Cascade,
          // nous pouvons simplement supprimer tous les arrêts
          await prisma.stop.deleteMany({});

          // Importer les arrêts par lots
          const batchSize = 100;
          for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);

            await prisma.$transaction(
              batch.map((stop) =>
                prisma.stop.create({
                  data: {
                    id: stop.stop_id,
                    code: stop.stop_code || null,
                    name: stop.stop_name,
                    lat: parseFloat(stop.stop_lat),
                    lon: parseFloat(stop.stop_lon),
                    locationType: stop.location_type
                      ? parseInt(stop.location_type)
                      : 0,
                    parentStation: stop.parent_station || null,
                    wheelchair: stop.wheelchair_boarding
                      ? parseInt(stop.wheelchair_boarding)
                      : null,
                  },
                })
              )
            );

            console.log(
              `Importé ${Math.min(i + batchSize, results.length)}/${
                results.length
              } arrêts`
            );
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

async function importRoutes(extractionPath: string) {
  console.log("Importation des lignes (routes)...");
  const results: any[] = [];

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(path.join(extractionPath, "routes.txt"))
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          // Avec le schéma mis à jour, nous pouvons simplement supprimer toutes les routes
          await prisma.route.deleteMany({});

          // Importer les routes par lots
          const batchSize = 50;
          for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);

            await prisma.$transaction(
              batch.map((route) =>
                prisma.route.create({
                  data: {
                    id: String(route.route_id || ""),
                    shortName: String(route.route_short_name || ""),
                    longName: String(route.route_long_name || ""),
                    type: parseInt(route.route_type || "0"),
                    color: route.route_color || null,
                    textColor: route.route_text_color || null,
                  },
                })
              )
            );

            console.log(
              `Importé ${Math.min(i + batchSize, results.length)}/${
                results.length
              } routes`
            );
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

async function importTrips(extractionPath: string) {
  console.log("Importation des voyages (trips)...");
  const results: any[] = [];

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(path.join(extractionPath, "trips.txt"))
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          // Avec le schéma mis à jour, nous pouvons simplement supprimer tous les voyages
          await prisma.trip.deleteMany({});

          const batchSize = 100;
          for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);

            await prisma.$transaction(
              batch.map((trip) =>
                prisma.trip.create({
                  data: {
                    id: String(trip.trip_id || ""),
                    routeId: String(trip.route_id || ""),
                    serviceId: String(trip.service_id || ""),
                    headsign: trip.trip_headsign || null,
                    directionId:
                      trip.direction_id !== undefined
                        ? parseInt(trip.direction_id)
                        : null,
                    blockId: trip.block_id || null,
                    shapeId: trip.shape_id || null,
                    wheelchairAccessible:
                      trip.wheelchair_accessible !== undefined
                        ? parseInt(trip.wheelchair_accessible)
                        : null,
                    bikesAllowed:
                      trip.bikes_allowed !== undefined
                        ? parseInt(trip.bikes_allowed)
                        : null,
                  },
                })
              )
            );

            console.log(
              `Importé ${Math.min(i + batchSize, results.length)}/${
                results.length
              } voyages`
            );
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

async function importStopTimes(extractionPath: string) {
  console.log("Importation des horaires (stop_times)...");
  const results: any[] = [];

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(path.join(extractionPath, "stop_times.txt"))
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          // Avec le schéma mis à jour, nous pouvons simplement supprimer tous les horaires
          await prisma.stopTime.deleteMany({});

          // Importer les horaires par lots
          const batchSize = 100;
          for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);

            await prisma.$transaction(
              batch.map((st) =>
                prisma.stopTime.create({
                  data: {
                    tripId: String(st.trip_id || ""),
                    arrivalTime: String(st.arrival_time || ""),
                    departureTime: String(st.departure_time || ""),
                    stopId: String(st.stop_id || ""),
                    stopSequence: parseInt(st.stop_sequence || "0"),
                    pickupType:
                      st.pickup_type !== undefined
                        ? parseInt(st.pickup_type)
                        : null,
                    dropOffType:
                      st.drop_off_type !== undefined
                        ? parseInt(st.drop_off_type)
                        : null,
                  },
                })
              )
            );

            console.log(
              `Importé ${Math.min(i + batchSize, results.length)}/${
                results.length
              } horaires`
            );
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}
