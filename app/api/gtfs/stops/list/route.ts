import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  StopsListFilter,
  StopsListResponse,
  StopsListEntry,
} from "@/lib/types/stops";

const prisma = new PrismaClient();

export async function GET(
  request: Request
): Promise<
  NextResponse<StopsListResponse | { error: string; message?: string }>
> {
  try {
    const url = new URL(request.url);

    // Paramètres de filtrage
    const source = url.searchParams.get("source") as "tram" | "bus" | null;
    const commune = url.searchParams.get("commune");
    const ligne = url.searchParams.get("ligne");
    const query = url.searchParams.get("q"); // recherche par description
    const withDetails = url.searchParams.get("details") === "true"; // inclure les détails de stop
    const nearLat = url.searchParams.get("lat");
    const nearLon = url.searchParams.get("lon");
    const radius = url.searchParams.get("radius"); // en mètres

    // Pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const skip = (page - 1) * limit;

    // Construction de la requête de base
    const whereClause: StopsListFilter = {};

    // Filtres
    if (source) {
      whereClause.source = source;
    }

    if (commune) {
      whereClause.commune = commune;
    }

    if (ligne) {
      whereClause.lignesPassantes = {
        contains: ligne,
      };
    }

    if (query) {
      whereClause.description = {
        contains: query,
        mode: "insensitive",
      };
    }

    // Filtre géographique si lat, lon et radius sont fournis
    if (nearLat && nearLon && radius) {
      const lat = parseFloat(nearLat);
      const lon = parseFloat(nearLon);
      const radiusDegrees = parseFloat(radius) / 111000; // Conversion approximative de mètres en degrés

      whereClause.lat = {
        gte: lat - radiusDegrees,
        lte: lat + radiusDegrees,
      };

      whereClause.lon = {
        gte: lon - radiusDegrees,
        lte: lon + radiusDegrees,
      };
    }

    // Exécuter la requête avec filtres et pagination
    const [stops, total] = await Promise.all([
      prisma.stopsList.findMany({
        where: whereClause,
        include: withDetails
          ? {
              stop: true,
            }
          : undefined,
        skip,
        take: limit,
        orderBy: {
          description: "asc",
        },
      }),
      prisma.stopsList.count({
        where: whereClause,
      }),
    ]);

    // Renvoyer les résultats avec métadonnées de pagination
    const response: StopsListResponse = {
      data: stops as StopsListEntry[],
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching stops list:", error);
    return NextResponse.json(
      {
        error: "Error fetching stops list",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
