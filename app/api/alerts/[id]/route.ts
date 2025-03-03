import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID d\'alerte manquant' },
        { status: 400 }
      );
    }

    const alert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alerte non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'alerte ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'alerte' },
      { status: 500 }
    );
  }
}