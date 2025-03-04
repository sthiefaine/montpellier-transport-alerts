import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    
    const searchParams = request.nextUrl.searchParams;
    const months = parseInt(searchParams.get("months") || "6");

    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    
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

    
    const calendarData: Record<string, number> = {};

    alerts.forEach((alert) => {
      
      const dateKey = alert.timeStart.toISOString().split("T")[0];
      
      if (calendarData[dateKey]) {
        calendarData[dateKey]++;
      } else {
        calendarData[dateKey] = 1;
      }
    });

    
    return new Response(JSON.stringify(calendarData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", 
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
