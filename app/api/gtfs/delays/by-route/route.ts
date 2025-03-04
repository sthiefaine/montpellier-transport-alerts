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

export async function GET() {
  try {
    const routeDelays = await prisma.$queryRaw`
      SELECT 
        r."route_short_name" as route_number,
        r."route_long_name" as route_name,
        ROUND(AVG(rd.delay)::numeric, 1) as avg_delay_seconds,
        COUNT(*)::integer as observations,
        ROUND((COUNT(CASE WHEN rd.delay BETWEEN -60 AND 60 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 1) as punctuality_percentage,
        '#' || r.route_color as color
      FROM "realtime_delays" rd
      JOIN "routes" r ON rd."route_id" = r."route_id"
      WHERE rd."collected_at" > NOW() - INTERVAL '24 hours'
      AND rd."status" = 'SCHEDULED'
      GROUP BY r."route_id", r."route_short_name", r."route_long_name", r.route_color
      ORDER BY avg_delay_seconds DESC
    `;

    // Sanitiser les résultats pour convertir les BigInt en Number
    const sanitizedResults = sanitizeForJSON(routeDelays);

    return NextResponse.json(sanitizedResults);
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
