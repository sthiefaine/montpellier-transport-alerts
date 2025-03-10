// /app/api/gtfs/import-routes/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";

// Importer les modules communs
import { validateAuth } from "../common/auth";
import { getOrDownloadExtraction } from "../common/auto-download";

const prisma = new PrismaClient();

export const maxDuration = 300; // 5 minutes pour l'importation des routes

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
    
    // Vérifier que le fichier routes.txt existe
    const routesPath = path.join(extractionPath, "routes.txt");
    if (!fs.existsSync(routesPath)) {
      return NextResponse.json({
        error: "Fichier routes.txt introuvable",
        path: routesPath
      }, { status: 500 });
    }
    
    // Importer les routes
    const result = await importRoutes(extractionPath);

    return NextResponse.json({
      status: "success",
      message: "Importation des routes terminée",
      details: result
    });
    
  } catch (error) {
    console.error("Erreur lors de l'importation des routes:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'importation des routes", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function importRoutes(extractionPath: string) {
  console.log("Importation des lignes (routes)...");
  const routesPath = path.join(extractionPath, "routes.txt");
  const results: any[] = [];

  return new Promise<{status: string, message: string, count: number}>((resolve, reject) => {
    fs.createReadStream(routesPath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          console.log(`Total de ${results.length} routes à importer`);
          
          // Supprimer toutes les routes existantes
          console.log("Suppression des routes existantes...");
          await prisma.route.deleteMany({});

          // Importer les routes par lots
          const batchSize = 100;
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
            message: `Importation des routes terminée`,
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