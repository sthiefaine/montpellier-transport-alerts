// /app/api/gtfs/check-extraction/route.ts
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const IMPORT_TOKEN = process.env.CRON_SECRET;

function validateAuth(request: Request) {
  // Vérifier l'en-tête d'autorisation
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.substring(7) === IMPORT_TOKEN) {
    return true;
  }
  
  // Vérifier le paramètre token dans l'URL
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token === IMPORT_TOKEN) {
    return true;
  }
  
  return false;
}

export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json({ 
        error: "Non autorisé",
        info: "Veuillez fournir un token valide"
      }, { status: 401 });
    }

    // Vérifier l'existence du répertoire de base GTFS
    const baseDir = path.join(os.tmpdir(), "gtfs-data");
    let baseDirExists = false;
    let latestFileExists = false;
    let latestFileContent = null;
    let extractionPathExists = false;
    let hasGtfsFiles = false;
    
    if (fs.existsSync(baseDir)) {
      baseDirExists = true;
      
      // Vérifier l'existence du fichier latest.txt
      const latestFilePath = path.join(baseDir, "latest.txt");
      if (fs.existsSync(latestFilePath)) {
        latestFileExists = true;
        
        // Lire le contenu du fichier latest.txt
        try {
          latestFileContent = fs.readFileSync(latestFilePath, 'utf8').trim();
          
          // Vérifier l'existence du répertoire d'extraction
          if (fs.existsSync(latestFileContent)) {
            extractionPathExists = true;
            
            // Vérifier l'existence des fichiers GTFS essentiels
            const hasStopsFile = fs.existsSync(path.join(latestFileContent, "stops.txt"));
            const hasRoutesFile = fs.existsSync(path.join(latestFileContent, "routes.txt"));
            const hasTripsFile = fs.existsSync(path.join(latestFileContent, "trips.txt"));
            const hasStopTimesFile = fs.existsSync(path.join(latestFileContent, "stop_times.txt"));
            
            hasGtfsFiles = hasStopsFile && hasRoutesFile && hasTripsFile && hasStopTimesFile;
          }
        } catch (error) {
          console.error("Erreur lors de la lecture du fichier latest.txt:", error);
        }
      }
    }
    
    // URL de la requête pour obtenir des paramètres additionnels
    const url = new URL(request.url);
    
    // Option pour créer les répertoires manquants
    const createMissing = url.searchParams.get('createMissing') === 'true';
    if (createMissing && !baseDirExists) {
      fs.mkdirSync(baseDir, { recursive: true });
      baseDirExists = true;
    }
    
    // Option pour définir manuellement un chemin d'extraction
    const manualPath = url.searchParams.get('setPath');
    if (manualPath && baseDirExists) {
      // On vérifie d'abord si le chemin existe
      if (fs.existsSync(manualPath)) {
        // Mettre à jour le fichier latest.txt
        fs.writeFileSync(path.join(baseDir, "latest.txt"), manualPath);
        latestFileExists = true;
        latestFileContent = manualPath;
        extractionPathExists = true;
      }
    }
    
    // Construire la réponse avec les détails du diagnostic
    const details = {
      tmpDir: os.tmpdir(),
      gtfsBaseDir: baseDir,
      baseDirExists,
      latestFileExists,
      latestFileContent,
      extractionPathExists,
      hasGtfsFiles,
    };
    
    // Déterminer le statut global
    let status = "error";
    let message = "Problèmes détectés avec le répertoire d'extraction GTFS";
    
    if (baseDirExists && latestFileExists && extractionPathExists && hasGtfsFiles) {
      status = "success";
      message = "Répertoire d'extraction GTFS valide et prêt à l'emploi";
    }
    
    return NextResponse.json({
      status,
      message,
      details,
      recommandations: !hasGtfsFiles ? [
        "Exécutez le téléchargement GTFS avec: /api/gtfs/download",
        "Ou définissez manuellement un chemin valide avec: /api/gtfs/check-extraction?setPath=/chemin/vers/extraction/gtfs"
      ] : []
    });
    
  } catch (error) {
    console.error("Erreur lors de la vérification du répertoire d'extraction:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Permettre aussi les requêtes POST pour les déclenchements manuels
export async function POST(request: Request) {
  return GET(request);
}