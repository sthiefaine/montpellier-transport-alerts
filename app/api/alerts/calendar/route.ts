import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Obtenir la période demandée (par défaut 6 mois)
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get("months") || "6");

    // Calculer la date de début (aujourd'hui - X mois)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Récupérer toutes les alertes dans cette période
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

    // Formater les données pour le calendrier
    const calendarData: Record<string, number> = {};

    alerts.forEach((alert) => {
      // Formater la date au format YYYY-MM-DD
      const dateKey = alert.timeStart.toISOString().split("T")[0];
      // Incrémenter le compteur pour cette date
      if (calendarData[dateKey]) {
        calendarData[dateKey]++;
      } else {
        calendarData[dateKey] = 1;
      }
    });

    // Retourner les données au format JSON
    return new Response(JSON.stringify(calendarData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // Cache de 5 minutes
      },
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des données du calendrier:",
      error
    );

    return new Response(
      JSON.stringify({
        error: "Erreur lors de la récupération des données du calendrier",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
