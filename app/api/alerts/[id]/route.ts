import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ error: "ID d'alerte manquant" }), {
        status: 400,
      });
    }

    const alert = await prisma.alert.findUnique({
      where: { id },
    });

    if (!alert) {
      return new Response(JSON.stringify({ error: "Alerte non trouvée" }), {
        status: 404,
      });
    }

    return new Response(JSON.stringify(alert));
  } catch (error) {
    console.error(
      `Erreur lors de la récupération de l'alerte ${params.id}:`,
      error
    );
    return new Response(
      JSON.stringify({ error: "Erreur lors de la récupération de l'alerte" }),
      { status: 500 }
    );
  }
}
