import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const searchParams = request.nextUrl.searchParams;
    const includeAll = searchParams.get("includeAll") === "true";

    
    const activeCount = await prisma.alert.count({
      where: {
        timeStart: { lte: now },
        OR: [{ timeEnd: { gte: now } }, { timeEnd: null }],
      },
    });

    const completedCount = await prisma.alert.count({
      where: {
        timeEnd: { lt: now },
        NOT: { timeEnd: null },
      },
    });

    const totalCount = await prisma.alert.count();

    
    let effectCounts = [];
    if (includeAll) {
      const effectCountsRaw = await prisma.$queryRaw`
        SELECT "effect", COUNT(*) as count 
        FROM "Alert" 
        GROUP BY "effect"
        ORDER BY count DESC
      `;
      effectCounts = (effectCountsRaw as any[]).map((item) => ({
        effect: item.effect,
        count: Number(item.count),
      }));
    } else {
      const effectCountsRaw = await prisma.$queryRaw`
        SELECT "effect", COUNT(*) as count 
        FROM "Alert" 
        WHERE "timeStart" <= ${now} AND ("timeEnd" >= ${now} OR "timeEnd" IS NULL)
        GROUP BY "effect"
        ORDER BY count DESC
      `;
      effectCounts = (effectCountsRaw as any[]).map((item) => ({
        effect: item.effect,
        count: Number(item.count),
      }));
    }

    
    const alerts = await prisma.alert.findMany({
      where: includeAll
        ? {}
        : {
            timeStart: { lte: now },
            OR: [{ timeEnd: { gte: now } }, { timeEnd: null }],
          },
      select: {
        id: true,
        routeIds: true,
        
        
      },
    });

    console.log(`Total d'alertes récupérées: ${alerts.length}`);

    
    const extractRoutes = (routeIdsStr: string | null): string[] => {
      if (!routeIdsStr) return [];

      
      return routeIdsStr
        .split(/[,;|]/) 
        .map((route) => route.trim())
        .filter((route) => route.length > 0);
    };

    
    const routeCounts: Record<string, number> = {};

    alerts.forEach((alert) => {
      
      if (alert.routeIds) {
        const routes = extractRoutes(alert.routeIds);
        routes.forEach((route) => {
          routeCounts[route] = (routeCounts[route] || 0) + 1;
        });
      }

      
      
    });

    console.log(
      `Nombre total de routes différentes trouvées: ${
        Object.keys(routeCounts).length
      }`
    );

    
    const topRoutes = Object.entries(routeCounts)
      .map(([routeId, count]) => ({
        routeIds: routeId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return new Response(
      JSON.stringify({
        activeCount,
        completedCount,
        totalCount,
        effectCounts,
        topRoutes,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);

    return new Response(
      JSON.stringify({
        error: "Erreur lors de la récupération des statistiques",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
