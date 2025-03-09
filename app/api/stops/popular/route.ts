// app/api/stops/popular/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Fetch popular stops - this example uses stop_times count to determine popularity
    // You might have a different way to determine popular stops in your actual application
    const popularStops = await prisma.$queryRaw`
      SELECT 
        s.id, 
        s.stop_name as name, 
        s.stop_code as code,
        s.stop_lat as lat,
        s.stop_lon as lon,
        COUNT(st.id) as trip_count
      FROM 
        stops s
      JOIN 
        stop_times st ON s.id = st.stop_id
      GROUP BY 
        s.id
      ORDER BY 
        trip_count DESC
      LIMIT 10
    `;

    return NextResponse.json(popularStops);
  } catch (error) {
    console.error("Error fetching popular stops:", error);

    // Fallback to hardcoded stops if database query fails
    const fallbackStops = [
      {
        id: "stop1",
        name: "Gare Saint-Roch",
        code: "STROCH",
        lat: 43.603,
        lon: 3.881,
      },
      { id: "stop2", name: "Comédie", code: "COMED", lat: 43.608, lon: 3.877 },
      { id: "stop3", name: "Corum", code: "CORUM", lat: 43.613, lon: 3.882 },
      {
        id: "stop4",
        name: "Louis Blanc",
        code: "LBLANC",
        lat: 43.616,
        lon: 3.875,
      },
      {
        id: "stop5",
        name: "Place de l'Europe",
        code: "EUROP",
        lat: 43.607,
        lon: 3.897,
      },
      {
        id: "stop6",
        name: "Rives du Lez",
        code: "RLEZ",
        lat: 43.602,
        lon: 3.899,
      },
      {
        id: "stop7",
        name: "Port Marianne",
        code: "PMAR",
        lat: 43.599,
        lon: 3.901,
      },
      { id: "stop8", name: "Mosson", code: "MOSS", lat: 43.616, lon: 3.82 },
    ];

    return NextResponse.json(fallbackStops);
  }
}
