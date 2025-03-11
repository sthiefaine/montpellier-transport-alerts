// app/api/gtfs/stops/details/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const stopIds = url.searchParams.getAll("id");
    
    if (!stopIds || stopIds.length === 0) {
      return NextResponse.json(
        { error: "Aucun identifiant d'arrêt fourni" },
        { status: 400 }
      );
    }

    // Récupérer les détails de chaque arrêt demandé
    const stops = await prisma.stop.findMany({
      where: {
        id: {
          in: stopIds,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    return NextResponse.json(stops);
  } catch (error) {
    console.error("Erreur lors de la récupération des détails d'arrêts:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}