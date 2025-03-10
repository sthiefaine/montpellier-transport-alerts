// app/api/routes/grouped/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Types pour les structures de données
interface RouteBasic {
  id: string;
  shortName: string;
  longName: string;
  color: string | null;
  type: number;
}

interface RouteWithTrips {
  id: string;
  shortName: string;
  _count: {
    trips: number;
  };
}

interface Direction {
  id: string;
  name: string;
  directionId: number;
  allRouteIds: string[];
}

interface EnrichedRoute {
  id: string;
  shortName: string;
  number: string;
  name: string;
  longName: string;
  color: string | null;
  type: number;
  routeId: string;
  directions: Direction[];
  alternativeIds: string[];
  // Add this field to match frontend expectations
  routeIds?: string[];
}

// Fonction pour extraire les origines et destinations à partir du nom de la ligne
function extractDestinationsFromRouteName(routeName: string): { origin: string, destination: string } {
  // Valeurs par défaut
  let result = { origin: "", destination: "" };
  
  if (!routeName) return result;
  
  // Cas 1: Format "A - B" (le plus courant)
  const separatorMatch = routeName.match(/(.+)\s+-\s+(.+)/);
  if (separatorMatch) {
    result.origin = separatorMatch[1].trim();
    result.destination = separatorMatch[2].trim();
    return result;
  }
  
  // Cas 2: Format "A <-> B"
  const bidirectionalMatch = routeName.match(/(.+)\s+<->\s+(.+)/);
  if (bidirectionalMatch) {
    result.origin = bidirectionalMatch[1].trim();
    result.destination = bidirectionalMatch[2].trim();
    return result;
  }
  
  // Cas 3: Autres séparateurs possibles
  const altSeparatorMatch = routeName.match(/(.+)\s+[\/→⟶>]\s+(.+)/);
  if (altSeparatorMatch) {
    result.origin = altSeparatorMatch[1].trim();
    result.destination = altSeparatorMatch[2].trim();
    return result;
  }
  
  // Si aucun format reconnu, retourner le nom complet dans les deux champs
  result.origin = routeName;
  result.destination = routeName;
  return result;
}

// Type pour le résultat de la requête SQL brute
type HeadsignQueryResult = {
  routeId: string;
  directionId: number | null;
  headsign: string | null;
  count: bigint;
};

