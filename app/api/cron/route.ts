import { NextRequest, NextResponse } from 'next/server';
import { fetchAndProcessAlerts } from '@/tasks/fetchAlerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Vérifier le secret pour s'assurer que l'appel est autorisé
    const authHeader = request.headers.get('authorization');
    
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    
    // Exécuter la tâche de récupération des alertes
    await fetchAndProcessAlerts();
    
    return NextResponse.json({ success: true, message: 'Alertes mises à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la tâche CRON:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des alertes' },
      { status: 500 }
    );
  }
}