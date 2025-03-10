// /app/api/gtfs/cleanup/route.ts
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

// Fonction pour obtenir le répertoire de base des données GTFS
function getBaseDir() {
  // Option 1: Utiliser un répertoire spécifique si défini comme variable d'environnement
  if (process.env.GTFS_DATA_DIR) {
    return process.env.GTFS_DATA_DIR;
  }
  
  // Option 2: Utiliser un sous-répertoire dans le répertoire temporaire
  return path.join(os.tmpdir(), "gtfs-data");
}

export const maxDuration = 60; // 1 minute pour le nettoyage

export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json({ 
        error: "Non autorisé",
        info: "Veuillez fournir un token valide"
      }, { status: 401 });
    }

    // Obtenir les paramètres de la requête
    const url = new URL(request.url);
    
    // Option pour conserver les répertoires récents (par défaut: 1 jour)
    const keepRecentHours = parseInt(url.searchParams.get('keepRecentHours') || '24');
    
    // Option pour ne conserver que N répertoires les plus récents
    const keepLastN = parseInt(url.searchParams.get('keepLastN') || '1');
    
    // Option pour décider si on nettoie le répertoire actuel
    const cleanCurrent = url.searchParams.get('cleanCurrent') === 'true';
    
    // Option pour activer le mode simulation (ne supprime rien)
    const dryRun = url.searchParams.get('dryRun') === 'true';

    // Répertoire de base GTFS
    const baseDir = getBaseDir();
    
    if (!fs.existsSync(baseDir)) {
      return NextResponse.json({
        status: "success",
        message: "Aucun répertoire de données GTFS à nettoyer"
      });
    }
    
    // Récupérer le répertoire actuel si disponible
    let currentDir = "";
    const latestFilePath = path.join(baseDir, "latest.txt");
    
    if (fs.existsSync(latestFilePath)) {
      try {
        currentDir = fs.readFileSync(latestFilePath, 'utf8').trim();
      } catch (error) {
        console.error("Erreur lors de la lecture du fichier latest.txt:", error);
      }
    }
    
    // Récupérer tous les sous-répertoires
    const dirEntries = fs.readdirSync(baseDir, { withFileTypes: true });
    const directories = dirEntries
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const dirPath = path.join(baseDir, dirent.name);
        const stats = fs.statSync(dirPath);
        return {
          path: dirPath,
          name: dirent.name,
          createdAt: stats.birthtime,
          isLatest: dirPath === currentDir
        };
      });
    
    // Trier les répertoires par date de création (du plus récent au plus ancien)
    directories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Déterminer quels répertoires seront conservés/supprimés
    const now = new Date();
    const recentThreshold = new Date(now.getTime() - (keepRecentHours * 60 * 60 * 1000));
    
    // Garder track des répertoires traités
    const keptDirectories = [];
    const keptDueToRecent = [];
    const keptDueToLimit = [];
    const keptDueToCurrent = [];
    const deletedDirectories = [];
    
    // Déterminer pour chaque répertoire s'il doit être conservé ou supprimé
    for (let i = 0; i < directories.length; i++) {
      const dir = directories[i];
      let shouldKeep = false;
      let keepReason = "";
      
      // 1. Conserver si c'est le répertoire actuel et qu'on ne force pas sa suppression
      if (dir.isLatest && !cleanCurrent) {
        shouldKeep = true;
        keepReason = "current";
        keptDueToCurrent.push(dir);
      }
      
      // 2. Conserver si le répertoire est récent
      if (!shouldKeep && dir.createdAt > recentThreshold) {
        shouldKeep = true;
        keepReason = "recent";
        keptDueToRecent.push(dir);
      }
      
      // 3. Conserver si le répertoire fait partie des N plus récents
      if (!shouldKeep && i < keepLastN) {
        shouldKeep = true;
        keepReason = "limit";
        keptDueToLimit.push(dir);
      }
      
      if (shouldKeep) {
        keptDirectories.push({
          ...dir,
          keepReason
        });
      } else {
        // Supprimer le répertoire s'il ne correspond à aucun critère de conservation
        if (!dryRun) {
          try {
            fs.rmSync(dir.path, { recursive: true, force: true });
          } catch (error) {
            console.error(`Erreur lors du nettoyage du répertoire ${dir.path}:`, error);
          }
        }
        deletedDirectories.push(dir);
      }
    }
    
    // Si le répertoire actuel a été supprimé, mettre à jour le fichier latest.txt
    if (!dryRun && cleanCurrent && currentDir) {
      try {
        // S'il reste des répertoires, définir le plus récent comme actuel
        if (keptDirectories.length > 0) {
          fs.writeFileSync(latestFilePath, keptDirectories[0].path);
        } else {
          // Sinon, supprimer le fichier latest.txt
          fs.unlinkSync(latestFilePath);
        }
      } catch (error) {
        console.error("Erreur lors de la mise à jour du fichier latest.txt:", error);
      }
    }
    
    return NextResponse.json({
      status: "success",
      message: dryRun ? "Simulation de nettoyage terminée" : "Nettoyage terminé",
      dryRun,
      params: {
        keepRecentHours,
        keepLastN,
        cleanCurrent
      },
      stats: {
        totalDirectories: directories.length,
        keptDirectories: keptDirectories.length,
        deletedDirectories: deletedDirectories.length
      },
      keptDirectories: keptDirectories.map(dir => ({
        path: dir.path,
        name: dir.name,
        createdAt: dir.createdAt,
        isLatest: dir.isLatest,
        keepReason: dir.keepReason
      })),
      deletedDirectories: deletedDirectories.map(dir => ({
        path: dir.path,
        name: dir.name,
        createdAt: dir.createdAt
      })),
      currentDirectory: currentDir || null
    });
    
  } catch (error) {
    console.error("Erreur lors du nettoyage des répertoires GTFS:", error);
    return NextResponse.json(
      { error: "Erreur lors du nettoyage", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Permettre aussi les requêtes POST pour les déclenchements manuels
export async function POST(request: Request) {
  return GET(request);
}