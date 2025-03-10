// app/api/routes/grouped/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Fetch all routes from the database
    const routes = await prisma.route.findMany({
      select: {
        id: true,
        shortName: true,
        longName: true,
        color: true,
        type: true,
      },
      orderBy: {
        shortName: "asc",
      },
    });

    // Enrichir chaque route avec les informations de direction
    const enrichedRoutes = routes.map(route => {
      // Ajouter les directions à chaque route
      const directions = [
        {
          id: route.id,
          name: "Aller",
          directionId: 0
        },
        {
          id: route.id,
          name: "Retour",
          directionId: 1
        }
      ];

      // Créer un objet route enrichi
      return {
        id: route.id, // Conserver l'ID original de la route
        shortName: route.shortName,
        number: route.shortName,
        name: route.longName,
        longName: route.longName,
        color: route.color,
        type: route.type,
        routeId: route.id, // Utiliser l'ID de la route directement
        directions: directions // Ajouter les directions
      };
    });

    // Trier les routes par leur shortName (en numérique si possible)
    enrichedRoutes.sort((a, b) => {
      // Essayer de convertir shortName en nombres pour le tri numérique
      const aNum = parseInt(a.shortName);
      const bNum = parseInt(b.shortName);

      // Si les deux sont des nombres valides, trier numériquement
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }

      // Sinon, revenir à la comparaison de chaînes
      return a.shortName.localeCompare(b.shortName);
    });

    return NextResponse.json(enrichedRoutes);
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { error: "Failed to fetch routes" },
      { status: 500 }
    );
  }
}