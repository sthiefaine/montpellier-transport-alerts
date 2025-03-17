import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get("active");
    const completed = searchParams.get("completed");
    const upcoming = searchParams.get("upcoming");
    const route = searchParams.get("route");
    const stop = searchParams.get("stop");
    const timeFrame = searchParams.get("timeFrame");

    let whereClause: any = {};

    // Utiliser explicitement le fuseau horaire de Paris
    const now = new Date();
    const nowLocal = new Date(
      now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
    );
    console.log("Date actuelle (Paris):", nowLocal.toISOString());

    // Filter by status
    if (active === "true") {
      whereClause = {
        ...whereClause,
        timeStart: { lte: nowLocal },
        OR: [{ timeEnd: { gte: nowLocal } }, { timeEnd: null }],
      };
    } else if (completed === "true") {
      const endOfToday = new Date(nowLocal);
      endOfToday.setHours(23, 59, 59, 999);

      whereClause = {
        ...whereClause,
        timeEnd: {
          not: null,
          lt: endOfToday,
        },
      };
    } else if (upcoming === "true") {
      whereClause = {
        ...whereClause,
        timeStart: { gt: nowLocal },
      };
    }

    // Filter by route
    if (route) {
      whereClause = {
        ...whereClause,
        routeIds: { contains: route },
      };
    }

    // Filter by stop
    if (stop) {
      whereClause = {
        ...whereClause,
        stopIds: { contains: stop },
      };
    }

    // Filter by time frame
    if (timeFrame) {
      if (timeFrame === "today") {
        const startOfToday = new Date(nowLocal);
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date(nowLocal);
        endOfToday.setHours(23, 59, 59, 999);

        console.log("Début aujourd'hui:", startOfToday.toISOString());
        console.log("Fin aujourd'hui:", endOfToday.toISOString());

        if (completed === "true") {
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            timeEnd: { gte: startOfToday, lte: endOfToday },
          });
        } else {
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            OR: [
              { timeStart: { gte: startOfToday, lte: endOfToday } },
              {
                AND: [
                  { timeStart: { lt: startOfToday } },
                  {
                    OR: [{ timeEnd: { gte: startOfToday } }, { timeEnd: null }],
                  },
                ],
              },
            ],
          });
        }
      } else if (timeFrame === "yesterday") {
        const startOfYesterday = new Date(nowLocal);
        startOfYesterday.setDate(nowLocal.getDate() - 1);
        startOfYesterday.setHours(0, 0, 0, 0);

        const endOfYesterday = new Date(nowLocal);
        endOfYesterday.setDate(nowLocal.getDate() - 1);
        endOfYesterday.setHours(23, 59, 59, 999);

        console.log("Début hier:", startOfYesterday.toISOString());
        console.log("Fin hier:", endOfYesterday.toISOString());

        if (completed === "true") {
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            timeEnd: { gte: startOfYesterday, lte: endOfYesterday },
          });
        } else {
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            OR: [
              { timeStart: { gte: startOfYesterday, lte: endOfYesterday } },
              {
                AND: [
                  { timeStart: { lt: startOfYesterday } },
                  { timeEnd: { gte: startOfYesterday, lte: endOfYesterday } },
                ],
              },
            ],
          });
        }
      } else if (timeFrame === "week") {
        const startOfWeek = new Date(nowLocal);
        const daysToSubtract =
          nowLocal.getDay() === 0 ? 6 : nowLocal.getDay() - 1;
        startOfWeek.setDate(nowLocal.getDate() - daysToSubtract);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        console.log("Début de semaine:", startOfWeek.toISOString());
        console.log("Fin de semaine:", endOfWeek.toISOString());

        if (completed === "true") {
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            timeEnd: { gte: startOfWeek, lte: endOfWeek },
          });
        } else {
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            OR: [
              { timeStart: { gte: startOfWeek, lte: endOfWeek } },
              {
                AND: [
                  { timeStart: { lt: startOfWeek } },
                  {
                    OR: [
                      { timeEnd: { gte: startOfWeek, lte: endOfWeek } },
                      { timeEnd: null },
                    ],
                  },
                ],
              },
            ],
          });
        }
      } else if (timeFrame === "month") {
        const startOfMonth = new Date(
          nowLocal.getFullYear(),
          nowLocal.getMonth(),
          1
        );
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(
          nowLocal.getFullYear(),
          nowLocal.getMonth() + 1,
          0
        );
        endOfMonth.setHours(23, 59, 59, 999);

        console.log("Début du mois:", startOfMonth.toISOString());
        console.log("Fin du mois:", endOfMonth.toISOString());

        if (completed === "true") {
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            timeEnd: { gte: startOfMonth, lte: endOfMonth },
          });
        } else {
          whereClause.AND = whereClause.AND || [];
          whereClause.AND.push({
            OR: [
              { timeStart: { gte: startOfMonth, lte: endOfMonth } },
              {
                AND: [
                  { timeStart: { lt: startOfMonth } },
                  {
                    OR: [
                      { timeEnd: { gte: startOfMonth, lte: endOfMonth } },
                      { timeEnd: null },
                    ],
                  },
                ],
              },
            ],
          });
        }
      }
    }

    console.log("Clause where Prisma:", JSON.stringify(whereClause, null, 2));

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      orderBy: {
        timeStart: "desc",
      },
    });

    console.log(`Alertes trouvées: ${alerts.length}`);

    return new Response(JSON.stringify(alerts), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // 5 minutes cache for ISR
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes:", error);
    return new Response(
      JSON.stringify({
        error: "Erreur lors de la récupération des alertes",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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
