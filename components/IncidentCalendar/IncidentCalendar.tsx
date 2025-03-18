"use server";
import { Suspense } from "react";
import IncidentCalendarClient from "./IncidentCalendarClient";
import { getCalendarData } from "@/app/actions/calendar/calendar.action";

export default async function IncidentCalendar() {
  const calendarData = await getCalendarData(12);
  return (
    <Suspense fallback={<IncidentCalendarClient />}>
      <IncidentCalendarClient data={calendarData} />
    </Suspense>
  );
}
