// /app/api/gtfs/cleanup-extraction/route.ts
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

export const maxDuration = 60; // 1 minute for cleanup

export async function GET(request: Request) {
  try {
    if (!validateAuth(request)) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Get the base directory for GTFS data
    const baseDir = path.join(os.tmpdir(), "gtfs-data");

    if (!fs.existsSync(baseDir)) {
      return NextResponse.json({
        status: "success",
        message: "No GTFS data directory found to clean up",
      });
    }

    // Find all extraction directories
    const dirEntries = fs.readdirSync(baseDir, { withFileTypes: true });
    const directories = dirEntries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    // Get the latest directory
    let latestDir = "";
    if (fs.existsSync(path.join(baseDir, "latest.txt"))) {
      latestDir = fs
        .readFileSync(path.join(baseDir, "latest.txt"), "utf8")
        .trim();
    }

    // Keep track of cleaned up directories
    const cleanedDirs = [];

    // Remove all directories except the latest
    for (const dir of directories) {
      const fullPath = path.join(baseDir, dir);
      if (fullPath !== latestDir) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        cleanedDirs.push(fullPath);
      }
    }

    return NextResponse.json({
      status: "success",
      message: "GTFS extraction directories cleaned up",
      cleanedDirectories: cleanedDirs,
      keptDirectory: latestDir,
    });
  } catch (error) {
    console.error(
      "Erreur lors du nettoyage des répertoires d'extraction GTFS:",
      error
    );
    return NextResponse.json(
      { error: "Erreur lors du nettoyage des répertoires d'extraction GTFS" },
      { status: 500 }
    );
  }
}

// Allow POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
