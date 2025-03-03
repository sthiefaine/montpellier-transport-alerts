import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const now = new Date();

    // Compter les alertes actives avec une requête SQL brute
    const activeCountResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM "Alert" 
      WHERE "timeStart" <= ${now} 
        AND ("timeEnd" >= ${now} OR "timeEnd" IS NULL)
    `;

    // Le résultat est un tableau avec un seul élément
    const activeCount = Number((activeCountResult as any)[0].count);

    // Compter les alertes par effet
    const effectCountsRaw = await prisma.$queryRaw`
      SELECT "effect", COUNT(*) as count 
      FROM "Alert" 
      WHERE "timeStart" <= ${now} 
        AND ("timeEnd" >= ${now} OR "timeEnd" IS NULL)
      GROUP BY "effect"
      ORDER BY count DESC
    `;

    // Convertir les BigInt en Number pour la sérialisation JSON
    const effectCounts = (effectCountsRaw as any[]).map((item) => ({
      effect: item.effect,
      count: Number(item.count),
    }));

    // Trouver les routes les plus affectées
    const topRoutesRaw = await prisma.$queryRaw`
      SELECT "routeIds", COUNT(*) as count 
      FROM "Alert" 
      WHERE "routeIds" IS NOT NULL 
        AND "routeIds" != '' 
        AND "timeStart" <= ${now} 
        AND ("timeEnd" >= ${now} OR "timeEnd" IS NULL)
      GROUP BY "routeIds" 
      ORDER BY count DESC 
      LIMIT 5
    `;

    // Convertir les BigInt en Number pour la sérialisation JSON
    const topRoutes = (topRoutesRaw as any[]).map((item) => ({
      routeIds: item.routeIds,
      count: Number(item.count),
    }));

    return NextResponse.json({
      activeCount,
      effectCounts,
      topRoutes,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }
}
