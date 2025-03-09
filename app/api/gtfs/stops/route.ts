import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const routeId = url.searchParams.get("routeId");
    const directionId = url.searchParams.get("directionId");
    
    if (!routeId) {
      return NextResponse.json({ error: "Route ID is required" }, { status: 400 });
    }

    // Extract the line number from the routeId (like "1" from "7-1" or "8-1")
    const lineNumber = routeId.includes("-") 
      ? routeId.split("-").pop() 
      : routeId;
    
    console.log(`Looking for stops for line number: ${lineNumber}`);

    // First, find all routes that represent the same line
    const routes = await prisma.route.findMany({
      where: {
        OR: [
          { id: { endsWith: `-${lineNumber}` } },
          { id: lineNumber },
          { shortName: lineNumber }
        ]
      },
      select: {
        id: true,
        shortName: true,
        longName: true
      }
    });

    console.log(`Found ${routes.length} routes for line ${lineNumber}:`, 
      routes.map(r => `${r.id} (${r.shortName})`));

    if (routes.length === 0) {
      return NextResponse.json({
        message: "No routes found for this line number",
        lineNumber
      }, { status: 404 });
    }

    // Get all route IDs
    const routeIds = routes.map(route => route.id);

    // Create direction filter if needed
    const directionWhere = directionId !== null 
      ? { directionId: parseInt(directionId, 10) } 
      : {};

    // Find all stops for these routes
    const stops = await prisma.stop.findMany({
      where: {
        stopTimes: {
          some: {
            trip: {
              routeId: { in: routeIds },
              ...directionWhere
            }
          }
        }
      },
      distinct: ['id'],
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        code: true,
        lat: true,
        lon: true
      }
    });

    console.log(`Found ${stops.length} stops for line ${lineNumber}`);

    // Return 404 if no stops found
    if (stops.length === 0) {
      return NextResponse.json({
        message: "No stops found for this line",
        lineNumber,
        routeIds
      }, { status: 404 });
    }

    // Format the response
    const formattedStops = stops.map(stop => ({
      id: stop.id,
      name: stop.name,
      code: stop.code,
      location: {
        lat: stop.lat,
        lon: stop.lon
      }
    }));

    // Get route info for metadata
    const routeInfo = routes.length > 0 ? {
      lineNumber,
      name: routes[0].longName,
      variants: routes.map(r => ({ id: r.id, shortName: r.shortName }))
    } : null;

    return NextResponse.json({
      route: routeInfo,
      stops: formattedStops
    });
  } catch (error) {
    console.error("Error fetching stops:", error);
    return NextResponse.json(
      {
        error: "Server error",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}