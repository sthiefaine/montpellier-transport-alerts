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

    // Group routes by shortName to handle different directions
    const groupedRoutes = [];
    const routeGroups = new Map();

    // First, group all routes by their short name (like "1", "2", etc.)
    routes.forEach((route) => {
      // For route IDs like "7-1" or "8-1", extract the actual line number
      const shortName = route.shortName;

      if (!routeGroups.has(shortName)) {
        routeGroups.set(shortName, []);
      }

      routeGroups.get(shortName).push(route);
    });

    // Then, create a structured representation with directions
    for (const [shortName, routesList] of routeGroups.entries()) {
      if (routesList.length > 0) {
        // Use the first route's data for the main info
        const mainRoute = routesList[0];

        const groupedRoute = {
          id: `LINE-${shortName}`, // Create a unique ID for the grouped route
          number: shortName,
          name: mainRoute.longName,
          color: mainRoute.color,
          type: mainRoute.type,
          directions: routesList.map((r: { id: string; longName: string }) => {
            // Essayer de déterminer la direction - dans une application réelle, vous pourriez avoir de meilleures données
            // Pour cet exemple, nous allons l'inférer à partir du modèle d'ID de la route
            const directionId = r.id.startsWith("7-") ? 0 : 1;

            // Try to extract a direction name from the long name or use a default
            const directionParts = r.longName.split(" - ");
            const directionName =
              directionId === 0
                ? `Direction ${directionParts[directionParts.length - 1]}`
                : `Direction ${directionParts[0]}`;

            return {
              id: r.id,
              name: directionName,
              directionId: directionId,
            };
          }),
        };

        groupedRoutes.push(groupedRoute);
      }
    }

    return NextResponse.json(groupedRoutes);
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { error: "Failed to fetch routes" },
      { status: 500 }
    );
  }
}
