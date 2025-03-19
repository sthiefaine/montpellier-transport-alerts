"use server";
import { Suspense } from "react";
import IncidentCalendarClient from "./IncidentCalendarClient";
import { apiFetch } from "@/lib/api-fetch";

async function getCalendarData(months: number = 18) {
  try {
    const res = await apiFetch(`/api/alerts/calendar?months=${months}`, {
      next: {
        tags: ["alerts"],
        revalidate: 360,
      },
    });
    return res;
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
