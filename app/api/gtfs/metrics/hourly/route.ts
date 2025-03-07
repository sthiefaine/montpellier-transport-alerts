// app/api/gtfs/metrics/hourly/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const routeId = url.searchParams.get("routeId");

    // Déterminer la date (hier par défaut)
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      console.log('date', dateParam)
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

    // Récupérer les métriques horaires
    const hourlyMetrics = await prisma.hourlyMetric.findMany({
      where: whereClause,
      orderBy: [{ routeId: "asc" }, { hour: "asc" }],
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

    // Si aucune donnée trouvée
    if (hourlyMetrics.length === 0) {
      return NextResponse.json(
        { message: "Aucune métrique horaire trouvée pour cette date" },
        { status: 404 }
      );
    }

    // Si on demande une ligne spécifique, retourner les données par heure
    if (routeId) {
      // Formater les résultats pour l'API
      const route = hourlyMetrics[0].route;
      const formattedResults = {
        date: targetDate.toISOString().split("T")[0],
        route: {
          id: routeId,
          number: route.shortName,
          name: route.longName,
          color: route.color ? `#${route.color}` : null,
        },
        hourlyData: hourlyMetrics.map((metric) => ({
          hour: metric.hour,
          avgDelay: metric.avgDelay,
          maxDelay: metric.maxDelay,
          minDelay: metric.minDelay,
          observations: metric.observations,
          onTimeRate: metric.onTimeRate60,
          lateRate: metric.lateRate60,
          earlyRate: metric.earlyRate60,
        })),
      };

      return NextResponse.json(formattedResults);
    }
    // Sinon, regrouper par ligne
    else {
      // Regrouper par ligne
      const routeGroups: { [key: string]: any } = {};

      hourlyMetrics.forEach((metric) => {
        if (!routeGroups[metric.routeId]) {
          routeGroups[metric.routeId] = {
            routeId: metric.routeId,
            routeNumber: metric.route.shortName,
            routeName: metric.route.longName,
            color: metric.route.color ? `#${metric.route.color}` : null,
            hourlyData: [],
          };
        }

        routeGroups[metric.routeId].hourlyData.push({
          hour: metric.hour,
          avgDelay: metric.avgDelay,
          maxDelay: metric.maxDelay,
          minDelay: metric.minDelay,
          observations: metric.observations,
          onTimeRate: metric.onTimeRate60,
          lateRate: metric.lateRate60,
          earlyRate: metric.earlyRate60,
        });
      });

      // Convertir l'objet en tableau
      const formattedResults = {
        date: targetDate.toISOString().split("T")[0],
        routes: Object.values(routeGroups),
      };

      return NextResponse.json(formattedResults);
    }
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des métriques horaires:",
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
