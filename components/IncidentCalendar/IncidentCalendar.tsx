"use server";
import { Suspense } from "react";
import IncidentCalendarClient from "./IncidentCalendarClient";

async function getCalendarData(months: number = 18) {
  try {
    const res = await fetch(
      `${
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
      }/api/alerts/calendar?months=${months}`,
      {
        next: {
          tags: ["alerts"],
        },
      }
    );
    if (!res.ok) {
      throw new Error(
        "Erreur lors de la récupération des données du calendrier"
      );
    }
    return await res.json();
  } catch (error) {
    console.error("Erreur lors du chargement du calendrier:", error);
    return {};
  }
}

export default async function IncidentCalendar() {
  const calendarData = await getCalendarData(12);
  return (
    <Suspense fallback={<IncidentCalendarClient />}>
      <IncidentCalendarClient data={calendarData} />
    </Suspense>
  );
}
