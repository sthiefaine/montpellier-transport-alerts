// app/api/gtfs/delays/enhanced-summary/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fonction utilitaire pour convertir les BigInt en Number
function sanitizeForJSON(obj: any) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      // Si la valeur est un BigInt, la convertir en Number
      if (typeof value === "bigint") {
        return [key, Number(value)];
      }
      // Si la valeur est null, la garder comme null
      if (value === null) {
        return [key, null];
      }
      // Sinon, la retourner telle quelle
      return [key, value];
    })
  );
}

export async function GET() {
  try {
    // Calculer les statistiques pour les 24 dernières heures
    const delayStats = await prisma.$queryRaw`
      SELECT 
        COALESCE(ROUND(AVG(delay)::numeric, 1), 0) as avg_delay_seconds,
        COUNT(*) as total_observations,
        COALESCE(ROUND((COUNT(CASE WHEN delay BETWEEN -60 AND 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0) as punctuality_rate,
        COALESCE(ROUND((COUNT(CASE WHEN delay > 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0) as late_rate,
        COALESCE(ROUND((COUNT(CASE WHEN delay < -60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0) as early_rate,
        COALESCE(ROUND(MAX(delay)::numeric), 0) as max_delay_seconds,
        
        -- Nouvelles métriques pour séparer retards et avances
        COALESCE(ROUND(AVG(CASE WHEN delay > 0 THEN delay END)::numeric, 1), 0) as avg_positive_delay,
        COALESCE(ROUND(AVG(CASE WHEN delay < 0 THEN ABS(delay) END)::numeric, 1), 0) as avg_early_seconds,
        COUNT(CASE WHEN delay > 0 THEN 1 END) as positive_delay_count,
        COUNT(CASE WHEN delay < 0 THEN 1 END) as negative_delay_count,
        COUNT(CASE WHEN delay = 0 THEN 1 END) as on_time_exact_count
      FROM "realtime_delays"
      WHERE "collected_at" > NOW() - INTERVAL '24 hours'
      AND "status" = 'SCHEDULED'
    `;

    if (Array.isArray(delayStats) && delayStats.length > 0) {
      // Sanitize pour éviter les problèmes de BigInt
      const sanitizedData = sanitizeForJSON(delayStats[0]);

      // Ajouter des pourcentages pour faciliter l'affichage
      sanitizedData.positive_delay_percentage = (
        (Number(sanitizedData.positive_delay_count) /
        Number(sanitizedData.total_observations)) *
        100
      ).toFixed(1);
      sanitizedData.negative_delay_percentage = (
        (Number(sanitizedData.negative_delay_count) /
        Number(sanitizedData.total_observations)) *
        100
      ).toFixed(1);
      sanitizedData.on_time_exact_percentage = (
        (Number(sanitizedData.on_time_exact_count) /
        Number(sanitizedData.total_observations)) *
        100
      ).toFixed(1);

      return NextResponse.json(sanitizedData);
    } else {
      // Si aucune donnée, retourner des valeurs par défaut
      return NextResponse.json({
        avg_delay_seconds: 0,
        total_observations: 0,
        punctuality_rate: 0,
        late_rate: 0,
        early_rate: 0,
        max_delay_seconds: 0,
        avg_positive_delay: 0,
        avg_early_seconds: 0,
        positive_delay_count: 0,
        negative_delay_count: 0,
        on_time_exact_count: 0,
        positive_delay_percentage: "0.0",
        negative_delay_percentage: "0.0",
        on_time_exact_percentage: "0.0",
      });
    }
  } catch (error) {
    console.error("Erreur API enhanced-summary:", error);

    if (error instanceof Error) {
      console.error("Message d'erreur:", error.message);
      console.error("Stack trace:", error.stack);
    }

    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
