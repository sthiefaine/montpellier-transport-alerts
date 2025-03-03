import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Fonction modifiée pour récupérer et analyser correctement les routes
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const searchParams = request.nextUrl.searchParams;
    const includeAll = searchParams.get("includeAll") === "true";

    // Compter les alertes actives, terminées et totales (inchangé)
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

    // Récupérer les décomptes d'effets (inchangé)
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

    // Récupérer toutes les alertes sans filtrer par routeIds
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
        // Ajoutez ici d'autres champs potentiels contenant des informations de route
        // basé sur vos découvertes des requêtes de diagnostic
      },
    });

    console.log(`Total d'alertes récupérées: ${alerts.length}`);

    // Fonction auxiliaire pour traiter les routeIds
    const extractRoutes = (routeIdsStr: string | null): string[] => {
      if (!routeIdsStr) return [];

      // Nettoyage et normalisation - adaptez selon le format réel de vos données
      return routeIdsStr
        .split(/[,;|]/) // Séparateurs possibles: virgule, point-virgule ou barre verticale
        .map((route) => route.trim())
        .filter((route) => route.length > 0);
    };

    // Analyser les routes de toutes les alertes
    const routeCounts: Record<string, number> = {};

    alerts.forEach((alert) => {
      // Si routeIds est une chaîne non vide
      if (alert.routeIds) {
        const routes = extractRoutes(alert.routeIds);
        routes.forEach((route) => {
          routeCounts[route] = (routeCounts[route] || 0) + 1;
        });
      }

      // Vérifiez ici d'autres champs potentiels contenant des informations de route
      // en fonction de vos découvertes
    });

    console.log(
      `Nombre total de routes différentes trouvées: ${
        Object.keys(routeCounts).length
      }`
    );

    // Convertir en tableau et trier
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
