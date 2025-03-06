// app/api/gtfs/cleanup-realtime/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Token de sécurité
const CLEANUP_TOKEN = process.env.CRON_SECRET;

// Fonction pour vérifier l'authentification
function validateAuth(request: Request) {
  // Vérifier l'en-tête d'autorisation
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7); // Extraire le token après "Bearer "
  return token === CLEANUP_TOKEN;
}

// Gérer les requêtes GET (pour les cron jobs Vercel)
export async function GET(request: Request) {
  try {
    // Vérifier l'authentification
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    return await cleanupRealtimeData();
  } catch (error) {
    console.error("Erreur lors du nettoyage des données temps réel:", error);
    return NextResponse.json(
      {
        error: "Erreur lors du nettoyage des données temps réel",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Fonction pour nettoyer les données temps réel
async function cleanupRealtimeData() {
  console.log("Nettoyage des données temps réel:", new Date().toISOString());

  try {
    // Calculer la date limite (minuit du jour actuel)
    const now = new Date();
    const todayMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0
    );

    console.log(`Date limite de conservation: ${todayMidnight.toISOString()}`);

    // Supprimer toutes les données collectées avant minuit aujourd'hui
    const deleteResult = await prisma.realtimeDelay.deleteMany({
      where: {
        collectedAt: {
          lt: todayMidnight,
        },
      },
    });

    console.log(
      `Nettoyé ${deleteResult.count} enregistrements de données temps réel`
    );

    return NextResponse.json({
      status: "success",
      message: "Nettoyage terminé",
      cleaned: deleteResult.count,
    });
  } catch (error) {
    console.error("Erreur lors du nettoyage:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
    }
    throw error;
  }
}
