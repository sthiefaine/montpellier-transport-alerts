// app/api/alerts/active/route.ts
import { getActiveAlerts } from "@/app/actions/alerts/active.action";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const activeAlerts = await getActiveAlerts();

    return new Response(JSON.stringify(activeAlerts), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des alertes actives:", error);

    return new Response(
      JSON.stringify({
        error: "Erreur lors de la récupération des alertes actives",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}