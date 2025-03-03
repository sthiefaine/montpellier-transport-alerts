import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active');
    const completed = searchParams.get('completed');
    const route = searchParams.get('route');
    const stop = searchParams.get('stop');

    let whereClause: any = {};
    const now = new Date();

    console.log('Date actuelle pour comparaison:', now.toISOString());
    console.log('Requête d\'alertes avec paramètres:', { active, completed, route, stop });

    // Filtre par statut actif
    if (active === 'true') {
      whereClause = {
        ...whereClause,
        timeStart: { lte: now },
        OR: [
          { timeEnd: { gte: now } },
          { timeEnd: null }
        ],
      };
    }

    // Filtre par statut terminé
    if (completed === 'true') {
      whereClause = {
        ...whereClause,
        AND: [
          { timeEnd: { not: null } },  // timeEnd doit exister
          { timeEnd: { lt: now } }     // timeEnd doit être dans le passé
        ]
      };
    }

    // Filtre par route
    if (route) {
      whereClause = {
        ...whereClause,
        routeIds: { contains: route },
      };
    }

    // Filtre par arrêt
    if (stop) {
      whereClause = {
        ...whereClause,
        stopIds: { contains: stop },
      };
    }

    console.log('Clause where Prisma:', JSON.stringify(whereClause, null, 2));

    // Récupérer toutes les alertes pour vérification
    if (active === 'true' || completed === 'true') {
      const allAlerts = await prisma.alert.findMany();
      console.log('Toutes les alertes dans la base:', allAlerts.length);
      
      // Vérifier les dates pour le débogage
      allAlerts.forEach(alert => {
        console.log(`Alerte ${alert.id}: timeStart=${alert.timeStart}, timeEnd=${alert.timeEnd}`);
      });
    }

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
          'Cache-Control': 'no-store, max-age=0'
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