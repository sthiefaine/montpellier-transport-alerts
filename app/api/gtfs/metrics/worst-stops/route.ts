// app/api/gtfs/metrics/worst-stops/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const routeId = url.searchParams.get("routeId");
    const limitParam = url.searchParams.get("limit") || "20";
    const limit = parseInt(limitParam, 10);

    // Déterminer la date (aujourd'hui par défaut)
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: "Format de date invalide" },
          { status: 400 }
        );
      }
    } else {
      // Hier par défaut
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
      targetDate.setHours(0, 0, 0, 0);
    }

    // Construire la clause where
    const whereClause: any = {
      date: targetDate,
    };

    if (routeId) {
      whereClause.routeId = routeId;
    }

    // Trouver les arrêts avec les retards moyens les plus élevés
    const worstStops = await prisma.stopMetric.findMany({
      where: whereClause,
      orderBy: {
        avgDelay: "desc",
      },
      take: limit,
      include: {
        route: {
          select: {
            shortName: true,
            longName: true,
            color: true,
          },
        },
        stop: {
          select: {
            name: true,
            code: true,
            lat: true,
            lon: true,
          },
        },
      },
    });

    // Formater les résultats pour l'API
    const formattedResults = worstStops.map((metric) => ({
      date: metric.date.toISOString().split("T")[0],
      avgDelay: metric.avgDelay,
      maxDelay: metric.maxDelay,
      observations: metric.observations,
      onTimeRate: metric.onTimeRate,
      lateRate: metric.lateRate,
      route: {
        id: metric.routeId,
        number: metric.route.shortName,
        name: metric.route.longName,
        color: metric.route.color ? `#${metric.route.color}` : null,
      },
      stop: {
        id: metric.stopId,
        name: metric.stop.name,
        code: metric.stop.code,
        location: {
          lat: metric.stop.lat,
          lon: metric.stop.lon,
        },
      },
    }));

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error("Erreur lors de la récupération des pires arrêts:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
