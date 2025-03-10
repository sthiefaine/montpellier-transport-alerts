// /app/api/gtfs/import-manager/route.ts
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
const CHUNK_SIZE = 5000; // Taille de chunk uniforme pour tous les types de données

// Une approche plus simple pour vérifier l'authentification
function validateAuth(request: Request) {
  // 1. Vérifier d'abord l'en-tête d'autorisation
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.substring(7) === IMPORT_TOKEN) {
    return true;
  }
  
  // 2. Vérifier le paramètre token dans l'URL si l'en-tête n'est pas valide
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token === IMPORT_TOKEN) {
    return true;
  }
  
  // Par défaut, rejeter l'authentification
  return false;
}

export const maxDuration = 300; // 5 minutes max duration

export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      // Log pour le débogage
      console.log("Authentification échouée");
      
      return NextResponse.json({ 
        error: "Non autorisé",
        info: "Veuillez fournir un token valide via l'en-tête Authorization ou le paramètre token"
      }, { status: 401 });
    }
    
    // Log pour le débogage
    console.log("Authentification réussie");

    // Obtenir les paramètres de la requête
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'status';
    
    // Gestion de l'action demandée
    switch (action) {
      case 'status':
        return getImportStatus();
        
      case 'start':
        return startImport();
        
      case 'process-next':
        return processNextImportStep();
        
      default:
        return NextResponse.json({
          error: "Action non valide",
          validActions: ["status", "start", "process-next"]
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Erreur dans le gestionnaire d'importation:", error);
    return NextResponse.json({
      error: "Erreur dans le gestionnaire d'importation",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// === FONCTIONS DE GESTION D'ÉTAT ===

// Chemin du fichier d'état
function getStateFilePath() {
  const stateDir = path.join(os.tmpdir(), "gtfs-import-state");
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
  return path.join(stateDir, "import-state.json");
}

// État par défaut
function getDefaultState() {
  return {
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
}

// Charger l'état
function loadState() {
  const stateFilePath = getStateFilePath();
  
  if (fs.existsSync(stateFilePath)) {
    try {
      const stateData = fs.readFileSync(stateFilePath, 'utf8');
      return JSON.parse(stateData);
    } catch (error) {
      console.error("Erreur lors du chargement de l'état:", error);
    }
  }
  
  return getDefaultState();
}

// Sauvegarder l'état
function saveState(state: { currentStep?: string; extractionPath?: string; tripChunk?: number; tripTotal?: number; stopTimeChunk?: number; stopTimeTotal?: number; startTime?: number; lastUpdated: any; completed?: boolean; error?: null; }) {
  const stateFilePath = getStateFilePath();
  state.lastUpdated = Date.now();
  fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
  return state;
}

// === FONCTIONS D'IMPORTATION PRINCIPALES ===

// Obtenir le statut de l'importation
async function getImportStatus() {
  const state = loadState();
  
  // Vérifier si l'importation est figée (plus de 2 heures sans mise à jour)
  const isStale = Date.now() - state.lastUpdated > 2 * 60 * 60 * 1000;
  
  // Calculer la progression
  let progressPercentage = 0;
  
  // Estimation de la progression par étape
  const stepProgress = {
    'download': 5,
    'import-stops': 10,
    'import-routes': 15,
    'import-trips': 60,
    'import-stop-times': 90,
    'cleanup': 95,
    'complete': 100
  };
  // Progression de base selon l'étape
  progressPercentage = stepProgress[state.currentStep as keyof typeof stepProgress] || 0;
  
  // Ajuster la progression pour les étapes avec des chunks
  if (state.currentStep === 'import-trips' && state.tripTotal > 0) {
    const baseProgress = stepProgress['import-routes']; // 15%
    const maxProgress = stepProgress['import-trips']; // 60%
    const chunkProgress = (state.tripChunk * CHUNK_SIZE / state.tripTotal) * (maxProgress - baseProgress);
    progressPercentage = baseProgress + chunkProgress;
  } else if (state.currentStep === 'import-stop-times' && state.stopTimeTotal > 0) {
    const baseProgress = stepProgress['import-trips']; // 60%
    const maxProgress = stepProgress['import-stop-times']; // 90%
    const chunkProgress = (state.stopTimeChunk * CHUNK_SIZE / state.stopTimeTotal) * (maxProgress - baseProgress);
    progressPercentage = baseProgress + chunkProgress;
  }
  
  return NextResponse.json({
    status: "success",
    importStatus: state.completed ? "completed" : isStale ? "stalled" : "in-progress",
    currentStep: state.currentStep,
    progress: Math.min(100, Math.round(progressPercentage)),
    startedAt: new Date(state.startTime).toISOString(),
    lastUpdatedAt: new Date(state.lastUpdated).toISOString(),
    isStale: isStale,
    state: state
  });
}

// Démarrer une nouvelle importation
async function startImport() {
  // Réinitialiser l'état
  const newState = getDefaultState();
  saveState(newState);
  
  // Commencer le téléchargement
  try {
    const result = await downloadGTFS();
    newState.extractionPath = result.directory;
    newState.currentStep = 'import-stops';
    saveState(newState);
    
    return NextResponse.json({
      status: "success",
      message: "Importation démarrée, données GTFS téléchargées",
      nextStep: newState.currentStep,
      state: newState
    });
  } catch (error: any) {
    newState.error = error.message;
    saveState(newState);
    
    return NextResponse.json({
      status: "error",
      message: "Erreur lors du démarrage de l'importation",
      error: newState.error
    }, { status: 500 });
  }
}

// Traiter la prochaine étape d'importation
async function processNextImportStep() {
  const state = loadState();
  
  // Vérifier si l'importation est terminée
  if (state.completed) {
    return NextResponse.json({
      status: "success",
      message: "L'importation est déjà terminée",
      state: state
    });
  }
  
  // Traiter l'étape actuelle
  try {
    let result;
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
        result = await importTripsChunk(state.extractionPath, state.tripChunk, CHUNK_SIZE);
        state.tripTotal = result.total;
        
        if (result.hasMore) {
          nextStep = 'import-trips';
          nextChunk = state.tripChunk + 1;
          state.tripChunk = nextChunk;
        } else {
          nextStep = 'import-stop-times';
          state.stopTimeChunk = 0;
        }
        break;
        
      case 'import-stop-times':
        result = await importStopTimesChunk(state.extractionPath, state.stopTimeChunk, CHUNK_SIZE);
        state.stopTimeTotal = result.total;
        
        if (result.hasMore) {
          nextStep = 'import-stop-times';
          nextChunk = state.stopTimeChunk + 1;
          state.stopTimeChunk = nextChunk;
        } else {
          nextStep = 'cleanup';
        }
        break;
        
      case 'cleanup':
        // Nettoyer le répertoire d'extraction
        if (state.extractionPath && fs.existsSync(state.extractionPath)) {
          try {
            fs.rmSync(state.extractionPath, { recursive: true, force: true });
          } catch (error) {
            console.error("Erreur lors du nettoyage du répertoire d'extraction:", error);
          }
        }
        
        nextStep = 'complete';
        break;
        
      case 'complete':
        const duration = Math.round((Date.now() - state.startTime) / 1000);
        result = {
          status: "success",
          message: "Importation GTFS terminée",
          duration: `${duration} secondes`,
          startTime: new Date(state.startTime).toISOString(),
          endTime: new Date().toISOString()
        };
        
        state.completed = true;
        break;
        
      default:
        return NextResponse.json({
          error: "Étape non valide"
        }, { status: 400 });
    }
    
    // Mettre à jour l'état
    if (nextStep) {
      state.currentStep = nextStep;
    }
    
    saveState(state);
    
    return NextResponse.json({
      status: "success",
      message: `Étape '${state.currentStep === 'complete' ? 'complete' : result?.message || state.currentStep}' traitée avec succès`,
      currentStep: state.currentStep,
      result: result,
      state: state
    });
    
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    saveState(state);
    
    return NextResponse.json({
      status: "error",
      message: `Erreur lors du traitement de l'étape '${state.currentStep}'`,
      error: state.error,
      state: state
    }, { status: 500 });
  }
}

// === FONCTIONS D'IMPORTATION POUR CHAQUE ÉTAPE ===

// Télécharger et extraire les données GTFS
async function downloadGTFS() {
  // Créer un répertoire persistent
  const baseDir = path.join(os.tmpdir(), "gtfs-data");
  const timestampDir = path.join(baseDir, Date.now().toString());
  
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  if (!fs.existsSync(timestampDir)) {
    fs.mkdirSync(timestampDir, { recursive: true });
  }

  // Télécharger le fichier GTFS
  console.log("Téléchargement des données GTFS statiques...");
  const response = await axios({
    method: "get",
    url: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip",
    responseType: "arraybuffer",
  });

  // Écrire le fichier téléchargé
  const zipPath = path.join(timestampDir, "gtfs.zip");
  fs.writeFileSync(zipPath, response.data);

  // Extraire le contenu
  console.log("Extraction du fichier zip...");
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(timestampDir, true);

  // Écrire un fichier de statut pour indiquer quel répertoire est le plus récent
  fs.writeFileSync(path.join(baseDir, "latest.txt"), timestampDir);
  
  return {
    status: "success",
    message: "Téléchargement et extraction GTFS terminés",
    directory: timestampDir
  };
}

// Importer les arrêts
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

// Importer les routes
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

// Importer les voyages par chunks
async function importTripsChunk(extractionPath: string, chunk: number, chunkSize: number) {
  console.log(`Importation des voyages (trips) - chunk ${chunk}, taille ${chunkSize}...`);
  const tripsPath = path.join(extractionPath, "trips.txt");
  
  // Supprimer les voyages existants seulement pour le premier chunk
  if (chunk === 0) {
    console.log("Suppression des voyages existants...");
    await prisma.trip.deleteMany({});
  }
  
  // Lire tous les voyages mais ne traiter que le chunk actuel
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
          
          // Extraire uniquement le chunk actuel
          const chunkData = results.slice(startIndex, endIndex);
          
          // Traiter ce chunk
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

// Importer les horaires par chunks
async function importStopTimesChunk(extractionPath: string, chunk: number, chunkSize: number) {
  console.log(`Importation des horaires (stop_times) - chunk ${chunk}, taille ${chunkSize}...`);
  const stopTimesPath = path.join(extractionPath, "stop_times.txt");
  
  // Supprimer les horaires existants seulement pour le premier chunk
  if (chunk === 0) {
    console.log("Suppression des horaires existants...");
    await prisma.stopTime.deleteMany({});
  }
  
  // Compter d'abord le nombre total de lignes pour éviter de charger toutes les données en mémoire
  let totalRows = 0;
  
  // Compter le nombre total de lignes
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(stopTimesPath)
      .pipe(csv())
      .on("data", () => totalRows++)
      .on("end", () => resolve())
      .on("error", reject);
  });
  
  console.log(`Total de ${totalRows} horaires à importer`);
  
  // Calculer les positions de début et de fin
  const startIndex = chunk * chunkSize;
  let endIndex = startIndex + chunkSize;
  
  if (endIndex > totalRows) {
    endIndex = totalRows;
  }
  
  const hasMore = endIndex < totalRows;
  
  // Traiter uniquement les lignes pour ce chunk
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
  
  // Traiter ce chunk
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

// Permettre les requêtes POST pour les déclenchements manuels
export async function POST(request: Request) {
  return GET(request);
}