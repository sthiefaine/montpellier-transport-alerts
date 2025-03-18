"use server";

import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

interface Alert {
  id: string;
  timeStart: Date;
  timeEnd: Date | null;
  cause: string;
  effect: string;
  headerText: string;
  descriptionText: string;
  routeIds: string | null;
  stopIds: string | null;
  isComplement: boolean;
  parentAlertId: string | null;
  [key: string]: any;
}

export async function getActiveAlerts(): Promise<Alert[]> {
  try {
    const now = new Date();

    const activeAlerts = await prisma.alert.findMany({
      where: {
        timeStart: { lte: now },
        OR: [{ timeEnd: { gte: now } }, { timeEnd: null }],
      },
      select: {
        id: true,
        timeStart: true,
        timeEnd: true,
        cause: true,
        effect: true,
        headerText: true,
        descriptionText: true,
        routeIds: true,
        stopIds: true,
        isComplement: true,
        parentAlertId: true,
      },
      orderBy: {
        timeStart: "desc",
      },
    });

    return activeAlerts;
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes actives:", error);
    // En cas d'erreur, retourner un tableau vide
    return [];
  }
}

// Fonction pour forcer la revalidation des alertes
export async function refreshActiveAlerts() {
  revalidateTag("alerts");
  return { success: true, message: "Alertes actives revalidées" };
}
