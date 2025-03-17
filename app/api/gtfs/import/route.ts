export const maxDuration = 800;
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import csv from "csv-parser";
import AdmZip from "adm-zip";

const prisma = new PrismaClient();
const IMPORT_TOKEN = process.env.CRON_SECRET;

// Function to validate authorization
function validateAuth(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === IMPORT_TOKEN;
}

// Main endpoint for GTFS import
export async function GET(request: Request) {
  try {
    // Validate authentication
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Parse request parameters
    const url = new URL(request.url);
    const steps = url.searchParams.get("steps") || "all";
    const skipParam = url.searchParams.get("skip") || "";
    const skipSteps = skipParam ? skipParam.split(",") : [];
    const keepRecentHours = parseInt(
      url.searchParams.get("keepRecentHours") || "48"
    );
    const keepLastN = parseInt(url.searchParams.get("keepLastN") || "2");
    const chunkSize = parseInt(url.searchParams.get("chunkSize") || "20000");

    console.log(`Starting GTFS import process with parameters:`, {
      steps,
      skipSteps,
      keepRecentHours,
      keepLastN,
      chunkSize,
    });

    // Create a base directory for GTFS data if it doesn't exist
    const baseDir = path.join(os.tmpdir(), "gtfs-data");
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Create a timestamped directory for this import
    const timestamp = Date.now();
    let extractionPath = path.join(baseDir, timestamp.toString());
    fs.mkdirSync(extractionPath, { recursive: true });

    // Track results for each step
    const results: Record<string, any> = {
      startTime: new Date().toISOString(),
      steps: {},
    };

    // Step 1: Download GTFS data
    if (
      (steps === "all" || steps === "download") &&
      !skipSteps.includes("download")
    ) {
      console.log("Step 1: Downloading GTFS data...");
      const startTime = performance.now();
      await downloadGtfs(extractionPath);

      // Update latest.txt to point to this extraction
      fs.writeFileSync(path.join(baseDir, "latest.txt"), extractionPath);

      results.steps.download = {
        status: "success",
        duration: Math.round((performance.now() - startTime) / 1000),
        path: extractionPath,
      };
      console.log(`Download completed in ${results.steps.download.duration}s`);
    } else {
      console.log("Skipping download step");

      // If we're skipping download, try to use the latest extraction
      if (fs.existsSync(path.join(baseDir, "latest.txt"))) {
        const latestPath = fs
          .readFileSync(path.join(baseDir, "latest.txt"), "utf8")
          .trim();
        if (fs.existsSync(latestPath)) {
          console.log(`Using existing extraction: ${latestPath}`);
          results.steps.download = {
            status: "skipped",
            usingExisting: true,
            path: latestPath,
          };
          // Update extraction path to use the existing one
          extractionPath = latestPath;
        } else {
          return NextResponse.json(
            {
              error: "No valid GTFS extraction found and download step skipped",
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "No valid GTFS extraction found and download step skipped" },
          { status: 400 }
        );
      }
    }

    // Verify that required files exist
    const requiredFiles = [
      "stops.txt",
      "routes.txt",
      "trips.txt",
      "stop_times.txt",
    ];
    const missingFiles = requiredFiles.filter(
      (file) => !fs.existsSync(path.join(extractionPath, file))
    );

    if (missingFiles.length > 0) {
      return NextResponse.json(
        {
          error: "Missing required GTFS files",
          missingFiles,
          extractionPath,
        },
        { status: 500 }
      );
    }

    // Step 2: Import stops
    if (
      (steps === "all" || steps === "stops") &&
      !skipSteps.includes("stops")
    ) {
      console.log("Step 2: Importing stops...");
      const startTime = performance.now();
      const stopsResult = await importStops(extractionPath);
      results.steps.stops = {
        status: "success",
        count: stopsResult.count,
        duration: Math.round((performance.now() - startTime) / 1000),
      };
      console.log(
        `Imported ${stopsResult.count} stops in ${results.steps.stops.duration}s`
      );
    } else {
      console.log("Skipping stops import");
      results.steps.stops = { status: "skipped" };
    }

    // Step 3: Import routes
    if (
      (steps === "all" || steps === "routes") &&
      !skipSteps.includes("routes")
    ) {
      console.log("Step 3: Importing routes...");
      const startTime = performance.now();
      const routesResult = await importRoutes(extractionPath);
      results.steps.routes = {
        status: "success",
        count: routesResult.count,
        duration: Math.round((performance.now() - startTime) / 1000),
      };
      console.log(
        `Imported ${routesResult.count} routes in ${results.steps.routes.duration}s`
      );
    } else {
      console.log("Skipping routes import");
      results.steps.routes = { status: "skipped" };
    }

    // Step 4: Import trips
    if (
      (steps === "all" || steps === "trips") &&
      !skipSteps.includes("trips")
    ) {
      console.log("Step 4: Importing trips...");
      const startTime = performance.now();
      const tripsResult = await importTrips(extractionPath);
      results.steps.trips = {
        status: "success",
        count: tripsResult.count,
        duration: Math.round((performance.now() - startTime) / 1000),
      };
      console.log(
        `Imported ${tripsResult.count} trips in ${results.steps.trips.duration}s`
      );
    } else {
      console.log("Skipping trips import");
      results.steps.trips = { status: "skipped" };
    }

    // Step 5: Import stop times
    if (
      (steps === "all" || steps === "stop-times") &&
      !skipSteps.includes("stop-times")
    ) {
      console.log("Step 5: Importing stop times...");
      const startTime = performance.now();
      const stopTimesResult = await importStopTimesAlternative(
        extractionPath,
        chunkSize
      );
      results.steps.stopTimes = {
        status: "success",
        count: stopTimesResult.count,
        duration: Math.round((performance.now() - startTime) / 1000),
      };
      console.log(
        `Imported ${stopTimesResult.count} stop times in ${results.steps.stopTimes.duration}s`
      );
    } else {
      console.log("Skipping stop times import");
      results.steps.stopTimes = { status: "skipped" };
    }

    // Step 6: Extract service info
    if (
      (steps === "all" || steps === "service-info") &&
      !skipSteps.includes("service-info")
    ) {
      console.log("Step 6: Extracting service info...");
      const startTime = performance.now();
      const serviceInfoResult = await extractServiceInfo();
      results.steps.serviceInfo = {
        status: "success",
        serviceTimesCount: serviceInfoResult.serviceTimesCount,
        stopSequencesCount: serviceInfoResult.stopSequencesCount,
        duration: Math.round((performance.now() - startTime) / 1000),
      };
      console.log(
        `Extracted ${serviceInfoResult.serviceTimesCount} service times and ${serviceInfoResult.stopSequencesCount} stop sequences in ${results.steps.serviceInfo.duration}s`
      );
    } else {
      console.log("Skipping service info extraction");
      results.steps.serviceInfo = { status: "skipped" };
    }

    // Step 7: Cleanup old files
    if (
      (steps === "all" || steps === "cleanup") &&
      !skipSteps.includes("cleanup")
    ) {
      console.log("Step 7: Cleaning up old files...");
      const startTime = performance.now();
      const cleanupResult = await cleanupFiles(
        baseDir,
        extractionPath,
        keepRecentHours,
        keepLastN
      );
      results.steps.cleanup = {
        status: "success",
        cleanedCount: cleanupResult.cleanedCount,
        duration: Math.round((performance.now() - startTime) / 1000),
      };
      console.log(
        `Cleaned up ${cleanupResult.cleanedCount} old directories in ${results.steps.cleanup.duration}s`
      );
    } else {
      console.log("Skipping cleanup");
      results.steps.cleanup = { status: "skipped" };
    }

    // Calculate total duration
    results.endTime = new Date().toISOString();
    results.totalDuration = Math.round(
      (new Date(results.endTime).getTime() -
        new Date(results.startTime).getTime()) /
        1000
    );

    console.log(`GTFS import process completed in ${results.totalDuration}s`);
    return NextResponse.json({
      status: "success",
      message: "GTFS import process completed",
      results,
    });
  } catch (error) {
    console.error("Error in GTFS import process:", error);
    return NextResponse.json(
      {
        error: "Error in GTFS import process",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// POST endpoint (same as GET for flexibility)
export async function POST(request: Request) {
  return GET(request);
}

// Function to download and extract GTFS data
async function downloadGtfs(extractionPath: string): Promise<void> {
  console.log("Downloading GTFS data...");

  // Download the GTFS zip file
  const response = await axios({
    method: "get",
    url: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip",
    responseType: "arraybuffer",
  });

  console.log("GTFS data downloaded, extracting...");

  // Write the downloaded file
  const zipPath = path.join(extractionPath, "gtfs.zip");
  fs.writeFileSync(zipPath, response.data);

  // Extract the content
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractionPath, true);

  console.log("GTFS data extracted");
}

async function importStops(extractionPath: string): Promise<{ count: number }> {
  console.log("Importing stops...");
  const stopsPath = path.join(extractionPath, "stops.txt");
  const stops: any[] = [];

  // Read stops.txt file
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(stopsPath)
      .pipe(csv())
      .on("data", (data) => stops.push(data))
      .on("end", () => resolve())
      .on("error", reject);
  });

  console.log(`Read ${stops.length} stops from file`);

  // Format stops data
  const formattedStops = stops.map((stop) => ({
    id: stop.stop_id,
    code: stop.stop_code || null,
    name: stop.stop_name,
    lat: parseFloat(stop.stop_lat),
    lon: parseFloat(stop.stop_lon),
    locationType: stop.location_type ? parseInt(stop.location_type) : 0,
    parentStation: stop.parent_station || null,
    wheelchair: stop.wheelchair_boarding
      ? parseInt(stop.wheelchair_boarding)
      : null,
  }));

  console.log("Using upsert approach to preserve related statistics...");

  // Option 1: Récupérer les IDs existants pour pouvoir distinguer mises à jour et nouvelles insertions
  const existingStops = await prisma.stop.findMany({
    select: { id: true },
  });

  const existingStopIds = new Set(existingStops.map((stop) => stop.id));

  // Séparer les arrêts à mettre à jour et les nouveaux arrêts
  const stopsToUpdate = formattedStops.filter((stop) =>
    existingStopIds.has(stop.id)
  );
  const stopsToInsert = formattedStops.filter(
    (stop) => !existingStopIds.has(stop.id)
  );

  console.log(
    `Found ${stopsToUpdate.length} stops to update and ${stopsToInsert.length} new stops to insert`
  );

  // Compteur pour le suivi
  let updatedCount = 0;
  let insertedCount = 0;

  // Mettre à jour les arrêts existants par lots
  if (stopsToUpdate.length > 0) {
    console.log("Updating existing stops...");
    const batchSize = 100;

    for (let i = 0; i < stopsToUpdate.length; i += batchSize) {
      const batch = stopsToUpdate.slice(i, i + batchSize);

      // Utiliser des transactions pour mettre à jour par lots
      await prisma.$transaction(
        batch.map((stop) =>
          prisma.stop.update({
            where: { id: stop.id },
            data: {
              code: stop.code,
              name: stop.name,
              lat: stop.lat,
              lon: stop.lon,
              locationType: stop.locationType,
              parentStation: stop.parentStation,
              wheelchair: stop.wheelchair,
            },
          })
        )
      );

      updatedCount += batch.length;

      if (i % 500 === 0 || i + batchSize >= stopsToUpdate.length) {
        console.log(`Updated ${updatedCount}/${stopsToUpdate.length} stops`);
      }
    }
  }

  // Insérer les nouveaux arrêts
  if (stopsToInsert.length > 0) {
    console.log("Inserting new stops...");

    try {
      // Essayer d'abord createMany pour les performances
      const result = await prisma.stop.createMany({
        data: stopsToInsert,
        skipDuplicates: true,
      });

      insertedCount = result.count;
      console.log(`Inserted ${insertedCount} new stops with createMany`);
    } catch (error) {
      console.log(
        "createMany failed, falling back to transaction-based batch insert"
      );

      // Si createMany n'est pas disponible, utiliser les transactions
      const batchSize = 100;

      for (let i = 0; i < stopsToInsert.length; i += batchSize) {
        const batch = stopsToInsert.slice(i, i + batchSize);
        await prisma.$transaction(
          batch.map((stop) => prisma.stop.create({ data: stop }))
        );
        insertedCount += batch.length;

        if (i % 500 === 0 || i + batchSize >= stopsToInsert.length) {
          console.log(
            `Inserted ${insertedCount}/${stopsToInsert.length} new stops`
          );
        }
      }
    }
  }

  const totalCount = updatedCount + insertedCount;
  console.log(
    `Total: Updated ${updatedCount} existing stops and inserted ${insertedCount} new stops`
  );

  return { count: totalCount };
}

async function importRoutes(
  extractionPath: string
): Promise<{ count: number }> {
  console.log("Importing routes...");
  const routesPath = path.join(extractionPath, "routes.txt");
  const routes: any[] = [];

  // Read routes.txt file
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(routesPath)
      .pipe(csv())
      .on("data", (data) => routes.push(data))
      .on("end", () => resolve())
      .on("error", reject);
  });

  console.log(`Read ${routes.length} routes from file`);

  // Format routes data for database operations
  const formattedRoutes = routes.map((route) => ({
    id: String(route.route_id || ""),
    shortName: String(route.route_short_name || ""),
    longName: String(route.route_long_name || ""),
    type: parseInt(route.route_type || "0"),
    color: route.route_color || null,
    textColor: route.route_text_color || null,
  }));

  console.log(
    "Using upsert approach to preserve related data and statistics..."
  );

  // Récupérer les IDs existants pour pouvoir distinguer mises à jour et nouvelles insertions
  const existingRoutes = await prisma.route.findMany({
    select: { id: true },
  });

  const existingRouteIds = new Set(existingRoutes.map((route) => route.id));

  // Séparer les routes à mettre à jour et les nouvelles routes
  const routesToUpdate = formattedRoutes.filter((route) =>
    existingRouteIds.has(route.id)
  );
  const routesToInsert = formattedRoutes.filter(
    (route) => !existingRouteIds.has(route.id)
  );

  console.log(
    `Found ${routesToUpdate.length} routes to update and ${routesToInsert.length} new routes to insert`
  );

  // Compteur pour le suivi
  let updatedCount = 0;
  let insertedCount = 0;

  // Mettre à jour les routes existantes par lots
  if (routesToUpdate.length > 0) {
    console.log("Updating existing routes...");
    const batchSize = 50;

    for (let i = 0; i < routesToUpdate.length; i += batchSize) {
      const batch = routesToUpdate.slice(i, i + batchSize);

      // Utiliser des transactions pour mettre à jour par lots
      await prisma.$transaction(
        batch.map((route) =>
          prisma.route.update({
            where: { id: route.id },
            data: {
              shortName: route.shortName,
              longName: route.longName,
              type: route.type,
              color: route.color,
              textColor: route.textColor,
            },
          })
        )
      );

      updatedCount += batch.length;

      if (i % 200 === 0 || i + batchSize >= routesToUpdate.length) {
        console.log(`Updated ${updatedCount}/${routesToUpdate.length} routes`);
      }
    }
  }

  // Insérer les nouvelles routes
  if (routesToInsert.length > 0) {
    console.log("Inserting new routes...");

    try {
      // Essayer d'abord createMany pour les performances
      const result = await prisma.route.createMany({
        data: routesToInsert,
        skipDuplicates: true,
      });

      insertedCount = result.count;
      console.log(`Inserted ${insertedCount} new routes with createMany`);
    } catch (error) {
      console.log(
        "createMany failed, falling back to transaction-based batch insert"
      );

      // Si createMany n'est pas disponible, utiliser les transactions
      const batchSize = 50;

      for (let i = 0; i < routesToInsert.length; i += batchSize) {
        const batch = routesToInsert.slice(i, i + batchSize);
        await prisma.$transaction(
          batch.map((route) => prisma.route.create({ data: route }))
        );
        insertedCount += batch.length;

        if (i % 200 === 0 || i + batchSize >= routesToInsert.length) {
          console.log(
            `Inserted ${insertedCount}/${routesToInsert.length} new routes`
          );
        }
      }
    }
  }

  const totalCount = updatedCount + insertedCount;
  console.log(
    `Total: Updated ${updatedCount} existing routes and inserted ${insertedCount} new routes`
  );

  return { count: totalCount };
}

