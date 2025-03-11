// app/api/gtfs/stops/search/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get("q");
    
    if (!searchQuery || searchQuery.length < 2) {
      return NextResponse.json(
        { error: "Le terme de recherche doit contenir au moins 2 caractères" },
        { status: 400 }
      );
    }

    // Rechercher les arrêts qui correspondent à la requête
    const stops = await prisma.stop.findMany({
      where: {
        OR: [
          // Recherche par nom (insensible à la casse)
          {
            name: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
          // Recherche par code (si disponible)
          {
            code: {
              contains: searchQuery,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      take: 20, // Limiter les résultats
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(stops);
  } catch (error) {
    console.error("Erreur lors de la recherche d'arrêts:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}