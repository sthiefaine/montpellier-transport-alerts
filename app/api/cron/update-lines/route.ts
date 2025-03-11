import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes maximum

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Vérification de l'authentification
    const authHeader = request.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
      });
    }

    console.log(
      "Démarrage de la mise à jour des données de lignes de transport..."
    );
    const startTime = Date.now();

    // Télécharger les données
    console.log("Téléchargement des fichiers JSON...");
    const [tramResponse, busResponse] = await Promise.all([
      axios.get(
        "https://data.montpellier3m.fr/sites/default/files/ressources/MMM_MMM_LigneTram.json"
      ),
      axios.get(
        "https://data.montpellier3m.fr/sites/default/files/ressources/MMM_MMM_BusLigne.json"
      ),
    ]);

    const tramData = tramResponse.data;
    const busData = busResponse.data;

    console.log(
      `Données téléchargées - Tram: ${tramData.features.length} lignes, Bus: ${busData.features.length} lignes`
    );

    // Récupérer les routes existantes pour mapper les IDs
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        shortName: true,
      },
    });

    // Créer un mapping des shortName vers les IDs
    const routeMapping = new Map();
    routes.forEach((route) => {
      routeMapping.set(route.shortName, route.id);
    });

    console.log(
      `${routes.length} routes existantes trouvées dans la base de données`
    );

    // Traiter et insérer les données tram
    const tramResults = await processTramLines(tramData, routeMapping);

    // Traiter et insérer les données bus
    const busResults = await processBusLines(busData, routeMapping);

    // Calculer les statistiques finales
    const totalProcessed = tramResults.processed + busResults.processed;
    const totalCreated = tramResults.created + busResults.created;
    const totalUpdated = tramResults.updated + busResults.updated;
    const totalSkipped = tramResults.skipped + busResults.skipped;

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`Traitement terminé en ${durationSeconds}s`);
    console.log(
      `Total traité: ${totalProcessed}, Créé: ${totalCreated}, Mis à jour: ${totalUpdated}, Ignoré: ${totalSkipped}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Données des lignes mises à jour avec succès",
        stats: {
          duration: `${durationSeconds}s`,
          processed: totalProcessed,
          created: totalCreated,
          updated: totalUpdated,
          skipped: totalSkipped,
          tram: tramResults,
          bus: busResults,
        },
      })
    );
  } catch (error) {
    console.error(
      "Erreur lors de la mise à jour des données de lignes:",
      error
    );
    return new Response(
      JSON.stringify({
        error: "Erreur lors de la mise à jour des données",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500 }
    );
  }
}

// Fonction pour traiter les lignes de tram
async function processTramLines(
  tramData: any,
  routeMapping: Map<string, string>
) {
  let processed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  if (!tramData.features || !Array.isArray(tramData.features)) {
    console.warn("Données de tram invalides ou vides");
    return { processed, created, updated, skipped };
  }

  console.log(`Traitement de ${tramData.features.length} lignes de tram...`);

  for (const feature of tramData.features) {
    processed++;

    try {
      // Identifier la ligne de tram (le numéro de ligne est généralement dans nom_carto ou codetotem)
      let lineNumber =
        feature.properties.codetotem ||
        feature.properties.nom_carto?.match(/Ligne\s+(\d+)/i)?.[1] ||
        feature.properties.id?.toString();

      if (!lineNumber) {
        console.warn(
          `Impossible d'identifier le numéro de ligne pour une entrée tram: ${JSON.stringify(
            feature.properties
          )}`
        );
        skipped++;
        continue;
      }

      // Normaliser le numéro de ligne pour correspondre au format de shortName
      lineNumber = lineNumber.trim();


      const routeId = routeMapping.get(lineNumber);

      if (!routeId) {
        console.warn(
          `Aucune route correspondante trouvée pour la ligne de tram ${lineNumber}`
        );
        skipped++;
        continue;
      }

      const existing = await prisma.lineGeometry.findFirst({
        where: {
          routeId,
          lineType: "tram",
        },
      });

      if (existing) {
    
        await prisma.lineGeometry.update({
          where: { id: existing.id },
          data: {
            geometry: feature.geometry,
            properties: feature.properties,
            lastUpdated: new Date(),
          },
        });
        updated++;
        console.log(`Ligne de tram ${lineNumber} (ID: ${routeId}) mise à jour`);
      } else {

        await prisma.lineGeometry.create({
          data: {
            routeId,
            lineType: "tram",
            geometry: feature.geometry,
            properties: feature.properties,
            lastUpdated: new Date(),
          },
        });
        created++;
        console.log(`Ligne de tram ${lineNumber} (ID: ${routeId}) créée`);
      }
    } catch (error) {
      console.error(
        `Erreur lors du traitement de la ligne de tram #${processed}:`,
        error
      );
      skipped++;
    }
  }

  return { processed, created, updated, skipped };
}

async function processBusLines(
  busData: any,
  routeMapping: Map<string, string>
) {
  let processed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  if (!busData.features || !Array.isArray(busData.features)) {
    console.warn("Données de bus invalides ou vides");
    return { processed, created, updated, skipped };
  }

  console.log(`Traitement de ${busData.features.length} lignes de bus...`);

  for (const feature of busData.features) {
    processed++;

    try {
      let lineNumber =
        feature.properties.codetotem ||
        feature.properties.nom_carto?.match(/Ligne\s+(\d+)/i)?.[1] ||
        feature.properties.id?.toString();

      if (!lineNumber) {
        console.warn(
          `Impossible d'identifier le numéro de ligne pour une entrée bus: ${JSON.stringify(
            feature.properties
          )}`
        );
        skipped++;
        continue;
      }

      lineNumber = lineNumber.trim();

      const routeId = routeMapping.get(lineNumber);

      if (!routeId) {
        console.warn(
          `Aucune route correspondante trouvée pour la ligne de bus ${lineNumber}`
        );
        skipped++;
        continue;
      }

      const existing = await prisma.lineGeometry.findFirst({
        where: {
          routeId,
          lineType: "bus",
        },
      });

      if (existing) {
        await prisma.lineGeometry.update({
          where: { id: existing.id },
          data: {
            geometry: feature.geometry,
            properties: feature.properties,
            lastUpdated: new Date(),
          },
        });
        updated++;
        console.log(`Ligne de bus ${lineNumber} (ID: ${routeId}) mise à jour`);
      } else {
        await prisma.lineGeometry.create({
          data: {
            routeId,
            lineType: "bus",
            geometry: feature.geometry,
            properties: feature.properties,
            lastUpdated: new Date(),
          },
        });
        created++;
        console.log(`Ligne de bus ${lineNumber} (ID: ${routeId}) créée`);
      }
    } catch (error) {
      console.error(
        `Erreur lors du traitement de la ligne de bus #${processed}:`,
        error
      );
      skipped++;
    }
  }

  return { processed, created, updated, skipped };
}
