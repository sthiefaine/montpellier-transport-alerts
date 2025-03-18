import { getEnhancedDelayStats } from "@/app/actions/delay/delay.action";
export async function GET() {
  try {
    const delayStats = await getEnhancedDelayStats();

    return new Response(JSON.stringify(delayStats), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "max-age=60, s-maxage=60",
      },
    });
  } catch (error) {
    console.error("Erreur API enhanced-summary:", error);

    if (error instanceof Error) {
      console.error("Message d'erreur:", error.message);
      console.error("Stack trace:", error.stack);
    }

    return new Response(
      JSON.stringify({
        error: "Erreur serveur",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
