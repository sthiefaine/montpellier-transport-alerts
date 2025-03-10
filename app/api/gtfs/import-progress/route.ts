// /app/api/gtfs/import-progress/route.ts
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const IMPORT_TOKEN = process.env.CRON_SECRET;

function validateAuth(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.substring(7);
  return token === IMPORT_TOKEN;
}

export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Get the state file
    const stateDir = path.join(os.tmpdir(), "gtfs-import-state");
    const stateFilePath = path.join(stateDir, "import-state.json");

    if (!fs.existsSync(stateFilePath)) {
      return NextResponse.json({
        status: "success",
        message: "No import in progress",
        inProgress: false,
        state: null,
      });
    }

    // Load the state
    try {
      const stateData = fs.readFileSync(stateFilePath, "utf8");
      const state = JSON.parse(stateData);

      // Calculate progress percentages
      let progressPercentage = 0;
      let stepProgressPercentage = 0;

      // Define step weights - all steps as percentage of total progress
      const stepWeights = {
        download: 5,
        "import-stops": 5,
        "import-routes": 5,
        "import-trips": 35,
        "import-stop-times": 40,
        cleanup: 5,
        complete: 5,
      };

      // Map step names to sequential numbers for progress calculation
      const stepOrder = {
        download: 0,
        "import-stops": 1,
        "import-routes": 2,
        "import-trips": 3,
        "import-stop-times": 4,
        cleanup: 5,
        complete: 6,
      };
      // Calculer le progrès global basé sur les étapes terminées
      const currentStepNumber = stepOrder[state.currentStep as keyof typeof stepOrder];
      let completedProgress = 0;

      // Somme les poids de toutes les étapes terminées
      Object.entries(stepOrder).forEach(([step, number]) => {
        if (number < currentStepNumber) {
          completedProgress += stepWeights[step as keyof typeof stepWeights];
        }
      });

      // Calculate progress within the current step
      if (state.currentStep === "import-trips" && state.tripTotal > 0) {
        stepProgressPercentage =
          ((state.tripChunk * 5000) / state.tripTotal) * 100;
      } else if (
        state.currentStep === "import-stop-times" &&
        state.stopTimeTotal > 0
      ) {
        stepProgressPercentage =
          ((state.stopTimeChunk * 10000) / state.stopTimeTotal) * 100;
      } else if (state.currentStep === "complete") {
        stepProgressPercentage = 100;
      } else {
        // For other steps, use 50% as a default value
        stepProgressPercentage = 50;
      }

      // Calculer la contribution de l'étape actuelle au progrès global
      const currentStepContribution =
        (stepProgressPercentage / 100) * stepWeights[state.currentStep as keyof typeof stepWeights];

      // Le progrès total est la somme des étapes terminées et de la contribution de l'étape actuelle
      progressPercentage = completedProgress + currentStepContribution;

      // Calculate elapsed time
      const elapsedTimeSeconds = Math.round(
        (Date.now() - state.startTime) / 1000
      );
      const elapsedTimeFormatted = formatTime(elapsedTimeSeconds);

      // Check if the import is stale (no update for 2 hours)
      const isStale = Date.now() - state.lastUpdated > 2 * 60 * 60 * 1000;

      return NextResponse.json({
        status: "success",
        message: state.completed
          ? "Import completed"
          : isStale
          ? "Import appears to be stalled"
          : "Import in progress",
        inProgress: !state.completed && !isStale,
        completed: state.completed,
        stale: isStale,
        state: state,
        progress: {
          percentage: Math.min(100, Math.round(progressPercentage)),
          currentStep: state.currentStep,
          currentStepProgress: Math.round(stepProgressPercentage),
          elapsedTime: elapsedTimeFormatted,
          elapsedSeconds: elapsedTimeSeconds,
        },
      });
    } catch (error) {
      console.error("Error parsing state file:", error);
      return NextResponse.json(
        {
          status: "error",
          message: "Erreur lors de la lecture de l'état de l'importation",
          error: error instanceof Error ? error.message : "Erreur inconnue",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in import progress:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de l'obtention du progrès de l'importation",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}

// Format seconds into a readable time string
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }

  parts.push(`${remainingSeconds}s`);

  return parts.join(" ");
}

// Allow POST for consistency
export async function POST(request: Request) {
  return GET(request);
}
