// /app/api/gtfs/import-cron-trigger/route.ts
import { NextResponse } from "next/server";
import axios, { AxiosError } from "axios"; // Importation du type AxiosError
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const IMPORT_TOKEN = process.env.CRON_SECRET;
// Utiliser l'URL complète pour les environnements de production
const BASE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

function validateAuth(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === IMPORT_TOKEN;
}

export const maxDuration = 60; // 1 minute is enough for the trigger

export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Check if there's an import in progress
    const stateDir = path.join(os.tmpdir(), "gtfs-import-state");
    const stateFilePath = path.join(stateDir, "import-state.json");
    
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    
    let state = {
      currentStep: '',
      completed: true,
      lastUpdated: 0
    };
    
    // Load existing state if available
    if (fs.existsSync(stateFilePath)) {
      try {
        const stateData = fs.readFileSync(stateFilePath, 'utf8');
        state = JSON.parse(stateData);
      } catch (error) {
        console.error("Error loading state file:", error);
      }
    }
    
    // Get reset parameter
    const url = new URL(request.url);
    const reset = url.searchParams.get('reset') === 'true';
    
    // Check if an import is in progress and not stale (2 hours timeout)
    const isStale = Date.now() - state.lastUpdated > 2 * 60 * 60 * 1000;
    
    // Utiliser directement le token pour les requêtes directes à l'API
    let orchestratorUrl;
    
    if (!state.completed && !isStale && !reset) {
      // There's an import in progress, so just call the next step
      console.log(`Import already in progress at step: ${state.currentStep}. Continuing...`);
      
      // Call the orchestrator with the current state
      // Ajouter le token directement dans l'URL
      orchestratorUrl = `${BASE_URL}/api/gtfs/import-orchestrator?step=${state.currentStep}&token=${IMPORT_TOKEN}`;
    } else {
      // Start a new import or reset a stale one
      console.log("Starting new GTFS import...");
      
      // Reset the state and start from the beginning
      const resetParam = reset || isStale ? '&reset=true' : '';
      
      // Ajouter le token directement dans l'URL
      orchestratorUrl = `${BASE_URL}/api/gtfs/import-orchestrator?step=download${resetParam}&token=${IMPORT_TOKEN}`;
    }
    
    try {
      // Faire la requête sans l'en-tête Authorization
      const response = await axios.get(orchestratorUrl);
      
      return NextResponse.json({
        status: "success",
        message: reset || isStale ? "Starting new import (reset)" : "Continuing import",
        orchestratorResponse: response.data
      });
    } catch (error) {
      console.error("Error calling orchestrator:", error instanceof Error ? error.message : String(error));
      
      // Vérifier que error est une erreur Axios avec un type guard
      if (axios.isAxiosError(error)) {
        // Maintenant TypeScript sait que c'est une AxiosError avec une propriété response
        console.error("Response status:", error.response?.status);
        console.error("Response data:", error.response?.data);
        
        return NextResponse.json({
          status: "error",
          message: "Failed to call orchestrator",
          error: error.message,
          responseStatus: error.response?.status,
          responseData: error.response?.data
        }, { status: 500 });
      } else {
        // Ce n'est pas une erreur Axios, donc pas de propriété response
        return NextResponse.json({
          status: "error",
          message: "Failed to call orchestrator",
          error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }
    }
    
  } catch (error) {
    console.error("Error in import trigger:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      error: "Error triggering import",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Allow POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}