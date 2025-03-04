// scripts/import-gtfs.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const csv = require("csv-parser");
const unzipper = require("unzipper");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function downloadAndExtractGTFS() {
  console.log("Téléchargement des données GTFS statiques...");

  const response = await axios({
    method: "get",
    url: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip",
    responseType: "stream",
  });

  const extractionPath = path.join(__dirname, "../gtfs-files");
  if (!fs.existsSync(extractionPath)) {
    fs.mkdirSync(extractionPath, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const zipPath = path.join(extractionPath, "gtfs.zip");
    const writer = fs.createWriteStream(zipPath);

    response.data.pipe(writer);

    writer.on("finish", async () => {
      console.log("Téléchargement terminé, extraction...");

      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractionPath }))
        .on("close", () => {
          console.log("Extraction terminée");
          resolve(extractionPath);
        })
        .on("error", reject);
    });

    writer.on("error", reject);
  });
}

async function importStops(extractionPath) {
  console.log("Importation des arrêts...");
  const results = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(extractionPath, "stops.txt"))
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          // Supprimer tous les arrêts existants pour éviter les doublons
          await prisma.stop.deleteMany({});

          console.log(`Importation de ${results.length} arrêts...`);

          // Importer par lots pour de meilleures performances
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
              `Importé ${Math.min(i + batchSize, results.length)}/${
                results.length
              } arrêts`
            );
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });
  });
}

async function importRoutes(extractionPath) {
  console.log("Importation des lignes...");
  const results = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(path.join(extractionPath, "routes.txt"))
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        try {
          await prisma.route.deleteMany({});

          console.log(`Importation de ${results.length} lignes...`);

          await prisma.$transaction(
            results.map((route) =>
              prisma.route.create({
                data: {
                  id: route.route_id,
                  shortName: route.route_short_name,
                  longName: route.route_long_name,
                  type: parseInt(route.route_type),
                  color: route.route_color || null,
                  textColor: route.route_text_color || null,
                },
              })
            )
          );

          resolve();
        } catch (error) {
          reject(error);
        }
      });
  });
}

async function main() {
  try {
    const extractionPath = await downloadAndExtractGTFS();

    await importStops(extractionPath);
    await importRoutes(extractionPath);

    console.log("Importation GTFS terminée avec succès");
  } catch (error) {
    console.error("Erreur lors de l'importation:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
