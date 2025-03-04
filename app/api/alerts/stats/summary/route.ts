import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AlertEffect, AlertCause } from "@/lib/types";

const getEffectLabel = (effect: string): string => {
  const effectLabels: Record<string, string> = {
    [AlertEffect.NO_SERVICE]: "Service interrompu",
    [AlertEffect.REDUCED_SERVICE]: "Service réduit",
    [AlertEffect.SIGNIFICANT_DELAYS]: "Retards importants",
    [AlertEffect.DETOUR]: "Déviation",
    [AlertEffect.ADDITIONAL_SERVICE]: "Service supplémentaire",
    [AlertEffect.MODIFIED_SERVICE]: "Service modifié",
    [AlertEffect.OTHER_EFFECT]: "Autre effet",
    [AlertEffect.UNKNOWN_EFFECT]: "Effet inconnu",
    [AlertEffect.STOP_MOVED]: "Arrêt déplacé",
    [AlertEffect.NO_EFFECT]: "Aucun effet",
    [AlertEffect.ACCESSIBILITY_ISSUE]: "Problème d'accessibilité",
  };

  return effectLabels[effect] || effect;
};

const getCauseLabel = (cause: string): string => {
  const causeLabels: Record<string, string> = {
    [AlertCause.UNKNOWN_CAUSE]: "Cause inconnue",
    [AlertCause.OTHER_CAUSE]: "Autre cause",
    [AlertCause.TECHNICAL_PROBLEM]: "Problème technique",
    [AlertCause.STRIKE]: "Grève",
    [AlertCause.DEMONSTRATION]: "Manifestation",
    [AlertCause.ACCIDENT]: "Accident",
    [AlertCause.HOLIDAY]: "Événement festif",
    [AlertCause.WEATHER]: "Conditions météo",
    [AlertCause.MAINTENANCE]: "Maintenance",
    [AlertCause.CONSTRUCTION]: "Travaux",
    [AlertCause.POLICE_ACTIVITY]: "Activité policière",
    [AlertCause.MEDICAL_EMERGENCY]: "Urgence médicale",
  };

  return causeLabels[cause] || cause;
};

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const searchParams = request.nextUrl.searchParams;
    const includeAll = searchParams.get("includeAll") === "true";
    const includeComplements =
      searchParams.get("includeComplements") !== "false";

    const activeWhere = {
      timeStart: { lte: now },
      OR: [{ timeEnd: { gte: now } }, { timeEnd: null }],
    };

    const completedWhere = {
      timeEnd: { lt: now },
      NOT: { timeEnd: null },
    };

    if (!includeComplements) {
      (activeWhere as any).isComplement = false;
      (completedWhere as any).isComplement = false;
    }

    const activeCount = await prisma.alert.count({
      where: activeWhere,
    });

    const completedCount = await prisma.alert.count({
      where: completedWhere,
    });

    const totalWhere = includeComplements ? {} : { isComplement: false };
    const totalCount = await prisma.alert.count({
      where: totalWhere,
    });

    let effectCounts = [];
    if (includeAll) {
      const effectCountsRaw = await prisma.$queryRaw`
        SELECT "effect", COUNT(*) as count 
        FROM "Alert" 
        ${
          includeComplements
            ? Prisma.sql``
            : Prisma.sql`WHERE "isComplement" = false`
        }
        GROUP BY "effect"
        ORDER BY count DESC
      `;

      effectCounts = (effectCountsRaw as any[]).map((item) => ({
        effect: item.effect,
        effectLabel: getEffectLabel(item.effect),
        count: Number(item.count),
      }));
    } else {
      const effectCountsRaw = await prisma.$queryRaw`
        SELECT "effect", COUNT(*) as count 
        FROM "Alert" 
        WHERE "timeStart" <= ${now} AND ("timeEnd" >= ${now} OR "timeEnd" IS NULL)
        ${
          includeComplements
            ? Prisma.sql``
            : Prisma.sql`AND "isComplement" = false`
        }
        GROUP BY "effect"
        ORDER BY count DESC
      `;

      effectCounts = (effectCountsRaw as any[]).map((item) => ({
        effect: item.effect,
        effectLabel: getEffectLabel(item.effect),
        count: Number(item.count),
      }));
    }

    let causeCounts = [];
    if (includeAll) {
      const causeCountsRaw = await prisma.$queryRaw`
        SELECT "cause", COUNT(*) as count 
        FROM "Alert" 
        ${
          includeComplements
            ? Prisma.sql``
            : Prisma.sql`WHERE "isComplement" = false`
        }
        GROUP BY "cause"
        ORDER BY count DESC
      `;

      causeCounts = (causeCountsRaw as any[]).map((item) => ({
        cause: item.cause,
        causeLabel: getCauseLabel(item.cause),
        count: Number(item.count),
      }));
    } else {
      const causeCountsRaw = await prisma.$queryRaw`
        SELECT "cause", COUNT(*) as count 
        FROM "Alert" 
        WHERE "timeStart" <= ${now} AND ("timeEnd" >= ${now} OR "timeEnd" IS NULL)
        ${
          includeComplements
            ? Prisma.sql``
            : Prisma.sql`AND "isComplement" = false`
        }
        GROUP BY "cause"
        ORDER BY count DESC
      `;

      causeCounts = (causeCountsRaw as any[]).map((item) => ({
        cause: item.cause,
        causeLabel: getCauseLabel(item.cause),
        count: Number(item.count),
      }));
    }

    const alertsWhere = includeAll
      ? includeComplements
        ? {}
        : { isComplement: false }
      : {
          timeStart: { lte: now },
          OR: [{ timeEnd: { gte: now } }, { timeEnd: null }],
          ...(includeComplements ? {} : { isComplement: false }),
        };

    const alerts = await prisma.alert.findMany({
      where: alertsWhere,
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
        causeCounts,
        topRoutes,
        includesComplements: includeComplements,
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
