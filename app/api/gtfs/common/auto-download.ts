// /app/api/gtfs/common/auto-download.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import axios from "axios";
import AdmZip from "adm-zip";

/**
 * Module qui fournit des fonctions pour la gestion automatique du téléchargement GTFS
 * et de la récupération du chemin d'extraction.
 */

// Fonction pour obtenir le répertoire de base des données GTFS
export function getBaseDir() {
  // Option 1: Utiliser un répertoire spécifique si défini comme variable d'environnement
  if (process.env.GTFS_DATA_DIR) {
    return process.env.GTFS_DATA_DIR;
  }
  
  // Option 2: Utiliser un sous-répertoire dans le répertoire temporaire
  return path.join(os.tmpdir(), "gtfs-data");
}

// Fonction pour récupérer le chemin du dossier d'extraction
export function getExtractionPath() {
  const baseDir = getBaseDir();
  const latestFilePath = path.join(baseDir, "latest.txt");
  
  if (!fs.existsSync(latestFilePath)) {
    return null;
  }
  
  try {
    const extractionPath = fs.readFileSync(latestFilePath, 'utf8').trim();
    
    if (!fs.existsSync(extractionPath)) {
      return null;
    }
    
    return extractionPath;
  } catch (error) {
    console.error("Erreur lors de la lecture du fichier latest.txt:", error);
    return null;
  }
}

// Fonction pour vérifier si les fichiers GTFS essentiels existent
export function checkGtfsFiles(extractionPath: string) {
  if (!extractionPath || !fs.existsSync(extractionPath)) {
    return false;
  }
  
  const requiredFiles = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(extractionPath, file))) {
      return false;
    }
  }
  
  return true;
}

// Fonction pour télécharger et extraire le fichier GTFS
export async function downloadGtfs(url = "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip") {
  console.log("Téléchargement automatique des données GTFS...");
  
  // Créer un répertoire permanent pour les données GTFS
  const baseDir = getBaseDir();
  const timestampDir = path.join(baseDir, Date.now().toString());
  
  // S'assurer que les répertoires existent
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  
  fs.mkdirSync(timestampDir, { recursive: true });
  
  // Télécharger le fichier GTFS
  const response = await axios({
    method: "get",
    url: url,
    responseType: "arraybuffer",
  });
  
  // Écrire le fichier téléchargé
  const zipPath = path.join(timestampDir, "gtfs.zip");
  fs.writeFileSync(zipPath, response.data);
  
  // Extraire le contenu
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(timestampDir, true);
  
  // Écrire un fichier de référence pour indiquer le dossier le plus récent
  fs.writeFileSync(path.join(baseDir, "latest.txt"), timestampDir);
  
  console.log(`Téléchargement et extraction GTFS automatiques terminés: ${timestampDir}`);
  
  return {
    directory: timestampDir,
    files: fs.readdirSync(timestampDir),
    timestamp: Date.now()
  };
}

// Fonction pour récupérer ou télécharger automatiquement le GTFS si nécessaire
export async function getOrDownloadExtraction() {
  // 1. Essayer de récupérer le chemin d'extraction existant
  let extractionPath = getExtractionPath();
  
  // 2. Vérifier si les fichiers GTFS sont valides
  const filesAreValid = extractionPath ? checkGtfsFiles(extractionPath) : false;
  
  // 3. Si le chemin n'existe pas ou les fichiers ne sont pas valides, télécharger automatiquement
  if (!extractionPath || !filesAreValid) {
    console.log("Aucun répertoire d'extraction valide trouvé, téléchargement automatique...");
    const downloadResult = await downloadGtfs();
    extractionPath = downloadResult.directory;
  }
  
  return extractionPath;
}