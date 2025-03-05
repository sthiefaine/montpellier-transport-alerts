"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  BarChart2,
  LayoutDashboard,
  MapPin,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

export default function DelayNav() {
  const router = useRouter();
  const pathname = usePathname();

  // Déterminer quelle section est active
  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6 overflow-x-auto">
      <nav className="flex">
        <Link
          href="/"
          className={`px-4 py-3 flex items-center whitespace-nowrap border-b-2 ${
            false
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          <LayoutDashboard className="h-4 w-4 mr-2" />
          <span>Accueil</span>
        </Link>

        <Link
          href="/delay"
          className={`px-4 py-3 flex items-center whitespace-nowrap border-b-2 ${
            isActive("/delay")
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          <BarChart2 className="h-4 w-4 mr-2" />
          <span>Tableau de bord</span>
        </Link>

        <Link
          href="/delay/lines"
          className={`px-4 py-3 flex items-center whitespace-nowrap border-b-2 ${
            isActive("/delay/lines")
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          <span>Par lignes</span>
        </Link>

        <Link
          href="/delay/stops"
          className={`px-4 py-3 flex items-center whitespace-nowrap border-b-2 ${
            isActive("/delay/stops")
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          <MapPin className="h-4 w-4 mr-2" />
          <span>Par arrêts</span>
        </Link>

        <Link
          href="/delay/hours"
          className={`px-4 py-3 flex items-center whitespace-nowrap border-b-2 ${
            isActive("/delay/hours")
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          <Clock className="h-4 w-4 mr-2" />
          <span>Par heures</span>
        </Link>

        <Link
          href="/delay/historical"
          className={`px-4 py-3 flex items-center whitespace-nowrap border-b-2 ${
            isActive("/delay/historical")
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-600 hover:text-blue-600"
          }`}
        >
          <Calendar className="h-4 w-4 mr-2" />
          <span>Historique</span>
        </Link>
      </nav>
    </div>
  );
}
