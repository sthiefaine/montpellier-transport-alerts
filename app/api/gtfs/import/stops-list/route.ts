// app/api/gtfs/import-stops-list/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { 
  StopsJsonResponse, 
  StopFeature,
  StopsListEntry, 
  StopData,
  StopsListUpdateItem,
  ImportStopsResponse
} from "@/lib/types/stops";

const prisma = new PrismaClient();
const IMPORT_TOKEN = process.env.CRON_SECRET;

// Pour augmenter la durée d'exécution maximum
export const maxDuration = 300; // 5 minutes

// Function to validate authorization
function validateAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === IMPORT_TOKEN;
}

/**
 * Transforme un Feature de la réponse JSON en entrée pour StopsList
 */
function transformFeatureToStopsListEntry(feature: StopFeature, source: 'tram' | 'bus'): StopsListEntry {
  return {
    description: feature.properties.description,
    lon: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    lignesPassantes: feature.properties.lignes_passantes || null,
    lignesEtDirections: feature.properties.lignes_et_directions || null,
    station: feature.properties.station || null,
    commune: feature.properties.commune || null,
    source
  };
}

export async function GET(request: Request): Promise<NextResponse<ImportStopsResponse | { error: string, message?: string, stack?: string }>> {
  try {
    // Validate authentication
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    console.log("Starting import of tram and bus stops...");
    
    // Download the JSON files
    console.log("Downloading tram stops data...");
    const tramResponse = await axios.get<StopsJsonResponse>("https://data.montpellier3m.fr/sites/default/files/ressources/MMM_MMM_ArretsTram.json");
    console.log("Downloading bus stops data...");
    const busResponse = await axios.get<StopsJsonResponse>("https://data.montpellier3m.fr/sites/default/files/ressources/MMM_MMM_ArretsBus.json");
    
    const tramData = tramResponse.data;
    const busData = busResponse.data;
    
    console.log(`Downloaded ${tramData.features.length} tram stops and ${busData.features.length} bus stops`);
    
    // Process tram stops
    const tramStops: StopsListEntry[] = tramData.features.map(feature => 
      transformFeatureToStopsListEntry(feature, 'tram')
    );
    
    // Process bus stops
    const busStops: StopsListEntry[] = busData.features.map(feature => 
      transformFeatureToStopsListEntry(feature, 'bus')
    );
    
    // Combine all stops
    const allStops: StopsListEntry[] = [...tramStops, ...busStops];
    
    // Clear existing data (optionnel, selon que vous vouliez conserver l'historique ou non)
    console.log("Clearing existing stops list data...");
    await prisma.stopsList.deleteMany();
    
    // Insert into database using upsert method in batches
    console.log("Inserting stops into database...");
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < allStops.length; i += batchSize) {
      const batch = allStops.slice(i, i + batchSize);
      const result = await prisma.stopsList.createMany({
        data: batch,
        skipDuplicates: true
      });
      insertedCount += result.count;
      console.log(`Inserted ${insertedCount}/${allStops.length} stops so far...`);
    }
    
    // Now let's try to match with existing stops
    console.log("Matching with existing stops based on geolocation...");
    
    // Get all stops from both tables
    const stopsListEntries = await prisma.stopsList.findMany();
    const gtfsStops = await prisma.stop.findMany({
      select: {
        id: true,
        lat: true,
        lon: true,
        name: true
      }
    }) as StopData[];
    
    console.log(`Found ${stopsListEntries.length} stops in stopsList and ${gtfsStops.length} stops in GTFS stops table`);
    
    // For each stop in our new list, find the closest match in the GTFS stops table
    let matchCount = 0;
    let updateBatch: StopsListUpdateItem[] = [];
    
    const threshold = 0.00005;
    
    for (const entry of stopsListEntries) {
      // Find the closest stop from the GTFS data
      let closestStop: StopData | null = null;
      let minDistance = Infinity;
      
      for (const gtfsStop of gtfsStops) {
        const distance = Math.sqrt(
          Math.pow(entry.lat - gtfsStop.lat, 2) + 
          Math.pow(entry.lon - gtfsStop.lon, 2)
        );
        
        if (distance < minDistance && distance < threshold) {
          minDistance = distance;
          closestStop = gtfsStop;
        }
      }
      
      if (closestStop) {
        updateBatch.push({
          id: entry.id!,
          stopId: closestStop.id
        });
        
        matchCount++;
        
        // Process in batches to avoid memory issues
        if (updateBatch.length >= 100) {
          await Promise.all(
            updateBatch.map(item => 
              prisma.stopsList.update({
                where: { id: item.id },
                data: { stopId: item.stopId }
              })
            )
          );
          
          console.log(`Updated ${matchCount} matches so far...`);
          updateBatch = [];
        }
      }
    }
    
    // Process any remaining updates
    if (updateBatch.length > 0) {
      await Promise.all(
        updateBatch.map(item => 
          prisma.stopsList.update({
            where: { id: item.id },
            data: { stopId: item.stopId }
          })
        )
      );
    }
    
    console.log(`Matched ${matchCount} out of ${stopsListEntries.length} stops with existing GTFS stops`);
    
    // Try to match remaining stops by name
    if (matchCount < stopsListEntries.length) {
      console.log("Attempting to match remaining stops by name...");
      
      const unmatchedStops = await prisma.stopsList.findMany({
        where: { stopId: null }
      });
      
      let nameMatchCount = 0;
      updateBatch = [];
      
      for (const unmatched of unmatchedStops) {
        // Normalize both names for comparison (lowercase, remove accents, etc.)
        const normalizedDescription = unmatched.description.toLowerCase().trim();
        
        // Find GTFS stops with similar names
        const matchingStops = gtfsStops.filter(stop => {
          const normalizedName = stop.name.toLowerCase().trim();
          return normalizedName.includes(normalizedDescription) || 
                 normalizedDescription.includes(normalizedName);
        });
        
        if (matchingStops.length > 0) {
          // If multiple matches, find the closest one
          let bestMatch = matchingStops[0];
          let minDistance = Math.sqrt(
            Math.pow(unmatched.lat - bestMatch.lat, 2) + 
            Math.pow(unmatched.lon - bestMatch.lon, 2)
          );
          
          for (let i = 1; i < matchingStops.length; i++) {
            const distance = Math.sqrt(
              Math.pow(unmatched.lat - matchingStops[i].lat, 2) + 
              Math.pow(unmatched.lon - matchingStops[i].lon, 2)
            );
            
            if (distance < minDistance) {
              minDistance = distance;
              bestMatch = matchingStops[i];
            }
          }
          
          updateBatch.push({
            id: unmatched.id!,
            stopId: bestMatch.id
          });
          
          nameMatchCount++;
          
          // Process in batches
          if (updateBatch.length >= 100) {
            await Promise.all(
              updateBatch.map(item => 
                prisma.stopsList.update({
                  where: { id: item.id },
                  data: { stopId: item.stopId }
                })
              )
            );
            
            console.log(`Updated ${nameMatchCount} name matches so far...`);
            updateBatch = [];
          }
        }
      }
      
      // Process any remaining updates
      if (updateBatch.length > 0) {
        await Promise.all(
          updateBatch.map(item => 
            prisma.stopsList.update({
              where: { id: item.id },
              data: { stopId: item.stopId }
            })
          )
        );
      }
      
      console.log(`Matched an additional ${nameMatchCount} stops by name similarity`);
      matchCount += nameMatchCount;
    }
    
    const response: ImportStopsResponse = {
      status: "success",
      message: "Tram and bus stops imported successfully",
      stats: {
        imported: insertedCount,
        matched: matchCount,
        total: allStops.length
      }
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in stops-list import process:", error);
    return NextResponse.json(
      { 
        error: "Error in stops-list import process", 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// POST endpoint (same as GET for flexibility)
export async function POST(request: Request) {
  return GET(request);
}