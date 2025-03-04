import { NextRequest } from "next/server";
import fs from 'fs';
import path from 'path';

const TRAM_LINES_PATH = path.join(process.cwd(), 'data', 'transport-lines.json');

export async function GET(request: NextRequest) {
  try {
    if (!fs.existsSync(TRAM_LINES_PATH)) {
      return new Response(
        JSON.stringify({
          error: "Fichier de données des lignes non trouvé",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=36000",
          },
        }
      );
    }

    // Lire le contenu du fichier
    const fileContent = fs.readFileSync(TRAM_LINES_PATH, 'utf-8');
    const tramLinesData = JSON.parse(fileContent);

    return new Response(JSON.stringify(tramLinesData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache d'une heure
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des lignes de transport:", error);

    return new Response(
      JSON.stringify({
        error: "Erreur lors de la récupération des lignes de transport",
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