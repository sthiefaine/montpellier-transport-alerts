import axios from "axios";
import * as protobuf from "protobufjs";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";


const ALERT_URL = process.env.ALERT_URL || "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/Alert.pb"

const PROTO_PATH = path.join(
  process.cwd(),
  "lib/gtfs-realtime.proto"
);


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


async function parseAlertFile(buffer: Buffer): Promise<any> {
  try {
    
    const root = await protobuf.load(PROTO_PATH);

    
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

    
    const message = FeedMessage.decode(buffer);

    
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


async function saveAlerts(feedMessage: any): Promise<void> {
  try {
    if (!feedMessage.entity || !Array.isArray(feedMessage.entity)) {
      console.warn("Aucune entité trouvée dans le feed message");
      return;
    }

    
    for (const entity of feedMessage.entity) {
      if (!entity.alert) continue;

      const alert = entity.alert;

      
      const timeRanges = alert.activePeriod || [];
      const timeStart =
        timeRanges.length > 0 && timeRanges[0].start
          ? new Date(parseInt(timeRanges[0].start) * 1000)
          : new Date();

      const timeEnd =
        timeRanges.length > 0 && timeRanges[0].end
          ? new Date(parseInt(timeRanges[0].end) * 1000)
          : null;

      
      const informedEntities = alert.informedEntity || [];
      const routeIds = informedEntities
        .filter((entity: any) => entity.routeId)
        .map((entity: any) => entity.routeId)
        .join(",");

      const stopIds = informedEntities
        .filter((entity: any) => entity.stopId)
        .map((entity: any) => entity.stopId)
        .join(",");

      
      const headerText = alert.headerText?.translation?.[0]?.text || "";
      const descriptionText =
        alert.descriptionText?.translation?.[0]?.text || "";
      const url = alert.url?.translation?.[0]?.text || "";

      
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


export async function fetchAndProcessAlerts(): Promise<void> {
  try {
    
    const alertBuffer = await downloadAlertFile();

    
    const feedMessage = await parseAlertFile(alertBuffer);

    
    await saveAlerts(feedMessage);

    console.log("Traitement des alertes terminé avec succès");
  } catch (error) {
    console.error("Erreur lors du traitement des alertes:", error);
  } finally {
    
    await prisma.$disconnect();
  }
}


if (require.main === module) {
  fetchAndProcessAlerts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
