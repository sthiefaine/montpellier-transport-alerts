import axios from "axios";
import * as protobuf from "protobufjs";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";
import { determineCauseByKeywords, determineEffectByKeywords } from "@/helpers/incident";
import { revalidatePath } from "next/cache";

const ALERT_URL =
  process.env.ALERT_URL ||
  "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/Alert.pb";

const PROTO_PATH = path.join(process.cwd(), "lib/gtfs-realtime.proto");

function isComplement(headerText: string, descriptionText: string) {
  const header = (headerText || "").toLowerCase();
  const description = (descriptionText || "").toLowerCase();

  return (
    header.includes("complement") ||
    header.includes("complément") ||
    description.includes("complément d'info") ||
    description.includes("complément d'information") ||
    description.startsWith("complément")
  );
}

function extractRouteIds(informedEntities: Array<{ routeId?: string }>) {
  if (!informedEntities || !Array.isArray(informedEntities)) return [];
  return informedEntities
    .filter((entity) => entity.routeId)
    .map((entity) => entity.routeId);
}

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

    const regularAlerts = [];
    const complementAlerts = [];

    for (const entity of feedMessage.entity) {
      if (!entity.alert) continue;

      const headerText = entity.alert.headerText?.translation?.[0]?.text || "";
      const descriptionText =
        entity.alert.descriptionText?.translation?.[0]?.text || "";

      if (isComplement(headerText, descriptionText)) {
        complementAlerts.push(entity);
      } else {
        regularAlerts.push(entity);
      }
    }

    for (const entity of regularAlerts) {
      await processAlert(entity);
    }

    for (const entity of complementAlerts) {
      await processComplement(entity);
    }

    console.log(
      `${feedMessage.entity.length} alertes traitées (dont ${complementAlerts.length} compléments)`
    );

    revalidatePath('/');
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des alertes:", error);
    throw error;
  }
}

async function processAlert(entity: any): Promise<void> {
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
  const descriptionText = alert.descriptionText?.translation?.[0]?.text || "";
  const url = alert.url?.translation?.[0]?.text || "";

  const cause =
    alert.cause || determineCauseByKeywords(descriptionText, headerText);
  const effect = alert.effect || determineEffectByKeywords(descriptionText, headerText)

  await prisma.alert.upsert({
    where: { id: entity.id },
    update: {
      timeStart,
      timeEnd,
      cause,
      effect,
      headerText,
      descriptionText,
      url,
      routeIds,
      stopIds,
      updatedAt: new Date(),
      isComplement: false,
    },
    create: {
      id: entity.id,
      timeStart,
      timeEnd,
      cause,
      effect,
      headerText,
      descriptionText,
      url,
      routeIds,
      stopIds,
      isComplement: false,
    },
  });
}

async function processComplement(entity: any): Promise<void> {
  const alert = entity.alert;

  const headerText = alert.headerText?.translation?.[0]?.text || "";
  const descriptionText = alert.descriptionText?.translation?.[0]?.text || "";
  const routeIds = extractRouteIds(alert.informedEntity);

  if (routeIds.length === 0) {
    console.warn(`Complément d'information sans route spécifiée: ${entity.id}`);
    await processAlert(entity);
    return;
  }

  const timeRanges = alert.activePeriod || [];
  const timeStart =
    timeRanges.length > 0 && timeRanges[0].start
      ? new Date(parseInt(timeRanges[0].start) * 1000)
      : new Date();

  const potentialParents = await prisma.alert.findMany({
    where: {
      AND: [
        {
          OR: routeIds.map((routeId) => ({
            routeIds: { contains: routeId },
          })),
        },
        {
          timeStart: { lte: timeStart },
          OR: [{ timeEnd: { gte: timeStart } }, { timeEnd: null }],
          isComplement: false,
        },
      ],
    },
    orderBy: { timeStart: "desc" },
  });

  if (potentialParents.length === 0) {
    console.log(
      `Aucune alerte parent trouvée pour le complément ${entity.id}, traitement comme alerte indépendante`
    );
    await processAlert(entity);
    return;
  }

  const parentAlert = potentialParents[0];

  await prisma.alert.upsert({
    where: { id: entity.id },
    update: {
      parentAlertId: parentAlert.id,
      timeStart,
      timeEnd:
        timeRanges.length > 0 && timeRanges[0].end
          ? new Date(parseInt(timeRanges[0].end) * 1000)
          : null,
      cause: parentAlert.cause,
      effect: alert.effect || parentAlert.effect || "UNKNOWN_EFFECT",
      headerText,
      descriptionText,
      url: alert.url?.translation?.[0]?.text || "",
      routeIds: routeIds.join(","),
      stopIds:
        alert.informedEntity
          ?.filter((entity: any) => entity.stopId)
          .map((entity: any) => entity.stopId)
          .join(",") || "",
      updatedAt: new Date(),
      isComplement: true,
    },
    create: {
      id: entity.id,
      parentAlertId: parentAlert.id,
      timeStart,
      timeEnd:
        timeRanges.length > 0 && timeRanges[0].end
          ? new Date(parseInt(timeRanges[0].end) * 1000)
          : null,
      cause: parentAlert.cause,
      effect: alert.effect || parentAlert.effect || "UNKNOWN_EFFECT",
      headerText,
      descriptionText,
      url: alert.url?.translation?.[0]?.text || "",
      routeIds: routeIds.join(","),
      stopIds:
        alert.informedEntity
          ?.filter((entity: any) => entity.stopId)
          .map((entity: any) => entity.stopId)
          .join(",") || "",
      isComplement: true,
    },
  });

  await prisma.alert.update({
    where: { id: parentAlert.id },
    data: { updatedAt: new Date() },
  });

  console.log(
    `Complément ${entity.id} lié à l'alerte parent ${parentAlert.id}`
  );
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
