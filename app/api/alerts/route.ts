import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get('active');
    const route = searchParams.get('route');
    const stop = searchParams.get('stop');

    let whereClause: any = {};

    // Filtre par statut actif
    if (active === 'true') {
      const now = new Date();
      whereClause = {
        ...whereClause,
        timeStart: { lte: now },
        OR: [{ timeEnd: { gte: now } }, { timeEnd: null }],
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

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      orderBy: {
        timeStart: 'desc',
      },
    });

    return new Response(JSON.stringify(alerts));
  } catch (error) {
    console.error('Erreur lors de la récupération des alertes:', error);
    return new Response(
      JSON.stringify(
      { error: 'Erreur lors de la récupération des alertes' }),
      { status: 500 }
    );
  }
}