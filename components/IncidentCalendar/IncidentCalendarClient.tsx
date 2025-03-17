"use client";
import React, { useState, useEffect, useRef } from "react";
import styles from "./IncidentCalendar.module.css";
import { isToday } from "@/lib/utils";

interface IncidentData {
  [date: string]: number;
}

interface ErrorLabels {
  [level: number]: string;
}

interface DayItem {
  date: Date;
  dateStr: string;
  isFirstOfMonth: boolean;
  isFirstMondayOfMonth: boolean;
  incidentLevel: number;
  monthName: string;
}

interface WeekDays {
  weekIndex: number;
  days: DayItem[];
}

interface IncidentCalendarProps {
  data?: IncidentData;
  year?: number;
  colorScale?: string[];
  emptyColor?: string;
  errorLabels?: ErrorLabels;
}

const formatTooltipDate = (date: Date): string => {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const defaultColorScale = [
  "#ebedf0", // Gris clair pour aucun incident
  "#fff9c4", // Jaune très pâle
  "#fff59d", // Jaune pâle
  "#ffee58", // Jaune
  "#ffca28", // Jaune doré
  "#ffa726", // Orange clair
  "#fb8c00", // Orange
  "#f57c00", // Orange foncé
  "#ff8a80", // Rouge-orange
  "#ff5252", // Rouge
  "#e53935", // Rouge vif
  "#c62828", // Rouge foncé
  "#8b0000", // Rouge sang
  "#4a0000", // Rouge très foncé
  "#000000", // Noir
];

const IncidentCalendarClient = ({
  data = {},
  year = new Date().getFullYear(),
  colorScale = defaultColorScale,
  emptyColor = "#ebedf0",
  errorLabels = {},
}: IncidentCalendarProps) => {
  const [calendarDays, setCalendarDays] = useState<WeekDays[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    date: string;
    incident: string;
    level: number;
  }>({
    visible: true,
    date: formatTooltipDate(new Date()),
    incident: "",
    level: 0,
  });

  const todayRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const generateStructuredDates = () => {
    const firstDay = new Date(year, 0, 1);
    const lastDay = new Date(year, 11, 31);

    const firstDayOfWeek = firstDay.getDay();
    const adjustedFirstDay = new Date(firstDay);
    if (firstDayOfWeek === 0) {
      adjustedFirstDay.setDate(adjustedFirstDay.getDate() - 6);
    } else {
      adjustedFirstDay.setDate(
        adjustedFirstDay.getDate() - (firstDayOfWeek - 1)
      );
    }

    const lastDayOfWeek = lastDay.getDay();
    const adjustedLastDay = new Date(lastDay);
    if (lastDayOfWeek !== 0) {
      adjustedLastDay.setDate(adjustedLastDay.getDate() + (7 - lastDayOfWeek));
    }

    const result: WeekDays[] = [];
    let currentWeek: DayItem[] = [];
    let weekIndex = 0;

    let currentDate = new Date(adjustedFirstDay);

    while (currentDate <= adjustedLastDay) {
      if (currentWeek.length === 7) {
        result.push({
          weekIndex: weekIndex++,
          days: currentWeek,
        });
        currentWeek = [];
      }

      const dateStr = formatDate(currentDate);
      const isFirstOfMonth = currentDate.getDate() === 1;
      const isFirstMondayOfMonth =
        currentDate.getDay() === 1 && currentDate.getDate() <= 7;

      currentWeek.push({
        date: new Date(currentDate),
        dateStr,
        isFirstOfMonth,
        isFirstMondayOfMonth,
        incidentLevel: data[dateStr] || 0,
        monthName: getMonthName(currentDate),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        const dateStr = formatDate(currentDate);
        const isFirstOfMonth = currentDate.getDate() === 1;
        const isFirstMondayOfMonth =
          currentDate.getDay() === 1 && currentDate.getDate() <= 7;

        currentWeek.push({
          date: new Date(currentDate),
          dateStr,
          isFirstOfMonth,
          isFirstMondayOfMonth,
          incidentLevel: data[dateStr] || 0,
          monthName: getMonthName(currentDate),
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      result.push({
        weekIndex: weekIndex,
        days: currentWeek,
      });
    }

    return result;
  };

  useEffect(() => {
    if (Object.keys(data).length > 0 || isDataReady) {
      const generatedDays = generateStructuredDates();
      setCalendarDays(generatedDays);
      setIsDataReady(true);

      const today = new Date();
      setTooltip({
        visible: true,
        date: formatTooltipDate(today),
        incident: getIncidentText(data[formatDate(today)] || 0),
        level: data[formatDate(today)] || 0,
      });
    }
  }, [year, data, isDataReady]);

  useEffect(() => {
    if (
      calendarDays.length > 0 &&
      todayRef.current &&
      gridRef.current &&
      !hasScrolledToToday
    ) {
      const timeoutId = setTimeout(() => {
        if (todayRef.current && gridRef.current) {
          const todayElement = todayRef.current;
          const gridElement = gridRef.current;

          const todayRect = todayElement.getBoundingClientRect();
          const gridRect = gridElement.getBoundingClientRect();

          const scrollPosition =
            todayElement.offsetLeft - gridRect.width / 2 + todayRect.width / 2;

          gridElement.scrollTo({
            left: scrollPosition > 0 ? scrollPosition : 0,
            behavior: "smooth",
          });

          setHasScrolledToToday(true);
        }
      }, 300); // Délai pour s'assurer que le DOM est construit

      return () => clearTimeout(timeoutId);
    }
  }, [calendarDays, hasScrolledToToday]);

  const getColor = (incidentLevel: number): string => {
    if (incidentLevel <= 0) {
      return emptyColor;
    }

    if (incidentLevel >= 10) {
      const highLevelIndex = 10 + Math.min(incidentLevel - 10, 4);
      return colorScale[highLevelIndex] || colorScale[colorScale.length - 1];
    }

    return colorScale[incidentLevel];
  };

  const getIncidentText = (level: number): string => {
    if (errorLabels[level]) {
      return errorLabels[level];
    }

    if (level === 0) return "Aucun incident";
    if (level === 1) return "1 incident";
    return `${level} incidents`;
  };

  const getMonthName = (date: Date): string => {
    const monthNames = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Juin",
      "Juil",
      "Août",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];
    return monthNames[date.getMonth()];
  };

  const getLegendColors = () => {
    if (colorScale.length > 7) {
      return [0, 1, 3, 5, 7, 9, 10, 14].map(
        (i) => colorScale[i] || colorScale[colorScale.length - 1]
      );
    }

    return colorScale;
  };

  return (
    <div className={styles.heatmapContainer}>
      <div className={styles.heatmap}>
        <div className={styles.dayLabels}>
          <div className={styles.dayLabel}>L</div>
          <div className={styles.dayLabel}>M</div>
          <div className={styles.dayLabel}>M</div>
          <div className={styles.dayLabel}>J</div>
          <div className={styles.dayLabel}>V</div>
          <div className={styles.dayLabel}>S</div>
          <div className={styles.dayLabel}>D</div>
        </div>

        <div className={styles.calendarWrapper}>
          <div className={styles.grid} ref={gridRef}>
            {calendarDays.map((week) => (
              <div key={week.weekIndex} className={styles.week}>
                {week.days.map((day, dayIndex) => {
                  const isTodayDay = isToday(day.date);
                  return (
                    <div
                      key={dayIndex + day.dateStr}
                      className={`
                        ${styles.day}
                        ${isTodayDay ? styles.today : ""}
                        ${day.isFirstMondayOfMonth ? styles.monthStart : ""}
                        ${day.incidentLevel > 0 ? styles.hasData : ""}
                      `}
                      style={{ backgroundColor: getColor(day.incidentLevel) }}
                      ref={isTodayDay ? todayRef : null}
                      onClick={() => {
                        setTooltip({
                          visible: true,
                          date: formatTooltipDate(day.date),
                          incident: getIncidentText(day.incidentLevel),
                          level: day.incidentLevel,
                        });
                      }}
                      data-month={day.isFirstMondayOfMonth ? day.monthName : ""}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.info}>
          {tooltip.visible && (
            <div>
              <span>{tooltip.date}: </span>
              <span>
                {tooltip.level === 0
                  ? "Aucun incident"
                  : tooltip.level === 1
                  ? "1 incident"
                  : `${tooltip.level} incidents`}
              </span>
            </div>
          )}
        </div>
        <div className={styles.legend}>
          <div className={styles.legendLabel}>0</div>
          {getLegendColors().map((color, index) => (
            <div
              key={index}
              className={styles.legendItem}
              style={{ backgroundColor: color }}
              title={
                index === 0
                  ? "Aucun"
                  : index === getLegendColors().length - 1
                  ? "10+"
                  : `${index}`
              }
            />
          ))}
          <div className={styles.legendLabel}>10+</div>
        </div>
      </div>
    </div>
  );
};

export default IncidentCalendarClient;
