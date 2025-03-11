import { Calendar } from "lucide-react";
import { Suspense } from "react";
import IncidentCalendarClient from "./IncidentCalendarClient";

export const revalidate = 3600;

interface IncidentCalendarProps {
  fixedMonths?: number;
}

// Fonction pour récupérer les données côté serveur
async function getCalendarData(months: number = 18) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/alerts/calendar?months=${months}`, {
      next: {
        tags: ['alerts-calendar'],
        revalidate: 3600
      }
    });
    
    if (!res.ok) {
      throw new Error("Erreur lors de la récupération des données du calendrier");
    }
    
    return await res.json();
  } catch (error) {
    console.error("Erreur lors du chargement du calendrier:", error);
    return {};
  }
}

export default async function IncidentCalendar({ fixedMonths = 9 }: IncidentCalendarProps) {
  // Récupération des données côté serveur
  const calendarData = await getCalendarData(18);
  
  return (
    <div className="bg-white rounded-lg shadow p-3 relative">
      <Suspense fallback={
        <div className="text-center py-8 text-gray-500">
          Chargement du calendrier...
        </div>
      }>
        <IncidentCalendarClient calendarData={calendarData} fixedMonths={fixedMonths} />
      </Suspense>
    </div>
  );
}