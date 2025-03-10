// /app/api/gtfs/import-stops/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";

// Importer les modules communs
import { validateAuth } from "../common/auth";
import { getOrDownloadExtraction } from "../common/auto-download";

const prisma = new PrismaClient();

export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json({ 
        error: "Non autorisé",
        info: "Veuillez fournir un token valide"
      }, { status: 401 });
    }

    // Obtenir et vérifier le répertoire d'extraction (avec téléchargement automatique si nécessaire)
    let extractionPath;
    try {
      extractionPath = await getOrDownloadExtraction();
      
      if (!extractionPath) {
        return NextResponse.json({
          error: "Impossible d'obtenir un répertoire d'extraction valide",
          message: "Réessayez ou vérifiez les permissions du système de fichiers"
        }, { status: 500 });
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du répertoire d'extraction:", error);
      return NextResponse.json({
        error: "Erreur lors de la récupération du répertoire d'extraction",
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
    
    // Vérifier que le fichier stops.txt existe
    const stopsPath = path.join(extractionPath, "stops.txt");
    if (!fs.existsSync(stopsPath)) {
      return NextResponse.json({
        error: "Fichier stops.txt introuvable",
        path: stopsPath
      }, { status: 500 });
    }
    
    // Importer les arrêts
    const result = await importStops(extractionPath);

    return NextResponse.json({
      status: "success",
      message: "Importation des arrêts terminée",
      details: result
    });
    
  } catch (error) {
    console.error("Erreur lors de l'importation des arrêts:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'importation des arrêts", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function importStops(extractionPath: string) {
  console.log("Importation des arrêts...");
  const stopsPath = path.join(extractionPath, "stops.txt");
  const results: any[] = [];

  return new Promise<{status: string, message: string, count: number}>((resolve, reject) => {
    fs.createReadStream(stopsPath)
      .pipe(csv())
      .on("data", (data: any) => results.push(data))
      .on("end", async () => {
        try {
          console.log(`Total de ${results.length} arrêts à importer`);
          
          // Supprimer tous les arrêts existants
          console.log("Suppression des arrêts existants...");
          await prisma.stop.deleteMany({});

          // Importer les arrêts par lots
          const batchSize = 1000;
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
            message: `Importation des arrêts terminée`,
            count: results.length
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