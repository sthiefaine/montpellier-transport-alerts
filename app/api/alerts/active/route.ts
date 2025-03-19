import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const now = new Date();

    // Récupérer toutes les alertes actives
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

    return new Response(JSON.stringify(activeAlerts), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes actives:", error);

    return new Response(
      JSON.stringify({
        error: "Erreur lors de la récupération des alertes actives",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
