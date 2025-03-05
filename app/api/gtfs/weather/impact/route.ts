// app/api/gtfs/weather/impact/route.ts
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

// API pour consulter l'impact de la météo sur les performances
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const routeId = url.searchParams.get("routeId");
    const dateParam = url.searchParams.get("date");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");
    const periodParam = url.searchParams.get("period") || "day"; // day, hour
    const minImpactParam = url.searchParams.get("minImpact") || "0.3"; // Filtre de seuil d'impact minimal

    // Validation des paramètres
    const minImpact = parseFloat(minImpactParam);
    if (isNaN(minImpact) || minImpact < 0 || minImpact > 1) {
      return NextResponse.json(
        { error: "Paramètre 'minImpact' invalide. Doit être entre 0 et 1." },
        { status: 400 }
      );
    }

    // Construire la clause where pour les dates
    const whereClause: any = {};

    if (dateParam) {
      // Date spécifique
      const date = new Date(dateParam);
      if (isNaN(date.getTime())) {
        return NextResponse.json(
          { error: "Format de date invalide" },
          { status: 400 }
        );
      }

      if (periodParam === "day") {
        whereClause.dailyMetric = {
          date: date,
        };

        if (routeId) {
          whereClause.dailyMetric.routeId = routeId;
        }
      } else {
        whereClause.hourlyMetric = {
          date: date,
        };

        if (routeId) {
          whereClause.hourlyMetric.routeId = routeId;
        }
      }
    } else if (startDateParam && endDateParam) {
      // Plage de dates
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: "Format de date invalide" },
          { status: 400 }
        );
      }

      if (periodParam === "day") {
        whereClause.dailyMetric = {
          date: {
            gte: startDate,
            lte: endDate,
          },
        };

        if (routeId) {
          whereClause.dailyMetric.routeId = routeId;
        }
      } else {
        whereClause.hourlyMetric = {
          date: {
            gte: startDate,
            lte: endDate,
          },
        };

        if (routeId) {
          whereClause.hourlyMetric.routeId = routeId;
        }
      }
    } else {
      // Par défaut, utiliser les 7 derniers jours
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      if (periodParam === "day") {
        whereClause.dailyMetric = {
          date: {
            gte: startDate,
            lte: endDate,
          },
        };

        if (routeId) {
          whereClause.dailyMetric.routeId = routeId;
        }
      } else {
        whereClause.hourlyMetric = {
          date: {
            gte: startDate,
            lte: endDate,
          },
        };

        if (routeId) {
          whereClause.hourlyMetric.routeId = routeId;
        }
      }
    }

    // Ajouter le filtre d'impact minimal
    whereClause.impactScore = {
      gte: minImpact,
    };

    // Récupérer les données selon la période demandée
    let weatherImpacts;

    if (periodParam === "day") {
      // Impacts quotidiens
      weatherImpacts = await prisma.dailyWeatherImpact.findMany({
        where: whereClause,
        include: {
          dailyMetric: {
            include: {
              route: {
                select: {
                  shortName: true,
                  longName: true,
                  color: true,
                },
              },
            },
          },
          weather: true,
        },
        orderBy: [{ impactScore: "desc" }, { dailyMetric: { date: "desc" } }],
      });

      // Formater les résultats
      const formattedResults = sanitizeForJSON(
        weatherImpacts.map((impact) => ({
          date: impact.dailyMetric.date.toISOString().split("T")[0],
          route: {
            id: impact.dailyMetric.routeId,
            number: impact.dailyMetric.route.shortName,
            name: impact.dailyMetric.route.longName,
            color: impact.dailyMetric.route.color
              ? `#${impact.dailyMetric.route.color}`
              : null,
          },
          metrics: {
            avgDelay: impact.dailyMetric.avgDelay,
            onTimeRate: impact.dailyMetric.onTimeRate60,
            lateRate: impact.dailyMetric.lateRate60,
          },
          weather: {
            location: impact.weather.location,
            condition: impact.weather.weatherType,
            temperature: impact.weather.temperature,
            precipitation: impact.weather.precipitation,
            windSpeed: impact.weather.windSpeed,
            isRain: impact.weather.isRain,
            isSnow: impact.weather.isSnow,
            isFog: impact.weather.isFog,
            isStorm: impact.weather.isStorm,
          },
          impact: {
            score: impact.impactScore,
            category: impact.impactScore
              ? categorizeImpact(impact.impactScore)
              : null,
            description: impact.impactScore
              ? describeWeatherImpact(impact.weather, impact.impactScore)
              : null,
          },
        }))
      );
      return NextResponse.json({
        period: "day",
        impacts: formattedResults,
      });
    } else {
      // Impacts horaires
      weatherImpacts = await prisma.hourlyWeatherImpact.findMany({
        where: whereClause,
        include: {
          hourlyMetric: {
            include: {
              route: {
                select: {
                  shortName: true,
                  longName: true,
                  color: true,
                },
              },
            },
          },
          weather: true,
        },
        orderBy: [
          { impactScore: "desc" },
          { hourlyMetric: { date: "desc" } },
          { hourlyMetric: { hour: "asc" } },
        ],
      });

      // Formater les résultats
      const formattedResults = sanitizeForJSON(
        weatherImpacts.map((impact) => ({
          date: impact.hourlyMetric.date.toISOString().split("T")[0],
          hour: impact.hourlyMetric.hour,
          route: {
            id: impact.hourlyMetric.routeId,
            number: impact.hourlyMetric.route.shortName,
            name: impact.hourlyMetric.route.longName,
            color: impact.hourlyMetric.route.color
              ? `#${impact.hourlyMetric.route.color}`
              : null,
          },
          metrics: {
            avgDelay: impact.hourlyMetric.avgDelay,
            onTimeRate: impact.hourlyMetric.onTimeRate60,
            lateRate: impact.hourlyMetric.lateRate60,
            observations: impact.hourlyMetric.observations,
          },
          weather: {
            location: impact.weather.location,
            condition: impact.weather.weatherType,
            temperature: impact.weather.temperature,
            precipitation: impact.weather.precipitation,
            windSpeed: impact.weather.windSpeed,
            isRain: impact.weather.isRain,
            isSnow: impact.weather.isSnow,
            isFog: impact.weather.isFog,
            isStorm: impact.weather.isStorm,
          },
          impact: {
            score: impact.impactScore,
            category: impact.impactScore
              ? categorizeImpact(impact.impactScore)
              : "Inconnu",
            description: impact.impactScore
              ? describeWeatherImpact(impact.weather, impact.impactScore)
              : "Description inconnue",
          },
        }))
      );

      return NextResponse.json({
        period: "hour",
        impacts: formattedResults,
      });
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des impacts météo:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Catégoriser l'impact météo
function categorizeImpact(impactScore: number): string {
  if (impactScore >= 0.8) return "Critique";
  if (impactScore >= 0.6) return "Élevé";
  if (impactScore >= 0.4) return "Modéré";
  if (impactScore >= 0.2) return "Faible";
  return "Négligeable";
}

// Générer une description de l'impact météo
function describeWeatherImpact(weather: any, impactScore: number): string {
  // Construire une description basée sur les conditions météo et le score d'impact

  const conditions = [];

  if (weather.isSnow) conditions.push("neige");
  if (weather.isRain && weather.precipitation > 5)
    conditions.push("fortes pluies");
  else if (weather.isRain) conditions.push("pluie");
  if (weather.isFog) conditions.push("brouillard");
  if (weather.isStorm) conditions.push("orage");
  if (weather.windSpeed > 30) conditions.push("vents forts");
  if (weather.temperature < 0) conditions.push("gel");
  if (weather.temperature > 30) conditions.push("forte chaleur");

  if (conditions.length === 0) {
    if (impactScore > 0.3) {
      return `Conditions météorologiques variables ayant un impact ${categorizeImpact(
        impactScore
      ).toLowerCase()} sur les performances.`;
    } else {
      return "Conditions météorologiques sans impact significatif sur les performances.";
    }
  }

  // Joindre les conditions avec une virgule, et "et" pour la dernière
  let conditionText = "";
  if (conditions.length === 1) {
    conditionText = conditions[0];
  } else if (conditions.length === 2) {
    conditionText = `${conditions[0]} et ${conditions[1]}`;
  } else {
    conditionText =
      conditions.slice(0, -1).join(", ") +
      " et " +
      conditions[conditions.length - 1];
  }

  // Générer la description complète
  if (impactScore >= 0.6) {
    return `${
      conditionText.charAt(0).toUpperCase() + conditionText.slice(1)
    } causant des perturbations significatives sur le réseau.`;
  } else if (impactScore >= 0.3) {
    return `${
      conditionText.charAt(0).toUpperCase() + conditionText.slice(1)
    } ralentissant modérément le service.`;
  } else {
    return `${
      conditionText.charAt(0).toUpperCase() + conditionText.slice(1)
    } avec impact limité sur le service.`;
  }
}