export async function GET() {
  try {
    // Fetch all routes from the database
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        shortName: true,
        longName: true,
        color: true,
        type: true,
      },
      orderBy: {
        shortName: "asc",
      },
    });

    // Étape 1: Récupérer toutes les lignes avec leurs voyages associés pour déterminer quelle variante est utilisée
    const routesWithTrips = await prisma.route.findMany({
      select: {
        id: true,
        shortName: true,
        _count: {
          select: {
            trips: true,
          },
        },
      },
    });

    // Étape 1b: Récupérer les headsigns pour chaque route et direction
    let headsignsData: HeadsignQueryResult[] = [];
    try {
      // Dans le schéma Prisma, le champ est nommé 'headsign' mais mappé à 'trip_headsign' dans la BDD
      headsignsData = await prisma.$queryRaw<HeadsignQueryResult[]>`
        SELECT 
          "routeId", 
          "directionId", 
          "headsign", 
          COUNT(*) as count
        FROM 
          "trips"
        WHERE 
          "headsign" IS NOT NULL
        GROUP BY 
          "routeId", "directionId", "headsign"
        ORDER BY 
          "routeId", "directionId", COUNT(*) DESC
      `;
      console.log(`Found ${headsignsData.length} headsigns from trips`);
    } catch (sqlError) {
      console.error("SQL query error:", sqlError);
      // Continue with empty headsigns data
    }

    // Map pour stocker le headsign le plus utilisé pour chaque combinaison route/direction
    const routeDirectionHeadsigns = new Map<string, Map<number, string>>();
    
    // Structurer les headsigns par route et direction
    headsignsData.forEach(record => {
      if (!record.headsign) return; // Ignorer les enregistrements sans headsign
      
      const routeKey = record.routeId;
      const directionId = record.directionId === null ? 0 : Number(record.directionId);
      
      if (!routeDirectionHeadsigns.has(routeKey)) {
        routeDirectionHeadsigns.set(routeKey, new Map<number, string>());
      }
      
      const directionMap = routeDirectionHeadsigns.get(routeKey)!;
      
      // Ne remplacer que si ce headsign est le premier pour cette direction (celui avec le plus d'occurrences)
      if (!directionMap.has(directionId)) {
        directionMap.set(directionId, record.headsign);
        console.log(`Route ${routeKey}, direction ${directionId} → Headsign: "${record.headsign}"`);
      }
    });
    
    // Helper function pour afficher des informations détaillées sur les headsigns
    function logHeadsignDebugInfo(map: Map<string, Map<number, string>>) {
      console.log("\n--- HEADSIGN DEBUG INFO ---");
      console.log(`Total routes with headsigns: ${map.size}`);
      
      // Convert the nested Map to a more readable object for logging
      const result: Record<string, Record<string, string>> = {};
      
      map.forEach((directionMap, routeId) => {
        result[routeId] = {};
        
        directionMap.forEach((headsign, directionId) => {
          result[routeId][`direction_${directionId}`] = headsign;
        });
      });
      
      console.log(JSON.stringify(result, null, 2));
      console.log("--- END HEADSIGN DEBUG INFO ---\n");
    }
    
    // Afficher les informations de débogage
    logHeadsignDebugInfo(routeDirectionHeadsigns);

    // Créer un map des routes avec leur nombre de voyages
    const routeTripsCountMap = new Map<string, number>();
    routesWithTrips.forEach((route: RouteWithTrips) => {
      routeTripsCountMap.set(route.id, route._count.trips);
    });

    // Étape 2: Regrouper les routes par shortName
    const routeGroups: Record<string, RouteBasic[]> = {};
    routes.forEach((route: RouteBasic) => {
      // Guard against undefined shortName
      if (!route.shortName) {
        console.warn(`Route ${route.id} has undefined shortName`);
        return;
      }
      
      if (!routeGroups[route.shortName]) {
        routeGroups[route.shortName] = [];
      }
      routeGroups[route.shortName].push(route);
    });

    // Étape 3: Pour chaque groupe, sélectionner la meilleure route et inverser les IDs
    const enrichedRoutes: EnrichedRoute[] = Object.entries(routeGroups).map(([shortName, group]) => {
      // Si le groupe n'a qu'une seule route, la retourner directement
      if (group.length === 1) {
        const route = group[0];
        
        // Récupérer les headsigns pour les directions
        const routeHeadsigns = routeDirectionHeadsigns.get(route.id) || new Map<number, string>();
        console.log(`Headsigns for route ${route.id}:`, Object.fromEntries(routeHeadsigns));
        
        // Extraction intelligente des destinations à partir du nom de la ligne
        let destinationNames = extractDestinationsFromRouteName(route.longName);
        
        // Utiliser des noms de destination significatifs ou des valeurs par défaut
        const headsign0 = routeHeadsigns.get(0) || destinationNames.destination || "Direction Aller";
        const headsign1 = routeHeadsigns.get(1) || destinationNames.origin || "Direction Retour";
        
        return {
          id: route.id,
          shortName: route.shortName,
          number: route.shortName,
          name: route.longName,
          longName: route.longName,
          color: route.color,
          type: route.type,
          routeId: route.id,
          directions: [
            {
              id: route.id,
              name: headsign0,
              directionId: 0,
              allRouteIds: [route.id],
            },
            {
              id: route.id,
              name: headsign1,
              directionId: 1,
              allRouteIds: [route.id],
            },
          ],
          alternativeIds: [],
          routeIds: [route.id], // Add this field to match frontend expectations
        };
      }

      // Trouver la route avec le plus de voyages dans le groupe pour déterminer les bonnes données
      const bestRoute = group.reduce((best, current) => {
        const bestTripCount = routeTripsCountMap.get(best.id) || 0;
        const currentTripCount = routeTripsCountMap.get(current.id) || 0;
        return currentTripCount > bestTripCount ? current : best;
      }, group[0]);

      // Récupérer tous les IDs de routes du groupe
      const allRouteIds = group.map(r => r.id);
      
      // Organiser les IDs: placer l'ID actuel de bestRoute dans alternativeIds et utiliser le premier ID alternatif comme ID principal
      const otherIds = allRouteIds.filter(id => id !== bestRoute.id);
      
      // Maintenant on inverse la logique: on utilise l'ID alternatif comme ID principal si disponible
      const mainId = otherIds.length > 0 ? otherIds[0] : bestRoute.id;
      const alternativeIds = mainId === bestRoute.id ? otherIds : [bestRoute.id, ...otherIds.filter(id => id !== mainId)];
      
      // Récupérer les headsigns pour les directions
      const routeHeadsigns = routeDirectionHeadsigns.get(bestRoute.id) || new Map<number, string>();
      console.log(`Headsigns for best route ${bestRoute.id}:`, Object.fromEntries(routeHeadsigns));
      
      // Extraction intelligente des destinations à partir du nom de la ligne
      let destinationNames = extractDestinationsFromRouteName(bestRoute.longName);
      
      // Utiliser des noms de destination significatifs ou des valeurs par défaut
      const headsign0 = routeHeadsigns.get(0) || destinationNames.destination || "Direction Aller";
      const headsign1 = routeHeadsigns.get(1) || destinationNames.origin || "Direction Retour";

      // Construire l'objet route enrichie avec les IDs inversés
      return {
        id: mainId, // Utiliser l'ID alternatif comme ID principal
        shortName: bestRoute.shortName,
        number: bestRoute.shortName,
        name: bestRoute.longName, 
        longName: bestRoute.longName,
        color: bestRoute.color,
        type: bestRoute.type,
        routeId: mainId, // Même ID que l'ID principal
        directions: [
          {
            id: mainId, // Utiliser l'ID principal pour direction aussi
            name: headsign0, // Utiliser le headsign au lieu de "Aller"
            directionId: 0,
            allRouteIds: allRouteIds,
          },
          {
            id: mainId, // Utiliser l'ID principal pour direction aussi
            name: headsign1, // Utiliser le headsign au lieu de "Retour"
            directionId: 1,
            allRouteIds: allRouteIds,
          },
        ],
        alternativeIds: alternativeIds, // Les autres IDs
        routeIds: allRouteIds, // Add this field to match frontend expectations
      };
    });

    // Trier les routes with null-check before sorting
    if (enrichedRoutes.length > 0) {
      enrichedRoutes.sort((a, b) => {
        // Guard against undefined shortName
        if (!a.shortName || !b.shortName) {
          return 0;
        }
        
        // Extraire des nombres, lettres et autres caractères
        const aMatches = a.shortName.match(/^([A-Za-z]*)(\d*)(.*)$/);
        const bMatches = b.shortName.match(/^([A-Za-z]*)(\d*)(.*)$/);

        if (!aMatches || !bMatches) {
          return a.shortName.localeCompare(b.shortName);
        }

        // Comparer d'abord les préfixes (lettres)
        const [, aPrefix, aNumber, aSuffix] = aMatches;
        const [, bPrefix, bNumber, bSuffix] = bMatches;

        if (aPrefix !== bPrefix) {
          return aPrefix.localeCompare(bPrefix);
        }

        // Si les préfixes sont identiques, comparer les nombres
        const aNum = parseInt(aNumber);
        const bNum = parseInt(bNumber);

        if (!isNaN(aNum) && !isNaN(bNum) && aNum !== bNum) {
          return aNum - bNum;
        }

        // Si les nombres sont identiques ou invalides, comparer les suffixes
        return aSuffix.localeCompare(bSuffix);
      });
    }

    return NextResponse.json(enrichedRoutes);
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { error: "Failed to fetch routes" },
      { status: 500 }
    );
  }
}