// app/api/gtfs/metrics/daily/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fonction utilitaire pour convertir les BigInt en Number
function sanitizeForJSON(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForJSON(item));
  }

  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, sanitizeForJSON(value)])
    );
  }

  return obj;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const routeId = url.searchParams.get("routeId");
    const lastParam = url.searchParams.get("last");

    const whereClause: any = {};

    // Filtrer par date
    if (dateParam) {
      const date = new Date(dateParam);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Format de date invalide" },
          { status: 400 }
        );
      }
      whereClause.date = date;
    }

    // Filtrer par route
    if (routeId) {
      whereClause.routeId = routeId;
    }

    // Obtenir les N derniers jours
    if (lastParam && !dateParam) {
      const lastDays = parseInt(lastParam, 10);
      if (isNaN(lastDays) || lastDays <= 0) {
        return NextResponse.json(
          { error: "Paramètre 'last' invalide" },
          { status: 400 }
        );
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lastDays);

      whereClause.date = {
        gte: startDate,
      };
    }

    // Définir le tri à utiliser
    let orderBy: any;
    if (routeId) {
      // Si on filtre par ligne, trier par date uniquement
      orderBy = { date: "desc" };
    } else {
      // Sinon, trier par date puis par routeId
      // CORRECTION : Utiliser un tableau d'objets pour le tri multiple
      orderBy = [{ date: "desc" }, { routeId: "asc" }];
    }

    // Requête des métriques quotidiennes
    const metrics = await prisma.dailyMetric.findMany({
      where: whereClause,
      orderBy: orderBy,
      include: {
        route: {
          select: {
            shortName: true,
            longName: true,
            color: true,
          },
        },
      },
    });

    // Formater les résultats pour l'API
    const formattedResults = sanitizeForJSON(
      metrics.map((metric) => ({
        date: metric.date.toISOString().split("T")[0],
        routeId: metric.routeId,
        routeNumber: metric.route.shortName,
        routeName: metric.route.longName,
        color: metric.route.color ? `#${metric.route.color}` : null,
        metrics: {
          totalTrips: metric.totalTrips,
          totalStops: metric.totalStops,
          avgDelay: metric.avgDelay,
          maxDelay: metric.maxDelay,
          minDelay: metric.minDelay,
          onTimeRate: metric.onTimeRate60,
          lateRate: metric.lateRate60,
          earlyRate: metric.earlyRate60,
        },
      }))
    );

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des métriques quotidiennes:",
      error
    );
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
