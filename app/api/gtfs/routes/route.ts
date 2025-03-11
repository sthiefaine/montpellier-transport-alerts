// app/api/gtfs/routes/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Récupérer toutes les routes actives
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        shortName: true,
        longName: true,
        color: true,
        type: true
      },
      where: {
        // Vous pouvez ajouter des conditions ici si nécessaire
        // Par exemple, pour exclure certains types de routes
        // type: { not: 7 } // 7 = Funicular
      },
      orderBy: [
        { type: 'asc' },
        { shortName: 'asc' }
      ],
    });

    // Transformer les données pour le format attendu par le frontend
    const formattedRoutes = routes.map(route => ({
      id: route.id,
      shortName: route.shortName || "",
      longName: route.longName || "",
      color: route.color ? `#${route.color}` : null,
      type: route.type
    }));

    return NextResponse.json(formattedRoutes);
  } catch (error) {
    console.error("Erreur lors de la récupération des routes:", error);
    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}