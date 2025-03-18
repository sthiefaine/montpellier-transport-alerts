"use server";

import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

export async function getCalendarData(months: number = 18) {
  try {
    // Calcul des dates pour la plage de récupération
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - months * 30); // Approximation
    startDate.setHours(0, 0, 0, 0);

    const dateString = startDate.toISOString().split("T")[0];
    const endDateString = endDate.toISOString().split("T")[0];

    console.log(
      `Récupération des données calendrier du ${dateString} au ${endDateString}`
    );

    // Récupération des alertes pour la période demandée
    const alerts = await prisma.alert.findMany({
      where: {
        timeStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        timeStart: true,
        timeEnd: true,
        effect: true,
      },
    });

    console.log(
      `Récupéré ${alerts.length} alertes pour le calendrier d'incidents`
    );

    // Construction des données pour le calendrier
    const calendarData: Record<string, number> = {};

    alerts.forEach((alert) => {
      // Récupérer la date (sans l'heure)
      const dateKey = alert.timeStart.toISOString().split("T")[0];
      
      // Incrémenter le compteur pour cette date
      if (calendarData[dateKey]) {
        calendarData[dateKey]++;
      } else {
        calendarData[dateKey] = 1;
      }
    });

    return calendarData;
  } catch (error) {
    console.error("Erreur lors du chargement du calendrier:", error);
    return {};
  }
}

// Fonction pour forcer la revalidation du calendrier
export async function refreshCalendarData() {
  revalidateTag("alerts");
  return { success: true, message: "Revalidation du calendrier réussie" };
}