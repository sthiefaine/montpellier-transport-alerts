// /app/api/gtfs/import-orchestrator/route.ts
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

function validateAuth(request: Request) {
  // Vérifier d'abord l'en-tête d'autorisation
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token === IMPORT_TOKEN) {
      return true;
    }
  }
  
  // Si l'en-tête n'est pas valide, vérifier le token dans les paramètres d'URL
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  return tokenParam === IMPORT_TOKEN;
}

export const maxDuration = 300; // 5 minutes max duration

export async function GET(request: Request) {
  try {
    // Vérifier l'authentification avec notre fonction modifiée
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Get step from query params
    const url = new URL(request.url);
    const step = url.searchParams.get('step') || 'check-state';
    const chunk = parseInt(url.searchParams.get('chunk') || '0');
    const reset = url.searchParams.get('reset') === 'true';
    
    // State management directory
    const stateDir = path.join(os.tmpdir(), "gtfs-import-state");
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    
    // State file path
    const stateFilePath = path.join(stateDir, "import-state.json");
    
    // Initialize or load state
    let state = {
      currentStep: 'download',
      extractionPath: '',
      tripChunk: 0,
      tripTotal: 0,
      stopTimeChunk: 0,
      stopTimeTotal: 0,
      startTime: Date.now(),
      lastUpdated: Date.now(),
      completed: false,
      error: null
    };
    
    // Load existing state if not resetting
    if (fs.existsSync(stateFilePath) && !reset) {
      try {
        const stateData = fs.readFileSync(stateFilePath, 'utf8');
        state = JSON.parse(stateData);
      } catch (error) {
        console.error("Error loading state file:", error);
      }
    }
    
    // Override state with step from URL if provided
    if (step !== 'check-state') {
      state.currentStep = step;
    }
    
    if (step === 'check-state') {
      return NextResponse.json({
        status: "success",
        currentState: state,
        nextUrl: `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/gtfs/import-orchestrator?step=${state.currentStep}&chunk=${
          state.currentStep === 'import-trips' ? state.tripChunk : 
          state.currentStep === 'import-stop-times' ? state.stopTimeChunk : 0
        }&token=${IMPORT_TOKEN}`
      });
    }
    
    // Process the current step
    let result = null;
    let nextStep = null;
    let nextChunk = 0;
    
    switch (state.currentStep) {
      case 'download':
        result = await downloadGTFS();
        state.extractionPath = result.directory;
        nextStep = 'import-stops';
        break;
        
      case 'import-stops':
        result = await importStops(state.extractionPath);
        nextStep = 'import-routes';
        break;
        
      case 'import-routes':
        result = await importRoutes(state.extractionPath);
        nextStep = 'import-trips';
        state.tripChunk = 0;
        break;
        
      case 'import-trips':
        result = await importTripsChunk(state.extractionPath, chunk, 5000);
        state.tripTotal = result.total;
        
        if (result.hasMore) {
          nextStep = 'import-trips';
          nextChunk = chunk + 1;
          state.tripChunk = nextChunk;
        } else {
          nextStep = 'import-stop-times';
          state.stopTimeChunk = 0;
        }
        break;
        
      case 'import-stop-times':
        result = await importStopTimesChunk(state.extractionPath, chunk, 10000);
        state.stopTimeTotal = result.total;
        
        if (result.hasMore) {
          nextStep = 'import-stop-times';
          nextChunk = chunk + 1;
          state.stopTimeChunk = nextChunk;
        } else {
          nextStep = 'cleanup';
        }
        break;
        
      case 'cleanup':
        // Clean up the extraction directory
        if (state.extractionPath && fs.existsSync(state.extractionPath)) {
          try {
            fs.rmSync(state.extractionPath, { recursive: true, force: true });
          } catch (error) {
            console.error("Error cleaning up extraction directory:", error);
          }
        }
        
        nextStep = 'complete';
        break;
        
      case 'complete':
        const duration = Math.round((Date.now() - state.startTime) / 1000);
        result = {
          status: "success",
          message: "GTFS import fully completed",
          duration: `${duration} seconds`,
          startTime: new Date(state.startTime).toISOString(),
          endTime: new Date().toISOString()
        };
        
        state.completed = true;
        state.lastUpdated = Date.now();
        break;
        
      default:
        return NextResponse.json({
          error: "Invalid step parameter"
        }, { status: 400 });
    }
    
    // Update state
    state.currentStep = nextStep || state.currentStep;
    state.lastUpdated = Date.now();
    
    // Save state to file
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
    
    // Generate next URL if not completed
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const nextUrl = !state.completed ? 
      `${baseUrl}/api/gtfs/import-orchestrator?step=${state.currentStep}&chunk=${
        state.currentStep === 'import-trips' ? state.tripChunk : 
        state.currentStep === 'import-stop-times' ? state.stopTimeChunk : 0
      }&token=${IMPORT_TOKEN}` : null;
    
    return NextResponse.json({
      status: "success",
      step: step,
      result: result,
      nextStep: state.currentStep,
      nextUrl: nextUrl,
      state: state
    });
    
  } catch (error) {
    console.error("Error in orchestrator:", error);
    return NextResponse.json({
      error: "Erreur dans l'orchestrator d'importation",
      details: error instanceof Error ? error.message : "Erreur inconnue"
    }, { status: 500 });
  }
}

