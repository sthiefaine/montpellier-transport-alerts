import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active');
    const completed = searchParams.get('completed');
    const route = searchParams.get('route');
    const stop = searchParams.get('stop');
    const timeFrame = searchParams.get('timeFrame');

    let whereClause: any = {};
    const now = new Date();

    console.log('Date actuelle pour comparaison:', now.toISOString());
    console.log('Requête d\'alertes avec paramètres:', { active, completed, route, stop, timeFrame });

    // Filter by status
    if (active === 'true') {
      whereClause = {
        ...whereClause,
        timeStart: { lte: now },
        OR: [
          { timeEnd: { gte: now } },
          { timeEnd: null }
        ],
      };
    } else if (completed === 'true') {
      whereClause = {
        ...whereClause,
        AND: [
          { timeEnd: { not: null } },  
          { timeEnd: { lt: now } }     
        ]
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
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      if (timeFrame === 'today') {
        whereClause.timeStart = { gte: startOfDay };
      } else if (timeFrame === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startOfWeek.setHours(0, 0, 0, 0);
        whereClause.timeStart = { gte: startOfWeek };
      } else if (timeFrame === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        whereClause.timeStart = { gte: startOfMonth };
      }
    }

    console.log('Clause where Prisma:', JSON.stringify(whereClause, null, 2));

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      orderBy: {
        timeStart: 'desc',
      },
    });

    console.log(`Alertes trouvées: ${alerts.length}`);

    return new Response(
      JSON.stringify(alerts),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // 5 minutes cache for ISR
        }
      }
    );
  } catch (error) {
    console.error('Erreur lors de la récupération des alertes:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de la récupération des alertes',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );
  }
}