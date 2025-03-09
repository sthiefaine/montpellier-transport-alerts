// app/api/gtfs/delays/today/route.ts
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
    // Obtenir la date actuelle au format local
    const now = new Date();
    
    // Définir le début et la fin de la journée
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log(`Récupération des délais pour aujourd'hui: ${startOfDay.toISOString()} à ${endOfDay.toISOString()}`);

    // Calculer les statistiques de retard pour la journée actuelle
    const delayStats = await prisma.$queryRaw`
      SELECT 
        COALESCE(ROUND(AVG(delay)::numeric), 0) as avg_delay_seconds,
        COUNT(*) as total_observations,
        COALESCE(ROUND((COUNT(CASE WHEN delay BETWEEN -60 AND 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0) as punctuality_rate,
        COALESCE(ROUND((COUNT(CASE WHEN delay > 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0) as late_rate,
        COALESCE(ROUND((COUNT(CASE WHEN delay < -60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0) as early_rate,
        COALESCE(ROUND(MAX(delay)::numeric), 0) as max_delay_seconds,
        COALESCE(ROUND(AVG(CASE WHEN delay > 0 THEN delay ELSE NULL END)::numeric, 1), 0) as avg_positive_delay,
        COALESCE(ROUND(AVG(CASE WHEN delay < 0 THEN ABS(delay) ELSE NULL END)::numeric, 1), 0) as avg_early_seconds,
        COUNT(CASE WHEN delay > 0 THEN 1 END) as positive_delay_count,
        COUNT(CASE WHEN delay < 0 THEN 1 END) as negative_delay_count,
        COUNT(CASE WHEN delay = 0 THEN 1 END) as on_time_exact_count,
        COALESCE(ROUND((COUNT(CASE WHEN delay > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0)::text as positive_delay_percentage,
        COALESCE(ROUND((COUNT(CASE WHEN delay < 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0)::text as negative_delay_percentage,
        COALESCE(ROUND((COUNT(CASE WHEN delay = 0 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1), 0)::text as on_time_exact_percentage
      FROM "realtime_delays"
      WHERE "collected_at" BETWEEN ${startOfDay} AND ${endOfDay}
      AND "status" = 'SCHEDULED'
    `;

    if (Array.isArray(delayStats) && delayStats.length > 0) {
      // Nettoyer les données pour la réponse JSON
      const sanitizedData = sanitizeForJSON(delayStats[0]);
      
              // Ajouter l'horodatage de la dernière mise à jour et la date de début du calcul
      sanitizedData.last_updated = now.toISOString();
      sanitizedData.calculation_date = startOfDay.toISOString();
      
      return NextResponse.json(sanitizedData);
    } else {
      // Si aucune donnée, retourner un ensemble de valeurs par défaut
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
        last_updated: now.toISOString(),
        calculation_date: startOfDay.toISOString()
      });
    }
  } catch (error) {
    console.error("Erreur API delays/today:", error);

    // Ajouter des détails sur l'erreur pour faciliter le débogage
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