// Fonction pour télécharger et extraire les données GTFS
async function downloadGTFS() {
  // Create a persistent directory instead of temp
  const baseDir = path.join(os.tmpdir(), "gtfs-data");
  const timestampDir = path.join(baseDir, Date.now().toString());
  
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  if (!fs.existsSync(timestampDir)) {
    fs.mkdirSync(timestampDir, { recursive: true });
  }

  // Download the GTFS file
  console.log("Téléchargement des données GTFS statiques...");
  const response = await axios({
    method: "get",
    url: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip",
    responseType: "arraybuffer",
  });

  // Write the downloaded file
  const zipPath = path.join(timestampDir, "gtfs.zip");
  fs.writeFileSync(zipPath, response.data);

  // Extract the contents
  console.log("Extraction du fichier zip...");
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(timestampDir, true);

  // Write a status file to indicate which directory is the latest
  fs.writeFileSync(path.join(baseDir, "latest.txt"), timestampDir);
  
  return {
    status: "success",
    message: "GTFS download and extraction completed",
    directory: timestampDir
  };
}

// Fonction pour importer les arrêts
async function importStops(extractionPath: string) {
  console.log("Importation des arrêts...");
  const results: any[] = [];

  return new Promise<{status: string, message: string}>((resolve, reject) => {
    fs.createReadStream(path.join(extractionPath, "stops.txt"))
      .pipe(csv())
      .on("data", (data: any) => results.push(data))
      .on("end", async () => {
        try {
          await prisma.stop.deleteMany({});

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
              `Importé ${Math.min(i + batchSize, results.length)}/${results.length} arrêts`
            );
          }

          resolve({
            status: "success",
            message: `Importé ${results.length} arrêts`
          });
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

// Le reste des fonctions reste identique...
// Fonction pour importer les routes
async function importRoutes(extractionPath: string) {
  console.log("Importation des lignes (routes)...");
  const results: any[] = [];

  return new Promise<{status: string, message: string}>((resolve, reject) => {
    fs.createReadStream(path.join(extractionPath, "routes.txt"))
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          await prisma.route.deleteMany({});

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
              `Importé ${Math.min(i + batchSize, results.length)}/${results.length} routes`
            );
          }

          resolve({
            status: "success",
            message: `Importé ${results.length} routes`
          });
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

// Fonction pour importer les voyages par chunks
async function importTripsChunk(extractionPath: string, chunk: number, chunkSize: number) {
  console.log(`Importation des voyages (trips) - chunk ${chunk}, taille ${chunkSize}...`);
  const tripsPath = path.join(extractionPath, "trips.txt");
  
  // Only delete trips on the first chunk
  if (chunk === 0) {
    console.log("Suppression des voyages existants...");
    await prisma.trip.deleteMany({});
  }
  
  // Read all trips but only process the current chunk
  const results: any[] = [];
  
  return new Promise<{
    status: string, 
    message: string, 
    imported: number, 
    total: number, 
    startIndex: number, 
    endIndex: number, 
    hasMore: boolean
  }>((resolve, reject) => {
    fs.createReadStream(tripsPath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          const totalTrips = results.length;
          const startIndex = chunk * chunkSize;
          let endIndex = startIndex + chunkSize;
          
          if (endIndex > totalTrips) {
            endIndex = totalTrips;
          }
          
          const hasMore = endIndex < totalTrips;
          
          // Extract only the current chunk
          const chunkData = results.slice(startIndex, endIndex);
          
          // Process this chunk
          const batchSize = 100;
          for (let i = 0; i < chunkData.length; i += batchSize) {
            const batch = chunkData.slice(i, i + batchSize);

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
              `Chunk ${chunk}: Importé ${startIndex + i + Math.min(batchSize, batch.length)}/${totalTrips} voyages`
            );
          }

          resolve({
            status: "success",
            message: `Importé le chunk ${chunk} (${chunkData.length} voyages)`,
            imported: chunkData.length,
            total: totalTrips,
            startIndex,
            endIndex,
            hasMore
          });
        } catch (error) {
          reject(error);
        }
      })
      .on("error", reject);
  });
}

// Fonction pour importer les horaires par chunks
async function importStopTimesChunk(extractionPath: string, chunk: number, chunkSize: number) {
  console.log(`Importation des horaires (stop_times) - chunk ${chunk}, taille ${chunkSize}...`);
  const stopTimesPath = path.join(extractionPath, "stop_times.txt");
  
  // Only delete stop times on the first chunk
  if (chunk === 0) {
    console.log("Suppression des horaires existants...");
    await prisma.stopTime.deleteMany({});
  }
  
  // Count total rows first to avoid loading all data into memory
  let totalRows = 0;
  
  // Count total rows
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(stopTimesPath)
      .pipe(csv())
      .on("data", () => totalRows++)
      .on("end", () => resolve())
      .on("error", reject);
  });
  
  console.log(`Total de ${totalRows} horaires à importer`);
  
  // Calculate start and end positions
  const startIndex = chunk * chunkSize;
  let endIndex = startIndex + chunkSize;
  
  if (endIndex > totalRows) {
    endIndex = totalRows;
  }
  
  const hasMore = endIndex < totalRows;
  
  // Process only the rows for this chunk
  let currentIndex = 0;
  const chunkData: any[] = [];
  
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(stopTimesPath)
      .pipe(csv())
      .on("data", (data) => {
        if (currentIndex >= startIndex && currentIndex < endIndex) {
          chunkData.push(data);
        }
        currentIndex++;
      })
      .on("end", () => resolve())
      .on("error", reject);
  });
  
  console.log(`Traitement du chunk ${chunk} (${startIndex}-${endIndex}): ${chunkData.length} horaires`);
  
  // Process this chunk
  const batchSize = 100;
  for (let i = 0; i < chunkData.length; i += batchSize) {
    const batch = chunkData.slice(i, i + batchSize);

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
      `Chunk ${chunk}: Importé ${startIndex + i + Math.min(batchSize, batch.length)}/${totalRows} horaires`
    );
  }
  
  return {
    status: "success",
    message: `Importé le chunk ${chunk} (${chunkData.length} horaires)`,
    imported: chunkData.length,
    total: totalRows,
    startIndex,
    endIndex,
    hasMore
  };
}

// Allow POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}