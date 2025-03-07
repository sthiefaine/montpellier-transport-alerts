// app/api/gtfs/metrics/compute-missing/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();
const CRON_SECRET = process.env.CRON_SECRET;
const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
import { GET as computeHourly } from "../compute-hourly/route";

function validateAuth(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.substring(7);
  return token === CRON_SECRET;
}

export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");
    const baseUrl = url.origin;

    // Déterminer la date (hier par défaut)
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
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate());
    }

    const dateString = targetDate.toISOString().split("T")[0];
    console.log(`Vérification des données manquantes pour ${dateString}`);

    // Vérifier les heures existantes
    const existingHours = await prisma.hourlyMetric.groupBy({
      by: ["hour"],
      where: {
        date: targetDate,
      },
    });

    // Créer un ensemble des heures existantes
    const existingHoursSet = new Set(existingHours.map((item) => item.hour));

    // Déterminer les heures manquantes (de 6h à 23h pour couvrir les heures de service habituelles)
    const missingHours = [];
    for (let hour = 6; hour <= 23; hour++) {
      if (!existingHoursSet.has(hour)) {
        missingHours.push(hour);
      }
    }

    if (missingHours.length === 0) {
      return NextResponse.json({
        message: `Aucune heure manquante trouvée pour ${dateString}`,
      });
    }

    console.log(`Heures manquantes trouvées: ${missingHours.join(", ")}`);

    // Récupérer le CRON_SECRET pour l'utiliser dans les appels API
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        {
          error:
            "CRON_SECRET non défini, impossible de calculer les métriques manquantes",
        },
        { status: 500 }
      );
    }

    // Calculer les métriques pour chaque heure manquante
    const results = [];
    for (const hour of missingHours) {
      try {
        console.log(`Calcul des métriques pour ${dateString}, heure ${hour}`);

        // Appeler l'endpoint de calcul des métriques horaires
        const response = await computeHourly(
          new Request(
            `http://localhost:3000/api/gtfs/metrics/compute-hourly?date=${dateString}&hour=${hour}`,
            {
              headers: {
                Authorization: `Bearer ${cronSecret}`,
              },
            }
          )
        );

        const responseData = await response.json();

        results.push({
          hour,
          status: "success",
          processed: responseData.processed,
        });
      } catch (error) {
        console.error(`Erreur lors du calcul pour l'heure ${hour}:`, error);
        results.push({
          hour,
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      date: dateString,
      missingHours,
      results,
    });
  } catch (error) {
    console.error(
      "Erreur lors de la vérification des heures manquantes:",
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
