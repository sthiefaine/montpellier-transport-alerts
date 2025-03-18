import { getAlertStats } from "@/app/actions/alerts/alerts.action";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeAll = searchParams.get("includeAll") === "true";
    const includeComplements = searchParams.get("includeComplements") !== "false";

    const stats = await getAlertStats({
      includeAll,
      includeComplements
    });

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);

    return new Response(
      JSON.stringify({
        error: "Erreur lors de la récupération des statistiques",
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