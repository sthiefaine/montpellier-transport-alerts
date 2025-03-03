import axios from "axios";
import * as protobuf from "protobufjs";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";

// URL des alertes GTFS-RT
const ALERT_URL =
  process.env.ALERT_URL ||
  "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/Alert.pb";
// Chemin vers le fichier proto
const PROTO_PATH = path.join(
  process.cwd(),
  "src/lib/proto/gtfs-realtime.proto"
);

// Fonction pour télécharger le fichier d'alertes
async function downloadAlertFile(): Promise<Buffer> {
  console.log(`Téléchargement des alertes depuis ${ALERT_URL}`);

  try {
    const response = await axios.get(ALERT_URL, {
      responseType: "arraybuffer",
    });

    if (response.status !== 200) {
      throw new Error(
        `Erreur lors du téléchargement: ${response.status} ${response.statusText}`
      );
    }

    return Buffer.from(response.data);
  } catch (error) {
    console.error("Erreur lors du téléchargement des alertes:", error);
    throw error;
  }
}

// Fonction pour parser le fichier protobuf
async function parseAlertFile(buffer: Buffer): Promise<any> {
  try {
    // Charger le fichier proto
    const root = await protobuf.load(PROTO_PATH);

    // Obtenir le type de message
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

    // Décoder le message
    const message = FeedMessage.decode(buffer);

    // Convertir en objet JavaScript
    return FeedMessage.toObject(message, {
      longs: String,
      enums: String,
      bytes: String,
    });
  } catch (error) {
    console.error("Erreur lors du parsing du fichier protobuf:", error);
    throw error;
  }
}

// Fonction pour sauvegarder les alertes dans la base de données
async function saveAlerts(feedMessage: any): Promise<void> {
  try {
    if (!feedMessage.entity || !Array.isArray(feedMessage.entity)) {
      console.warn("Aucune entité trouvée dans le feed message");
      return;
    }

    // Traitement de chaque alerte
    for (const entity of feedMessage.entity) {
      if (!entity.alert) continue;

      const alert = entity.alert;

      // Extraire les intervalles de temps
      const timeRanges = alert.activePeriod || [];
      const timeStart =
        timeRanges.length > 0 && timeRanges[0].start
          ? new Date(parseInt(timeRanges[0].start) * 1000)
          : new Date();

      const timeEnd =
        timeRanges.length > 0 && timeRanges[0].end
          ? new Date(parseInt(timeRanges[0].end) * 1000)
          : null;

      // Extraire les identifiants de routes et d'arrêts affectés
      const informedEntities = alert.informedEntity || [];
      const routeIds = informedEntities
        .filter((entity: any) => entity.routeId)
        .map((entity: any) => entity.routeId)
        .join(",");

      const stopIds = informedEntities
        .filter((entity: any) => entity.stopId)
        .map((entity: any) => entity.stopId)
        .join(",");

      // Extraire les textes
      const headerText = alert.headerText?.translation?.[0]?.text || "";
      const descriptionText =
        alert.descriptionText?.translation?.[0]?.text || "";
      const url = alert.url?.translation?.[0]?.text || "";

      // Créer ou mettre à jour l'alerte dans la base de données
      await prisma.alert.upsert({
        where: { id: entity.id },
        update: {
          timeStart,
          timeEnd,
          cause: alert.cause || "UNKNOWN_CAUSE",
          effect: alert.effect || "UNKNOWN_EFFECT",
          headerText,
          descriptionText,
          url,
          routeIds,
          stopIds,
          updatedAt: new Date(),
        },
        create: {
          id: entity.id,
          timeStart,
          timeEnd,
          cause: alert.cause || "UNKNOWN_CAUSE",
          effect: alert.effect || "UNKNOWN_EFFECT",
          headerText,
          descriptionText,
          url,
          routeIds,
          stopIds,
        },
      });
    }

    console.log(`${feedMessage.entity.length} alertes traitées`);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des alertes:", error);
    throw error;
  }
}

// Fonction principale pour récupérer et traiter les alertes
export async function fetchAndProcessAlerts(): Promise<void> {
  try {
    // Télécharger le fichier d'alertes
    const alertBuffer = await downloadAlertFile();

    // Parser le fichier
    const feedMessage = await parseAlertFile(alertBuffer);

    // Sauvegarder les alertes dans la base de données
    await saveAlerts(feedMessage);

    console.log("Traitement des alertes terminé avec succès");
  } catch (error) {
    console.error("Erreur lors du traitement des alertes:", error);
  } finally {
    // Fermer la connexion Prisma
    await prisma.$disconnect();
  }
}

// Si ce fichier est exécuté directement
if (require.main === module) {
  fetchAndProcessAlerts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
