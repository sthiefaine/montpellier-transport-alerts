// /app/api/gtfs/download/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";

// Importer les modules communs
import { validateAuth } from "../common/auth";
import { getBaseDir } from "../common/auto-download";

export const maxDuration = 300; // 5 minutes pour le téléchargement et l'extraction

export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json({ 
        error: "Non autorisé",
        info: "Veuillez fournir un token valide"
      }, { status: 401 });
    }

    const url = new URL(request.url);
    const gtfsUrl = url.searchParams.get('url') || "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip";

    // Créer un répertoire permanent pour les données GTFS
    const baseDir = getBaseDir();
    const timestampDir = path.join(baseDir, Date.now().toString());
    
    console.log(`Utilisation du répertoire de base: ${baseDir}`);
    console.log(`Création du répertoire d'extraction: ${timestampDir}`);
    
    // S'assurer que le répertoire de base existe
    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
        console.log(`Répertoire de base créé: ${baseDir}`);
      } catch (error) {
        console.error(`Erreur lors de la création du répertoire de base: ${error}`);
        return NextResponse.json({
          error: "Erreur lors de la création du répertoire GTFS",
          details: `Impossible de créer le répertoire: ${baseDir}`
        }, { status: 500 });
      }
    }
    
    // Créer le répertoire d'extraction avec horodatage
    try {
      fs.mkdirSync(timestampDir, { recursive: true });
      console.log(`Répertoire d'extraction créé: ${timestampDir}`);
    } catch (error) {
      console.error(`Erreur lors de la création du répertoire d'extraction: ${error}`);
      return NextResponse.json({
        error: "Erreur lors de la création du répertoire d'extraction GTFS",
        details: `Impossible de créer le répertoire: ${timestampDir}`
      }, { status: 500 });
    }

    // Télécharger le fichier GTFS
    console.log(`Téléchargement des données GTFS depuis: ${gtfsUrl}`);
    let response;
    try {
      response = await axios({
        method: "get",
        url: gtfsUrl,
        responseType: "arraybuffer",
      });
      console.log("Téléchargement réussi");
    } catch (error) {
      console.error("Erreur lors du téléchargement GTFS:", error);
      return NextResponse.json({
        error: "Erreur lors du téléchargement des données GTFS",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }

    // Écrire le fichier téléchargé
    const zipPath = path.join(timestampDir, "gtfs.zip");
    try {
      fs.writeFileSync(zipPath, response.data);
      console.log(`Fichier ZIP enregistré: ${zipPath}`);
    } catch (error) {
      console.error(`Erreur lors de l'écriture du fichier ZIP: ${error}`);
      return NextResponse.json({
        error: "Erreur lors de l'écriture du fichier ZIP",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }

    // Extraire le contenu
    console.log("Extraction du fichier zip...");
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(timestampDir, true);
      console.log("Extraction terminée avec succès");
    } catch (error) {
      console.error(`Erreur lors de l'extraction du fichier ZIP: ${error}`);
      return NextResponse.json({
        error: "Erreur lors de l'extraction du fichier ZIP",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }

    // Vérifier que les fichiers essentiels existent
    const requiredFiles = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"];
    const missingFiles = [];
    
    for (const file of requiredFiles) {
      const filePath = path.join(timestampDir, file);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      console.error(`Fichiers essentiels manquants après extraction: ${missingFiles.join(", ")}`);
      return NextResponse.json({
        error: "Fichiers GTFS essentiels manquants après extraction",
        missingFiles
      }, { status: 500 });
    }

    // Écrire un fichier de référence pour indiquer le dossier le plus récent
    const latestFilePath = path.join(baseDir, "latest.txt");
    try {
      fs.writeFileSync(latestFilePath, timestampDir);
      console.log(`Fichier de référence mis à jour: ${latestFilePath}`);
    } catch (error) {
      console.error(`Erreur lors de l'écriture du fichier de référence: ${error}`);
      return NextResponse.json({
        error: "Erreur lors de l'écriture du fichier de référence",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
    
    return NextResponse.json({
      status: "success",
      message: "Téléchargement et extraction GTFS terminés",
      directory: timestampDir,
      files: fs.readdirSync(timestampDir)
    });
    
  } catch (error) {
    console.error("Erreur générale lors du téléchargement GTFS:", error);
    return NextResponse.json(
      { error: "Erreur lors du téléchargement GTFS", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Permettre aussi les requêtes POST pour les déclenchements manuels
export async function POST(request: Request) {
  return GET(request);
}