// Fonction optimisée pour importer les voyages avec upsertMany via SQL (taille de lot corrigée)
async function importTrips(extractionPath: string): Promise<{ count: number }> {
  console.log("Importing trips with optimized upsertMany approach...");
  const tripsPath = path.join(extractionPath, "trips.txt");
  const trips: any[] = [];

  // Read trips.txt file
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(tripsPath)
      .pipe(csv())
      .on("data", (data) => trips.push(data))
      .on("end", () => resolve())
      .on("error", reject);
  });

  console.log(`Read ${trips.length} trips from file`);

  // Validate route IDs first to avoid foreign key constraint errors
  console.log("Validating route IDs...");
  const validRoutes = await prisma.route.findMany({
    select: { id: true },
  });
  const validRouteIds = new Set(validRoutes.map((r) => r.id));

  console.log(`Found ${validRouteIds.size} valid route IDs`);

  // Filter out trips with invalid route IDs
  const validTrips = trips.filter((trip) =>
    validRouteIds.has(String(trip.route_id || ""))
  );
  console.log(
    `${
      trips.length - validTrips.length
    } trips filtered out due to invalid route IDs`
  );

  // Format trips data for database operations
  const formattedTrips = validTrips.map((trip) => ({
    id: String(trip.trip_id || ""),
    routeId: String(trip.route_id || ""),
    serviceId: String(trip.service_id || ""),
    headsign: trip.trip_headsign || null,
    directionId:
      trip.direction_id !== undefined ? parseInt(trip.direction_id) : null,
    blockId: trip.block_id || null,
    shapeId: trip.shape_id || null,
    wheelchairAccessible:
      trip.wheelchair_accessible !== undefined
        ? parseInt(trip.wheelchair_accessible)
        : null,
    bikesAllowed:
      trip.bikes_allowed !== undefined ? parseInt(trip.bikes_allowed) : null,
  }));

  console.log("Using PostgreSQL upsertMany optimization...");

  // Compteur total
  let totalProcessed = 0;

  // Traiter par lots pour éviter des problèmes de mémoire/performance
  // 9 variables par trip, PostgreSQL a une limite de ~32767 paramètres
  // Donc taille maximale = 32767 / 9 ≈ 3640, on prend 3500 pour être prudent
  const batchSize = 3500;

  for (let i = 0; i < formattedTrips.length; i += batchSize) {
    const batch = formattedTrips.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        formattedTrips.length / batchSize
      )}...`
    );

    try {
      // Construire la requête SQL pour upsert
      // Nous utilisons une Common Table Expression (CTE) pour l'insertion et la mise à jour
      const valuesPlaceholders = batch
        .map(
          (_, index) =>
            `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${
              index * 9 + 4
            }, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${
              index * 9 + 8
            }, $${index * 9 + 9})`
        )
        .join(", ");
      const values = batch.flatMap((trip) => [
        trip.id,
        trip.routeId,
        trip.serviceId,
        trip.headsign,
        trip.directionId,
        trip.blockId,
        trip.shapeId,
        trip.wheelchairAccessible,
        trip.bikesAllowed,
      ]);

      const query = `
        INSERT INTO trips (
          trip_id, route_id, service_id, trip_headsign, direction_id, 
          block_id, shape_id, wheelchair_accessible, bikes_allowed
        )
        VALUES ${valuesPlaceholders}
        ON CONFLICT (trip_id) DO UPDATE SET
          route_id = EXCLUDED.route_id,
          service_id = EXCLUDED.service_id,
          trip_headsign = EXCLUDED.trip_headsign,
          direction_id = EXCLUDED.direction_id,
          block_id = EXCLUDED.block_id,
          shape_id = EXCLUDED.shape_id,
          wheelchair_accessible = EXCLUDED.wheelchair_accessible,
          bikes_allowed = EXCLUDED.bikes_allowed
      `;

      await prisma.$executeRawUnsafe(query, ...values);
      totalProcessed += batch.length;

      console.log(`Processed ${totalProcessed}/${formattedTrips.length} trips`);
    } catch (error) {
      console.error(`Error in batch ${Math.floor(i / batchSize) + 1}:`, error);

      // En cas d'erreur, on essaie de traiter en lots encore plus petits
      console.log("Falling back to smaller batch processing");

      const smallerBatchSize = 500; // Bien plus petit pour s'assurer que ça fonctionne

      for (let j = 0; j < batch.length; j += smallerBatchSize) {
        const smallerBatch = batch.slice(j, j + smallerBatchSize);

        try {
          // Même approche SQL mais avec des lots plus petits
          const smallerValuesPlaceholders = smallerBatch
            .map(
              (_, index) =>
                `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${
                  index * 9 + 4
                }, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${
                  index * 9 + 8
                }, $${index * 9 + 9})`
            )
            .join(", ");
          const smallerValues = smallerBatch.flatMap((trip) => [
            trip.id,
            trip.routeId,
            trip.serviceId,
            trip.headsign,
            trip.directionId,
            trip.blockId,
            trip.shapeId,
            trip.wheelchairAccessible,
            trip.bikesAllowed,
          ]);

          const smallerQuery = `
            INSERT INTO trips (
              trip_id, route_id, service_id, trip_headsign, direction_id, 
              block_id, shape_id, wheelchair_accessible, bikes_allowed
            )
            VALUES ${smallerValuesPlaceholders}
            ON CONFLICT (trip_id) DO UPDATE SET
              route_id = EXCLUDED.route_id,
              service_id = EXCLUDED.service_id,
              trip_headsign = EXCLUDED.trip_headsign,
              direction_id = EXCLUDED.direction_id,
              block_id = EXCLUDED.block_id,
              shape_id = EXCLUDED.shape_id,
              wheelchair_accessible = EXCLUDED.wheelchair_accessible,
              bikes_allowed = EXCLUDED.bikes_allowed
          `;

          await prisma.$executeRawUnsafe(smallerQuery, ...smallerValues);
          totalProcessed += smallerBatch.length;

          console.log(
            `Processed with smaller batch: ${totalProcessed}/${formattedTrips.length} trips`
          );
        } catch (subError) {
          console.error(
            `Error with smaller batch (${j}-${j + smallerBatchSize}):`,
            subError
          );

          // En dernier recours, on revient à upsert individuel
          console.log("Falling back to individual upserts");

          for (const trip of smallerBatch) {
            try {
              await prisma.trip.upsert({
                where: { id: trip.id },
                update: {
                  routeId: trip.routeId,
                  serviceId: trip.serviceId,
                  headsign: trip.headsign,
                  directionId: trip.directionId,
                  blockId: trip.blockId,
                  shapeId: trip.shapeId,
                  wheelchairAccessible: trip.wheelchairAccessible,
                  bikesAllowed: trip.bikesAllowed,
                },
                create: trip,
              });
              totalProcessed++;
            } catch (finalError) {
              console.error(`Error upserting trip ${trip.id}:`, finalError);
            }
          }
        }
      }
    }
  }

  console.log(
    `Total processed: ${totalProcessed}/${formattedTrips.length} trips`
  );

  // Vérification finale
  const finalCount = await prisma.trip.count();
  console.log(`Final trip count in database: ${finalCount}`);

  return { count: finalCount };
}

// Fonction optimisée pour importer les stop times avec upsertMany via SQL (taille de lot corrigée)
async function importStopTimesAlternative(
  extractionPath: string,
  chunkSize: number = 30000
): Promise<{ count: number }> {
  console.log("Importing stop times with optimized upsertMany approach...");
  const stopTimesPath = path.join(extractionPath, "stop_times.txt");

  // Récupérer validTripIds et validStopIds pour éviter les erreurs de contrainte
  console.log("Getting valid IDs for validation...");
  const [validTrips, validStops] = await Promise.all([
    prisma.trip.findMany({ select: { id: true } }),
    prisma.stop.findMany({ select: { id: true } }),
  ]);

  const validTripIds = new Set(validTrips.map((t) => t.id));
  const validStopIds = new Set(validStops.map((s) => s.id));

  console.log(
    `Found ${validTripIds.size} valid trip IDs and ${validStopIds.size} valid stop IDs`
  );

  // Count lines in file
  let totalLines = 0;

  try {
    // First pass - count lines
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(stopTimesPath)
        .pipe(csv())
        .on("data", () => totalLines++)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(`Total lines in stop_times.txt: ${totalLines}`);

    // Avant de continuer, compter les stop times existants pour traçabilité
    const existingCount = await prisma.stopTime.count();
    console.log(`Current count of stop times in database: ${existingCount}`);

    // Tracking variables
    let processedLines = 0;
    let validLinesCount = 0;
    let processedCount = 0;
    let skippedCount = 0;
    const startTime = Date.now();
    let lastReportTime = startTime;

    // Prepare batches for tracking
    const batchCount = Math.ceil(totalLines / chunkSize);
    console.log(`Will process data in ${batchCount} batches of ${chunkSize}`);

    // Second pass - process in batches
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const batchData: any[] = [];
      const batchStartLine = batchIndex * chunkSize;
      const batchEndLine = Math.min(batchStartLine + chunkSize, totalLines);
      let currentLine = 0;

      console.log(
        `Processing batch ${
          batchIndex + 1
        }/${batchCount} (lines ${batchStartLine}-${batchEndLine})...`
      );

      // Read just the lines for this batch
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(stopTimesPath)
          .pipe(csv())
          .on("data", (row) => {
            if (currentLine >= batchStartLine && currentLine < batchEndLine) {
              const tripId = String(row.trip_id || "");
              const stopId = String(row.stop_id || "");

              // Only include rows with valid foreign keys
              if (validTripIds.has(tripId) && validStopIds.has(stopId)) {
                batchData.push({
                  tripId: tripId,
                  arrivalTime: String(row.arrival_time || ""),
                  departureTime: String(row.departure_time || ""),
                  stopId: stopId,
                  stopSequence: parseInt(row.stop_sequence || "0"),
                  pickupType:
                    row.pickup_type !== undefined
                      ? parseInt(row.pickup_type)
                      : null,
                  dropOffType:
                    row.drop_off_type !== undefined
                      ? parseInt(row.drop_off_type)
                      : null,
                });
                validLinesCount++;
              } else {
                skippedCount++;
              }
            }
            currentLine++;
          })
          .on("end", resolve)
          .on("error", reject);
      });

      processedLines += batchEndLine - batchStartLine;

      if (batchData.length === 0) {
        console.log(
          `Batch ${batchIndex + 1}: No valid stop times, skipping insertion`
        );
        continue;
      }

      // Traiter cette section de données avec SQL upsert (INSERT ... ON CONFLICT ... DO UPDATE)
      try {
        // Divisez en sous-lots beaucoup plus petits pour éviter l'erreur de trop de variables de liaison
        // 7 variables par stopTime, PostgreSQL a une limite de ~32767 paramètres
        // Donc taille maximale = 32767 / 7 ≈ 4680, arrondissons à 4500 pour être prudent
        const sqlBatchSize = 4500;

        for (let i = 0; i < batchData.length; i += sqlBatchSize) {
          const sqlBatch = batchData.slice(
            i,
            Math.min(i + sqlBatchSize, batchData.length)
          );

          // 7 colonnes par ligne: tripId, arrivalTime, departureTime, stopId, stopSequence, pickupType, dropOffType
          const valuesPlaceholders = sqlBatch
            .map(
              (_, index) =>
                `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${
                  index * 7 + 4
                }, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
            )
            .join(", ");

          // Aplatir les données en tableau de valeurs
          const values = sqlBatch.flatMap((item) => [
            item.tripId,
            item.arrivalTime,
            item.departureTime,
            item.stopId,
            item.stopSequence,
            item.pickupType,
            item.dropOffType,
          ]);

          // Construire et exécuter la requête SQL d'upsert
          const query = `
            INSERT INTO stop_times (
              trip_id, arrival_time, departure_time, stop_id, stop_sequence, pickup_type, drop_off_type
            )
            VALUES ${valuesPlaceholders}
            ON CONFLICT (trip_id, stop_id, stop_sequence) DO UPDATE SET
              arrival_time = EXCLUDED.arrival_time,
              departure_time = EXCLUDED.departure_time,
              pickup_type = EXCLUDED.pickup_type,
              drop_off_type = EXCLUDED.drop_off_type
          `;

          await prisma.$executeRawUnsafe(query, ...values);
          processedCount += sqlBatch.length;
        }

        console.log(
          `Batch ${batchIndex + 1}: Successfully processed ${
            batchData.length
          } stop times with SQL upsert`
        );
      } catch (error) {
        console.error(
          `Error in SQL upsert for batch ${batchIndex + 1}:`,
          error
        );

        // Fall back to smaller SQL batches
        console.log("Falling back to smaller SQL batches");

        // Utiliser des lots beaucoup plus petits
        const smallerSqlBatchSize = 500;

        for (let i = 0; i < batchData.length; i += smallerSqlBatchSize) {
          const smallerBatch = batchData.slice(
            i,
            Math.min(i + smallerSqlBatchSize, batchData.length)
          );

          try {
            // Même approche mais avec des lots plus petits
            const valuesPlaceholders = smallerBatch
              .map(
                (_, index) =>
                  `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${
                    index * 7 + 4
                  }, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
              )
              .join(", ");

            const values = smallerBatch.flatMap((item) => [
              item.tripId,
              item.arrivalTime,
              item.departureTime,
              item.stopId,
              item.stopSequence,
              item.pickupType,
              item.dropOffType,
            ]);

            const query = `
              INSERT INTO stop_times (
                trip_id, arrival_time, departure_time, stop_id, stop_sequence, pickup_type, drop_off_type
              )
              VALUES ${valuesPlaceholders}
              ON CONFLICT (trip_id, stop_id, stop_sequence) DO UPDATE SET
                arrival_time = EXCLUDED.arrival_time,
                departure_time = EXCLUDED.departure_time,
                pickup_type = EXCLUDED.pickup_type,
                drop_off_type = EXCLUDED.drop_off_type
            `;

            await prisma.$executeRawUnsafe(query, ...values);
            processedCount += smallerBatch.length;
          } catch (subError) {
            console.error(
              `Error in smaller SQL batch (${i}-${i + smallerSqlBatchSize}):`,
              subError
            );

            // Fall back to Prisma upsert for this small batch
            console.log("Falling back to Prisma upserts for this small batch");

            // Approche Prisma en dernier recours
            const prismaBatchSize = 100;

            for (let j = 0; j < smallerBatch.length; j += prismaBatchSize) {
              const prismaBatch = smallerBatch.slice(j, j + prismaBatchSize);

              try {
                await prisma.$transaction(
                  prismaBatch.map((item) =>
                    prisma.stopTime.upsert({
                      where: {
                        tripId_stopId_stopSequence: {
                          tripId: item.tripId,
                          stopId: item.stopId,
                          stopSequence: item.stopSequence,
                        },
                      },
                      update: {
                        arrivalTime: item.arrivalTime,
                        departureTime: item.departureTime,
                        pickupType: item.pickupType,
                        dropOffType: item.dropOffType,
                      },
                      create: item,
                    })
                  )
                );

                processedCount += prismaBatch.length;
              } catch (finalError) {
                console.error(
                  `Error in Prisma upsert sub-batch (${j}-${
                    j + prismaBatchSize
                  }):`,
                  finalError
                );
              }
            }
          }

          // Log progress periodically
          if (
            i % (smallerSqlBatchSize * 10) === 0 ||
            i + smallerSqlBatchSize >= batchData.length
          ) {
            console.log(
              `Batch ${
                batchIndex + 1
              }: Alternative processing progress ${Math.min(
                i + smallerSqlBatchSize,
                batchData.length
              )}/${batchData.length}`
            );
          }
        }
      }

      // Report progress periodically with actual DB count verification
      const now = Date.now();
      if (
        now - lastReportTime > 60000 ||
        batchIndex === batchCount - 1 ||
        batchIndex % 5 === 0
      ) {
        // Check every minute, last batch, or every 5 batches
        const actualCount = await prisma.stopTime.count();
        console.log(`VERIFIED COUNT: ${actualCount} stop times in database`);
        lastReportTime = now;
      } else {
        // Regular progress update
        const progressPct = Math.round((processedLines / totalLines) * 100);
        console.log(
          `Estimated progress: ${processedLines}/${totalLines} lines (${progressPct}%)`
        );
      }
    }

    // Final count verification
    const finalCount = await prisma.stopTime.count();
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`Import completed in ${totalTime} seconds`);
    console.log(`Final count: ${finalCount} stop times in database`);
    console.log(
      `Summary: Valid lines: ${validLinesCount}, Skipped: ${skippedCount}, Processed: ${processedCount}`
    );

    return { count: finalCount };
  } catch (error) {
    console.error("Error during stop times import:", error);

    // Try to return current count even if error occurred
    try {
      const currentCount = await prisma.stopTime.count();
      console.log(`Current count despite error: ${currentCount}`);
      return { count: currentCount };
    } catch {
      return { count: 0 };
    }
  }
}
async function extractServiceInfo(): Promise<{
  serviceTimesCount: number;
  stopSequencesCount: number;
}> {
  console.log("Extracting service times and stop sequences...");

  console.log("Extracting service times...");
  await prisma.routeServiceTime.deleteMany({});

  // Extract the hours of operation for each route by service
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

  // Insert service times
  let serviceTimesCount = 0;
  if (Array.isArray(serviceTimesRaw) && serviceTimesRaw.length > 0) {
    try {
      // Try bulk insert first
      const formattedServiceTimes = serviceTimesRaw.map((service) => ({
        routeId: service.route_id,
        serviceId: service.service_id,
        startTime: service.start_time,
        endTime: service.end_time,
      }));

      const result = await prisma.routeServiceTime.createMany({
        data: formattedServiceTimes,
        skipDuplicates: true,
      });

      serviceTimesCount = result.count;
    } catch (error) {
      console.log(
        "createMany failed for service times, using individual inserts"
      );

      // Fall back to individual inserts
      for (const service of serviceTimesRaw) {
        try {
          await prisma.routeServiceTime.create({
            data: {
              routeId: service.route_id,
              serviceId: service.service_id,
              startTime: service.start_time,
              endTime: service.end_time,
            },
          });
          serviceTimesCount++;
        } catch (error) {
          console.error(
            `Error inserting service time for route ${service.route_id}:`,
            error
          );
        }
      }
    }
  }

  // 2. Extract stop sequences for each route
  console.log("Extracting stop sequences...");
  await prisma.stopSequence.deleteMany({});

  // Extract the sequence of stops for each route and direction
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

  // Insert stop sequences
  let stopSequencesCount = 0;
  if (Array.isArray(stopSequencesRaw) && stopSequencesRaw.length > 0) {
    try {
      // Try bulk insert first
      const formattedStopSequences = stopSequencesRaw.map((sequence) => ({
        routeId: sequence.route_id,
        stopId: sequence.stop_id,
        directionId: sequence.direction_id || 0,
        position: Number(sequence.position),
        isTerminus: sequence.is_terminus || false,
      }));

      const result = await prisma.stopSequence.createMany({
        data: formattedStopSequences,
        skipDuplicates: true,
      });

      stopSequencesCount = result.count;
    } catch (error) {
      console.log(
        "createMany failed for stop sequences, using individual inserts"
      );

      // Fall back to individual inserts
      for (const sequence of stopSequencesRaw) {
        try {
          await prisma.stopSequence.create({
            data: {
              routeId: sequence.route_id,
              stopId: sequence.stop_id,
              directionId: sequence.direction_id || 0,
              position: Number(sequence.position),
              isTerminus: sequence.is_terminus || false,
            },
          });
          stopSequencesCount++;
        } catch (error) {
          console.error(
            `Error inserting stop sequence for route ${sequence.route_id}, stop ${sequence.stop_id}:`,
            error
          );
        }
      }
    }
  }

  console.log(`Extracted ${stopSequencesCount} stop sequences`);

  return {
    serviceTimesCount,
    stopSequencesCount,
  };
}

// Function to clean up old files
async function cleanupFiles(
  baseDir: string,
  currentDir: string,
  keepRecentHours: number = 48,
  keepLastN: number = 2
): Promise<{ cleanedCount: number }> {
  console.log(`Cleaning up old GTFS data directories...`);
  console.log(
    `Parameters: keepRecentHours=${keepRecentHours}, keepLastN=${keepLastN}`
  );

  // Get all subdirectories in the base directory
  const dirEntries = fs.readdirSync(baseDir, { withFileTypes: true });
  const directories = dirEntries
    .filter((dirent) => dirent.isDirectory() && dirent.name !== "node_modules")
    .map((dirent) => {
      const dirPath = path.join(baseDir, dirent.name);
      const stats = fs.statSync(dirPath);
      return {
        path: dirPath,
        name: dirent.name,
        createdAt: stats.birthtime,
        isLatest: dirPath === currentDir,
      };
    });

  console.log(`Found ${directories.length} directories in ${baseDir}`);

  // Sort directories by creation time (newest first)
  directories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Determine which directories to keep based on criteria
  const now = new Date();
  const recentThreshold = new Date(
    now.getTime() - keepRecentHours * 60 * 60 * 1000
  );

  const keptDirectories = [];
  const deletedDirectories = [];

  // Process each directory
  for (let i = 0; i < directories.length; i++) {
    const dir = directories[i];
    let shouldKeep = false;

    // Keep the current directory
    if (dir.isLatest) {
      shouldKeep = true;
      console.log(`Keeping ${dir.path} (current directory)`);
    }
    // Keep recent directories based on time threshold
    else if (dir.createdAt > recentThreshold) {
      shouldKeep = true;
      console.log(
        `Keeping ${dir.path} (recent - ${Math.round(
          (now.getTime() - dir.createdAt.getTime()) / 3600000
        )}h old)`
      );
    }
    // Keep N most recent directories regardless of age
    else if (i < keepLastN) {
      shouldKeep = true;
      console.log(`Keeping ${dir.path} (among ${keepLastN} most recent)`);
    }

    if (shouldKeep) {
      keptDirectories.push(dir);
    } else {
      // Delete directory if not kept
      try {
        console.log(`Deleting ${dir.path}`);
        fs.rmSync(dir.path, { recursive: true, force: true });
        deletedDirectories.push(dir);
      } catch (error) {
        console.error(`Error deleting directory ${dir.path}:`, error);
      }
    }
  }

  console.log(
    `Kept ${keptDirectories.length} directories, deleted ${deletedDirectories.length} directories`
  );
  return { cleanedCount: deletedDirectories.length };
}
