"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import DelayNav from "@/app/components/DelayStats/DelayNav";

// Import dynamique pour éviter les problèmes de SSR avec les graphiques
const DelayDashboard = dynamic(
  () => import("@/app/components/DelayStats/DelayDashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Chargement du tableau de bord...</p>
        </div>
      </div>
    ),
  }
);

export default function DelayPage() {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    // Mettre à jour la date/heure toutes les minutes
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <header className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour à l'accueil
            </Link>

            <h1 className="text-2xl font-bold mt-2 mb-1">
              Tableau de bord des retards
            </h1>
            <p className="text-gray-600">
              Suivi et analyse de la ponctualité du réseau de transport en
              commun de Montpellier
            </p>
          </div>

          <div className="mt-4 md:mt-0 p-2 bg-blue-50 rounded-lg text-sm text-blue-800">
            <p>
              Dernière mise à jour:{" "}
              {currentDateTime.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Navigation du dashboard */}
        <div className="mt-6">
          <DelayNav />
        </div>
      </header>

      <main>
        <DelayDashboard />
      </main>

      <footer className="mt-10 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
        <p>
          Les données présentées sont calculées à partir des passages en temps
          réel des véhicules.
        </p>
        <p className="mt-2">
          © {new Date().getFullYear()} Transport Montpellier
        </p>
      </footer>
    </div>
  );
}
