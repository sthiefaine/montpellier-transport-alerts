import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface RawRouteDelay {
  route_number: string | null;
  route_name: string | null;
  avg_delay_seconds: number | { d: number[]; e: number; s: number };
  observations: number | bigint;
  punctuality_percentage: number | { d: number[]; e: number; s: number };
  color: string | null;
}

export async function GET() {
  try {
    const routeDelays: RawRouteDelay[] = await prisma.$queryRaw`
      SELECT 
        r."route_short_name" as route_number,
        r."route_long_name" as route_name,
        ROUND(AVG(rd.delay)::numeric, 1) as avg_delay_seconds,
        COUNT(*)::integer as observations,
        ROUND((COUNT(CASE WHEN rd.delay BETWEEN -60 AND 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) as punctuality_percentage,
        '#' || r.route_color as color
      FROM "realtime_delays" rd
      JOIN "routes" r ON rd."route_id" = r."route_id"
      WHERE rd."collected_at" > NOW() - INTERVAL '7 days'  -- Augmenter la plage à 7 jours
      AND rd."status" = 'SCHEDULED'
      GROUP BY r."route_id", r."route_short_name", r."route_long_name", r.route_color
      ORDER BY observations DESC  -- Trier par nombre d'observations pour voir les lignes les plus actives
    `;

    // Ajouter un log pour voir les données brutes
    console.log("Nombre de routes récupérées:", routeDelays.length);

    // Version améliorée du sanitizer spécifique à cette structure de données
    const formattedResults = routeDelays.map((item) => ({
      route_number: String(item.route_number || ""),
      route_name: String(item.route_name || ""),
      color: String(item.color || "#ccc"),
      avg_delay_seconds:
        typeof item.avg_delay_seconds === "object" && item.avg_delay_seconds.d
          ? Number(
              item.avg_delay_seconds.d[0] /
                Math.pow(10, item.avg_delay_seconds.e)
            )
          : Number(item.avg_delay_seconds || 0),
      punctuality_percentage:
        typeof item.punctuality_percentage === "object" &&
        item.punctuality_percentage.d
          ? Number(
              item.punctuality_percentage.d[0] /
                Math.pow(10, item.punctuality_percentage.e)
            )
          : Number(item.punctuality_percentage || 0),
      observations: Number(item.observations || 0),
    }));

    console.log("Données formatées - premier élément:", formattedResults[0]);

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error("Erreur API by-route:", error);
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
