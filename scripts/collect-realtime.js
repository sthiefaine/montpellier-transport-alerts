const axios = require("axios");
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function collectRealtimeData() {
  try {
    console.log(
      "Collecte des données temps réel à",
      new Date().toLocaleTimeString()
    );

    const response = await axios({
      method: "get",
      url: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/TripUpdate.pb",
      responseType: "arraybuffer",
    });

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data)
    );

    console.log(`Reçu ${feed.entity.length} entités`);

    const delaysToInsert = [];

    for (const entity of feed.entity) {
      if (entity.tripUpdate) {
        const tripUpdate = entity.tripUpdate;
        const tripId = tripUpdate.trip.tripId;
        const routeId = tripUpdate.trip.routeId;

        for (const stu of tripUpdate.stopTimeUpdate) {
          // Seulement traiter les mises à jour planifiées
          if (
            stu.scheduleRelationship === "SCHEDULED" ||
            stu.scheduleRelationship === "SKIPPED"
          ) {
            const stopId = stu.stopId;
            const status = stu.scheduleRelationship;

            // Traiter l'arrivée
            if (stu.arrival) {
              delaysToInsert.push({
                tripId,
                routeId,
                stopId,
                scheduledTime: null,
                actualTime: stu.arrival.time?.low || null,
                delay: stu.arrival.delay || null,
                status,
              });
            }
          }
        }
      }
    }

    console.log(
      `Préparation de ${delaysToInsert.length} enregistrements à insérer`
    );

    // Utiliser createMany pour des insertions efficaces
    const result = await prisma.realtimeDelay.createMany({
      data: delaysToInsert,
      skipDuplicates: true,
    });

    console.log(`Inséré ${result.count} enregistrements de délais`);

    // Nettoyage des données anciennes (garder 7 jours)
    const deleteResult = await prisma.realtimeDelay.deleteMany({
      where: {
        collectedAt: {
          lt: new Date(Date.now() - 1.1 * 24 * 60 * 60 * 1000),
        },
      },
    });

    console.log(`Nettoyé ${deleteResult.count} anciens enregistrements`);
  } catch (error) {
    console.error("Erreur lors de la collecte:", error);
  }
}

// Exécution unique
collectRealtimeData()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
