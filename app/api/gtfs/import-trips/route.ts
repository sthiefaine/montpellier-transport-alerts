// /app/api/gtfs/import-trips/route.ts (version avec vérification des clés étrangères)
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";

// Importer les modules communs
import { validateAuth } from "../common/auth";
import { getOrDownloadExtraction } from "../common/auto-download";

const prisma = new PrismaClient();
const CHUNK_SIZE = 5000; // Taille des chunks par défaut

export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json(
        {
          error: "Non autorisé",
          info: "Veuillez fournir un token valide",
        },
        { status: 401 }
      );
    }

    // Vérifier si on doit utiliser le mode chunks
    const url = new URL(request.url);
    const chunkParam = url.searchParams.get("chunk");

    // Option pour vérifier ou ignorer les contraintes de clé étrangère
    const skipValidation = url.searchParams.get("skipValidation") === "true";

    // Obtenir et vérifier le répertoire d'extraction (avec téléchargement automatique si nécessaire)
    let extractionPath;
    try {
      extractionPath = await getOrDownloadExtraction();

      if (!extractionPath) {
        return NextResponse.json(
          {
            error: "Impossible d'obtenir un répertoire d'extraction valide",
            message:
              "Réessayez ou vérifiez les permissions du système de fichiers",
          },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error(
        "Erreur lors de la récupération du répertoire d'extraction:",
        error
      );
      return NextResponse.json(
        {
          error: "Erreur lors de la récupération du répertoire d'extraction",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }

    // Si un paramètre chunk est fourni, utiliser le mode chunks
    if (chunkParam !== null) {
      const chunk = parseInt(chunkParam);
      const result = await importTripsChunk(
        extractionPath,
        chunk,
        skipValidation
      );

      return NextResponse.json({
        status: "success",
        message: `Importation des voyages (chunk ${chunk}) terminée`,
        details: result,
        nextChunk: result.hasMore ? chunk + 1 : null,
      });
    }

    // Sinon, importer tous les voyages d'un coup
    const result = await importAllTrips(extractionPath, skipValidation);

    return NextResponse.json({
      status: "success",
      message: "Importation complète des voyages terminée",
      details: result,
    });
  } catch (error) {
    console.error("Erreur lors de l'importation des voyages:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de l'importation des voyages",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Fonction pour importer TOUS les voyages d'un coup
async function importAllTrips(
  extractionPath: string,
  skipValidation: boolean = false
) {
  console.log("Importation de tous les voyages (trips)...");

  const tripsPath = path.join(extractionPath, "trips.txt");

  // Vérifier que le fichier existe
  if (!fs.existsSync(tripsPath)) {
    throw new Error(
      `Le fichier trips.txt n'existe pas dans le répertoire d'extraction: ${extractionPath}`
    );
  }

  // Récupérer la liste des routes existantes pour valider les clés étrangères
  let validRouteIds = new Set<string>();

  if (!skipValidation) {
    console.log("Récupération des IDs de routes pour validation...");
    const routes = await prisma.route.findMany({
      select: { id: true },
    });
    validRouteIds = new Set(routes.map((route) => route.id));
    console.log(
      `${validRouteIds.size} routes valides trouvées dans la base de données`
    );
  }

  const results: any[] = [];

  return new Promise<{
    status: string;
    message: string;
    count: number;
    skippedCount: number;
  }>((resolve, reject) => {
    fs.createReadStream(tripsPath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          console.log(`Total de ${results.length} voyages à importer`);

          // Supprimer tous les voyages existants
          console.log("Suppression des voyages existants...");
          await prisma.trip.deleteMany({});

          // Filtrer les voyages avec des routes valides si la validation est activée
          let filteredTrips = results;
          let skippedCount = 0;

          if (!skipValidation) {
            filteredTrips = results.filter((trip) => {
              const hasValidRoute = validRouteIds.has(
                String(trip.route_id || "")
              );
              if (!hasValidRoute) {
                skippedCount++;
                if (skippedCount < 10) {
                  console.log(`Route invalide ignorée: ${trip.route_id}`);
                } else if (skippedCount === 10) {
                  console.log(
                    `D'autres routes invalides seront ignorées silencieusement...`
                  );
                }
              }
              return hasValidRoute;
            });

            console.log(
              `${skippedCount} voyages ignorés à cause de routes invalides`
            );
          }

          // Préparer les données à insérer
          const tripsToInsert = filteredTrips.map((trip) => ({
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
          }));

          // Utiliser createMany si possible (plus rapide), sinon revenir à la méthode des transactions
          let importedCount = 0;

          try {
            // Importer les voyages par lots de 10000 pour createMany
            const batchSize = 10000;
            for (let i = 0; i < tripsToInsert.length; i += batchSize) {
              const batch = tripsToInsert.slice(i, i + batchSize);

              // Utiliser createMany
              const result = await prisma.trip.createMany({
                data: batch,
                skipDuplicates: true,
              });

              importedCount += result.count;
              console.log(
                `Importé ${importedCount}/${
                  tripsToInsert.length
                } voyages (${Math.round(
                  (importedCount / tripsToInsert.length) * 100
                )}%)`
              );
            }
          } catch (error) {
            console.error(
              "Erreur avec createMany, retour à la méthode des transactions:",
              error
            );

            // Si createMany échoue, utiliser la méthode des transactions par petits lots
            importedCount = 0;
            const batchSize = 1000;

            for (let i = 0; i < tripsToInsert.length; i += batchSize) {
              const batch = tripsToInsert.slice(i, i + batchSize);

              await prisma.$transaction(
                batch.map((trip) => prisma.trip.create({ data: trip }))
              );

              importedCount += batch.length;
              console.log(
                `Importé ${importedCount}/${tripsToInsert.length} voyages (méthode alternative)`
              );
            }
          }

          resolve({
            status: "success",
            message: `Importation des voyages terminée`,
            count: importedCount,
            skippedCount: skippedCount,
          });
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

// Fonction pour importer les voyages par chunk
async function importTripsChunk(
  extractionPath: string,
  chunk: number,
  skipValidation: boolean = false
) {
  console.log(`Importation des voyages (trips) - chunk ${chunk}...`);
  const tripsPath = path.join(extractionPath, "trips.txt");

  // Vérifier que le fichier existe
  if (!fs.existsSync(tripsPath)) {
    throw new Error(
      `Le fichier trips.txt n'existe pas dans le répertoire d'extraction: ${extractionPath}`
    );
  }

  // Récupérer la liste des routes existantes pour valider les clés étrangères
  let validRouteIds = new Set<string>();

  if (!skipValidation) {
    console.log("Récupération des IDs de routes pour validation...");
    const routes = await prisma.route.findMany({
      select: { id: true },
    });
    validRouteIds = new Set(routes.map((route) => route.id));
    console.log(
      `${validRouteIds.size} routes valides trouvées dans la base de données`
    );
  }

  // Supprimer les voyages existants seulement pour le premier chunk
  if (chunk === 0) {
    console.log("Suppression des voyages existants...");
    await prisma.trip.deleteMany({});
  }

  // Lire tous les voyages mais ne traiter que le chunk actuel
  const results: any[] = [];

  return new Promise<{
    status: string;
    message: string;
    imported: number;
    total: number;
    startIndex: number;
    endIndex: number;
    hasMore: boolean;
    skippedCount: number;
  }>((resolve, reject) => {
    fs.createReadStream(tripsPath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          const totalTrips = results.length;
          const startIndex = chunk * CHUNK_SIZE;
          let endIndex = startIndex + CHUNK_SIZE;

          if (endIndex > totalTrips) {
            endIndex = totalTrips;
          }

          const hasMore = endIndex < totalTrips;

          // Extraire uniquement le chunk actuel
          const chunkData = results.slice(startIndex, endIndex);

          // Filtrer les voyages avec des routes valides si la validation est activée
          let filteredChunkData = chunkData;
          let skippedCount = 0;

          if (!skipValidation) {
            filteredChunkData = chunkData.filter((trip) => {
              const hasValidRoute = validRouteIds.has(
                String(trip.route_id || "")
              );
              if (!hasValidRoute) {
                skippedCount++;
                if (skippedCount < 10) {
                  console.log(`Route invalide ignorée: ${trip.route_id}`);
                } else if (skippedCount === 10) {
                  console.log(
                    `D'autres routes invalides seront ignorées silencieusement...`
                  );
                }
              }
              return hasValidRoute;
            });

            console.log(
              `${skippedCount} voyages ignorés à cause de routes invalides`
            );
          }

          // Préparer les données à insérer
          const tripsToInsert = filteredChunkData.map((trip) => ({
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
          }));

          // Utiliser createMany si possible (plus rapide), sinon revenir à la méthode des transactions
          let importedCount = 0;

          try {
            // Essayer avec createMany
            const result = await prisma.trip.createMany({
              data: tripsToInsert,
              skipDuplicates: true,
            });

            importedCount = result.count;
          } catch (error) {
            console.error(
              "Erreur avec createMany, retour à la méthode des transactions:",
              error
            );

            // Si createMany échoue, utiliser la méthode des transactions
            const batchSize = 100;

            for (let i = 0; i < tripsToInsert.length; i += batchSize) {
              const batch = tripsToInsert.slice(i, i + batchSize);

              await prisma.$transaction(
                batch.map((trip) => prisma.trip.create({ data: trip }))
              );

              importedCount += batch.length;
              console.log(
                `Chunk ${chunk}: Importé ${
                  startIndex + i + Math.min(batchSize, batch.length)
                }/${totalTrips} voyages (méthode alternative)`
              );
            }
          }

          console.log(
            `Chunk ${chunk}: Importé ${importedCount} voyages (${startIndex}-${endIndex}/${totalTrips})`
          );

          resolve({
            status: "success",
            message: `Importé le chunk ${chunk} (${importedCount} voyages)`,
            imported: importedCount,
            total: totalTrips,
            startIndex,
            endIndex,
            hasMore,
            skippedCount,
          });
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

// Permettre aussi les requêtes POST pour les déclenchements manuels
export async function POST(request: Request) {
  return GET(request);
}
