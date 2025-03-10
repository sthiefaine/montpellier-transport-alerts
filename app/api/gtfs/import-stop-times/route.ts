// /app/api/gtfs/import-stop-times/route.ts (version avec vérification des clés étrangères)
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import { Readable } from "stream";

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
      return NextResponse.json({ 
        error: "Non autorisé",
        info: "Veuillez fournir un token valide"
      }, { status: 401 });
    }

    // Vérifier si on doit utiliser le mode chunks
    const url = new URL(request.url);
    const chunkParam = url.searchParams.get('chunk');
    
    // Option pour vérifier ou ignorer les contraintes de clé étrangère
    const skipValidation = url.searchParams.get('skipValidation') === 'true';
    
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
    
    // Vérifier que le fichier stop_times.txt existe
    const stopTimesPath = path.join(extractionPath, "stop_times.txt");
    if (!fs.existsSync(stopTimesPath)) {
      return NextResponse.json({
        error: "Fichier stop_times.txt introuvable",
        path: stopTimesPath
      }, { status: 500 });
    }
    
    // Si un paramètre chunk est fourni, utiliser le mode chunks
    if (chunkParam !== null) {
      const chunk = parseInt(chunkParam);
      const result = await importStopTimesChunk(extractionPath, chunk, skipValidation);
      
      return NextResponse.json({
        status: "success",
        message: `Importation des horaires (chunk ${chunk}) terminée`,
        details: result,
        nextChunk: result.hasMore ? chunk + 1 : null
      });
    }
    
    // Sinon, importer tous les horaires d'un coup
    const result = await importAllStopTimes(extractionPath, skipValidation);

    return NextResponse.json({
      status: "success",
      message: "Importation complète des horaires terminée",
      details: result
    });
    
  } catch (error) {
    console.error("Erreur lors de l'importation des horaires:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'importation des horaires", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Récupérer les ID valides pour la vérification des clés étrangères
async function getValidIds() {
  console.log("Récupération des IDs valides pour la vérification des clés étrangères...");
  
  // Récupérer tous les IDs de voyage et d'arrêt pour la validation
  const [trips, stops] = await Promise.all([
    prisma.trip.findMany({ select: { id: true } }),
    prisma.stop.findMany({ select: { id: true } })
  ]);
  
  const validTripIds = new Set(trips.map(trip => trip.id));
  const validStopIds = new Set(stops.map(stop => stop.id));
  
  console.log(`${validTripIds.size} voyages valides et ${validStopIds.size} arrêts valides trouvés`);
  
  return { validTripIds, validStopIds };
}

// Fonction pour importer TOUS les horaires d'un coup (ATTENTION : risque de timeout)
async function importAllStopTimes(extractionPath: string, skipValidation: boolean = false) {
  console.log("Importation de tous les horaires (stop_times)...");
  console.log("ATTENTION: Cette opération peut prendre beaucoup de temps et risque de timeout");
  
  const stopTimesPath = path.join(extractionPath, "stop_times.txt");
  
  // Récupérer les IDs valides pour la vérification si nécessaire
  let validTripIds = new Set<string>();
  let validStopIds = new Set<string>();
  
  if (!skipValidation) {
    const validIds = await getValidIds();
    validTripIds = validIds.validTripIds;
    validStopIds = validIds.validStopIds;
  }
  
  // Supprimer tous les horaires existants
  console.log("Suppression des horaires existants...");
  await prisma.stopTime.deleteMany({});
  
  // Variable pour compter le nombre total d'enregistrements
  let count = 0;
  let skippedCount = 0;
  
  // Pour le traitement par lot
  const batchSize = 5000; // createMany permet de traiter des lots bien plus grands, mais on reste prudent
  let batch: any[] = [];
  
  return new Promise<{status: string, message: string, count: number, skippedCount: number}>((resolve, reject) => {
    // Créer un pipeline de lecture du fichier
    const readStream = fs.createReadStream(stopTimesPath);
    const csvParser = csv();
    
    // Variable pour stocker le stream
    let currentStream: Readable | null = null;
    
    // Connecter le flux
    const stream = readStream.pipe(csvParser);
    currentStream = stream;
    
    // Gérer les données
    stream.on("data", async (data) => {
      // Valider les clés étrangères si nécessaire
      if (!skipValidation) {
        const tripId = String(data.trip_id || "");
        const stopId = String(data.stop_id || "");
        
        if (!validTripIds.has(tripId) || !validStopIds.has(stopId)) {
          skippedCount++;
          
          if (skippedCount < 10) {
            console.log(`Horaire ignoré: voyage ${tripId} ou arrêt ${stopId} invalide`);
          } else if (skippedCount === 10) {
            console.log(`D'autres horaires invalides seront ignorés silencieusement...`);
          }
          
          return; // Ignorer cet enregistrement
        }
      }
      
      // Convertir les données en format compatible avec createMany
      const stopTime = {
        tripId: String(data.trip_id || ""),
        arrivalTime: String(data.arrival_time || ""),
        departureTime: String(data.departure_time || ""),
        stopId: String(data.stop_id || ""),
        stopSequence: parseInt(data.stop_sequence || "0"),
        pickupType:
          data.pickup_type !== undefined
            ? parseInt(data.pickup_type)
            : null,
        dropOffType:
          data.drop_off_type !== undefined
            ? parseInt(data.drop_off_type)
            : null,
      };
      
      batch.push(stopTime);
      count++;
      
      // Quand le lot est complet, traiter ce lot
      if (batch.length >= batchSize) {
        try {
          // Copier le lot actuel et réinitialiser pour le prochain
          const currentBatch = [...batch];
          batch = [];
          
          // Mettre en pause le stream pendant le traitement par lot
          if (currentStream && currentStream.pause) {
            currentStream.pause();
          }
          
          // Essayer d'abord avec createMany (plus rapide)
          try {
            await prisma.stopTime.createMany({
              data: currentBatch,
              skipDuplicates: true
            });
          } catch (error) {
            console.error("Erreur avec createMany, retour à la méthode des transactions:", error);
            
            // Si createMany échoue, utiliser la méthode des transactions
            const smallerBatchSize = 100;
            
            for (let i = 0; i < currentBatch.length; i += smallerBatchSize) {
              const smallerBatch = currentBatch.slice(i, i + smallerBatchSize);
              
              await prisma.$transaction(
                smallerBatch.map(stopTime => prisma.stopTime.create({ data: stopTime }))
              );
            }
          }
          
          // Reprendre le stream après le traitement
          if (currentStream && currentStream.resume) {
            currentStream.resume();
          }
          
          // Log de progression
          if (count % 50000 === 0) {
            console.log(`Importé ${count} horaires (${skippedCount} ignorés)`);
          }
        } catch (error) {
          reject(error);
        }
      }
    });
    
    // Gérer la fin du flux
    stream.on("end", async () => {
      try {
        // Traiter le dernier lot s'il reste des éléments
        if (batch.length > 0) {
          try {
            await prisma.stopTime.createMany({
              data: batch,
              skipDuplicates: true
            });
          } catch (error) {
            console.error("Erreur avec createMany pour le dernier lot, utilisation des transactions:", error);
            
            // Si createMany échoue, utiliser la méthode des transactions
            const smallerBatchSize = 100;
            
            for (let i = 0; i < batch.length; i += smallerBatchSize) {
              const smallerBatch = batch.slice(i, i + smallerBatchSize);
              
              await prisma.$transaction(
                smallerBatch.map(stopTime => prisma.stopTime.create({ data: stopTime }))
              );
            }
          }
        }
        
        console.log(`Importation terminée: ${count} horaires importés, ${skippedCount} ignorés`);
        
        resolve({
          status: "success",
          message: `Importation des horaires terminée`,
          count: count,
          skippedCount: skippedCount
        });
      } catch (error) {
        reject(error);
      }
    });
    
    // Gérer les erreurs
    stream.on("error", reject);
  });
}

// Fonction pour importer les horaires par chunk
async function importStopTimesChunk(extractionPath: string, chunk: number, skipValidation: boolean = false) {
  console.log(`Importation des horaires (stop_times) - chunk ${chunk}...`);
  const stopTimesPath = path.join(extractionPath, "stop_times.txt");
  
  // Récupérer les IDs valides pour la vérification si nécessaire
  let validTripIds = new Set<string>();
  let validStopIds = new Set<string>();
  
  if (!skipValidation) {
    const validIds = await getValidIds();
    validTripIds = validIds.validTripIds;
    validStopIds = validIds.validStopIds;
  }
  
  // Supprimer tous les horaires existants si c'est le premier chunk
  if (chunk === 0) {
    console.log("Suppression des horaires existants...");
    await prisma.stopTime.deleteMany({});
  }
  
  // Compter d'abord le nombre total de lignes
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
  const startIndex = chunk * CHUNK_SIZE;
  let endIndex = startIndex + CHUNK_SIZE;
  
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
  
  // Filtrer les données si la validation est activée
  let filteredData = chunkData;
  let skippedCount = 0;
  
  if (!skipValidation) {
    filteredData = chunkData.filter(st => {
      const tripId = String(st.trip_id || "");
      const stopId = String(st.stop_id || "");
      
      const isValid = validTripIds.has(tripId) && validStopIds.has(stopId);
      if (!isValid) {
        skippedCount++;
        
        if (skippedCount < 10) {
          console.log(`Horaire ignoré: voyage ${tripId} ou arrêt ${stopId} invalide`);
        } else if (skippedCount === 10) {
          console.log(`D'autres horaires invalides seront ignorés silencieusement...`);
        }
      }
      
      return isValid;
    });
    
    console.log(`${skippedCount} horaires ignorés à cause de références invalides`);
  }
  
  // Préparer les données pour createMany
  const stopTimesToInsert = filteredData.map(st => ({
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
  }));
  
  // Variable pour compter les importations réussies
  let importedCount = 0;
  
  try {
    // Essayer d'abord avec createMany (plus rapide)
    const result = await prisma.stopTime.createMany({
      data: stopTimesToInsert,
      skipDuplicates: true
    });
    
    importedCount = result.count;
  } catch (error) {
    console.error("Erreur avec createMany, retour à la méthode des transactions:", error);
    
    // Si createMany échoue, utiliser la méthode des transactions
    const batchSize = 100;
    
    for (let i = 0; i < stopTimesToInsert.length; i += batchSize) {
      const batch = stopTimesToInsert.slice(i, i + batchSize);
      
      await prisma.$transaction(
        batch.map(stopTime => prisma.stopTime.create({ data: stopTime }))
      );
      
      importedCount += batch.length;
      console.log(
        `Chunk ${chunk}: Importé ${startIndex + i + Math.min(batchSize, batch.length)}/${totalRows} horaires (méthode alternative)`
      );
    }
  }
  
  console.log(
    `Chunk ${chunk}: Importé ${importedCount} horaires (${startIndex}-${endIndex}/${totalRows})`
  );
  
  return {
    status: "success",
    message: `Importé le chunk ${chunk} (${stopTimesToInsert.length} horaires)`,
    imported: importedCount,
    total: totalRows,
    startIndex,
    endIndex,
    hasMore,
    skippedCount
  };
}

// Permettre aussi les requêtes POST pour les déclenchements manuels
export async function POST(request: Request) {
  return GET(request);
}