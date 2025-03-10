// /app/api/gtfs/test-auth/route.ts
import { NextResponse } from "next/server";

const IMPORT_TOKEN = process.env.CRON_SECRET;

export async function GET(request: Request) {
  try {
    // Récupérer le token de l'URL
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    // Récupérer le token de l'en-tête Authorization
    const authHeader = request.headers.get("Authorization");
    let headerToken = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      headerToken = authHeader.substring(7);
    }

    // Valeurs pour le débogage (attention à ne pas exposer le token complet)
    const envTokenFirstChars = IMPORT_TOKEN
      ? IMPORT_TOKEN.substring(0, 4) + "..."
      : "non défini";
    const urlTokenFirstChars = token
      ? token.substring(0, 4) + "..."
      : "non fourni";
    const headerTokenFirstChars = headerToken
      ? headerToken.substring(0, 4) + "..."
      : "non fourni";

    const isValidUrlToken = token === IMPORT_TOKEN;
    const isValidHeaderToken = headerToken === IMPORT_TOKEN;

    return NextResponse.json({
      status: "success",
      message: "Test d'authentification",
      envTokenPrefix: envTokenFirstChars,
      urlTokenPrefix: urlTokenFirstChars,
      headerTokenPrefix: headerTokenFirstChars,
      isValidUrlToken: isValidUrlToken,
      isValidHeaderToken: isValidHeaderToken,
      isAuthenticated: isValidUrlToken || isValidHeaderToken,
    });
  } catch (error) {
    console.error(
      "Error in test auth:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      {
        error: "Error in test auth",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
