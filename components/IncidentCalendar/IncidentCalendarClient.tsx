"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import styles from "./IncidentCalendar.module.css";
import { isToday } from "@/lib/utils";

// Types
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

// Utilitaires déplacés en dehors du composant pour éviter les recréations
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTooltipDate = (date: Date): string => {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const getMonthName = (date: Date): string => {
  const monthNames = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
  ];
  return monthNames[date.getMonth()];
};

// Palette de couleurs définie hors du composant
const defaultColorScale = [
  "#ebedf0", // 0
  "#fff9c4", // 1
  "#fff59d", // 2
  "#ffee58", // 3
  "#ffca28", // 4
  "#ffa726", // 5
  "#fb8c00", // 6
  "#f57c00", // 7
  "#ff8a80", // 8
  "#ff5252", // 9
  "#e53935", // 10
  "#c62828", // 11
  "#8b0000", // 12
  "#4a0000", // 13
  "#000000", // 14+
];

// Fonction pour construire le template du calendrier - utilisée une seule fois
const buildCalendarTemplate = (year: number): WeekDays[] => {
  const firstDay = new Date(year, 0, 1);
  const lastDay = new Date(year, 11, 31);

  // Ajuster pour commencer au lundi
  const firstDayOfWeek = firstDay.getDay();
  const adjustedFirstDay = new Date(firstDay);
  if (firstDayOfWeek === 0) { // Dimanche
    adjustedFirstDay.setDate(adjustedFirstDay.getDate() - 6);
  } else {
    adjustedFirstDay.setDate(adjustedFirstDay.getDate() - (firstDayOfWeek - 1));
  }

  // Ajuster pour terminer au dimanche
  const lastDayOfWeek = lastDay.getDay();
  const adjustedLastDay = new Date(lastDay);
  if (lastDayOfWeek !== 0) {
    adjustedLastDay.setDate(adjustedLastDay.getDate() + (7 - lastDayOfWeek));
  }

  const result: WeekDays[] = [];
  let currentWeek: DayItem[] = [];
  let weekIndex = 0;
  let currentDate = new Date(adjustedFirstDay);

  // Générer toutes les semaines
  while (currentDate <= adjustedLastDay) {
    if (currentWeek.length === 7) {
      result.push({ weekIndex: weekIndex++, days: currentWeek });
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
      incidentLevel: 0, // Valeur par défaut
      monthName: getMonthName(currentDate),
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Compléter la dernière semaine si nécessaire
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
        incidentLevel: 0,
        monthName: getMonthName(currentDate),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    result.push({ weekIndex: weekIndex, days: currentWeek });
  }

  return result;
};

const IncidentCalendarClient = ({
  data = {},
  year = new Date().getFullYear(),
  colorScale = defaultColorScale,
  emptyColor = "#ebedf0",
  errorLabels = {},
}: IncidentCalendarProps) => {
  // États
  const [calendarDays, setCalendarDays] = useState<WeekDays[]>(() => 
    buildCalendarTemplate(year)
  );
  
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const [tooltip, setTooltip] = useState(() => {
    const today = new Date();
    return {
      visible: true,
      date: formatTooltipDate(today),
      incident: "",
      level: 0
    };
  });

  // Références DOM
  const todayRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Fonctions utilitaires mémoïsées
  const getIncidentText = useCallback((level: number): string => {
    if (errorLabels[level]) {
      return errorLabels[level];
    }
    if (level === 0) return "Aucun incident";
    if (level === 1) return "1 incident";
    return `${level} incidents`;
  }, [errorLabels]);

  const getColor = useCallback((incidentLevel: number): string => {
    if (incidentLevel <= 0) return emptyColor;
    if (incidentLevel >= 10) {
      const highLevelIndex = 10 + Math.min(incidentLevel - 10, 4);
      return colorScale[highLevelIndex] || colorScale[colorScale.length - 1];
    }
    return colorScale[incidentLevel];
  }, [colorScale, emptyColor]);

  // Calculer les couleurs de légende une seule fois
  const legendColors = useMemo(() => {
    if (colorScale.length > 7) {
      return [0, 1, 3, 5, 7, 9, 10, 14].map(
        (i) => colorScale[i] || colorScale[colorScale.length - 1]
      );
    }
    return colorScale;
  }, [colorScale]);

  // Initialiser les incidentLevels initiaux et le tooltip
  useEffect(() => {
    // On initialise le tooltip ici, une seule fois, sans créer de dépendance
    const today = new Date();
    const todayStr = formatDate(today);
    
    setTooltip(prev => ({
      ...prev,
      level: data[todayStr] || 0,
      incident: getIncidentText(data[todayStr] || 0)
    }));
    
    // Ne pas mettre getIncidentText dans les dépendances pour éviter les boucles
  }, []); // Exécution unique au montage

  // Mise à jour des niveaux d'incidents quand les données changent
  useEffect(() => {
    if (Object.keys(data).length > 0) {
      // Mettre à jour chaque jour avec son niveau d'incident
      setCalendarDays(prevDays => 
        prevDays.map(week => ({
          ...week,
          days: week.days.map(day => ({
            ...day,
            incidentLevel: data[day.dateStr] || 0
          }))
        }))
      );
      
      // Mettre à jour le tooltip si la date d'aujourd'hui est affichée
      const today = new Date();
      const todayStr = formatDate(today);
      
      // On utilise une fonction pour éviter les boucles
      setTooltip(prev => {
        // Ne mettez à jour le tooltip que si la date actuelle est affichée
        // ou si c'est le premier rendu
        if (prev.date === formatTooltipDate(today)) {
          return {
            ...prev,
            level: data[todayStr] || 0,
            incident: getIncidentText(data[todayStr] || 0)
          };
        }
        return prev;
      });
    }
    // Ne pas inclure getIncidentText dans les dépendances
  }, [data]); // Ne dépend que des données

  // Effet distinct pour le scroll vers aujourd'hui (exécuté une seule fois)
  useEffect(() => {
    if (todayRef.current && gridRef.current && !hasScrolledToToday) {
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
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [hasScrolledToToday]); // Ne dépend que de hasScrolledToToday

  // Fonction pour mettre à jour le tooltip lors du clic sur un jour
  const handleDayClick = useCallback((day: DayItem) => {
    setTooltip({
      visible: true,
      date: formatTooltipDate(day.date),
      incident: getIncidentText(day.incidentLevel),
      level: day.incidentLevel,
    });
  }, [getIncidentText]);

  // Jours de la semaine pour l'en-tête (constants)
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <div className={styles.heatmapContainer}>
      <div className={styles.heatmap}>
        <div className={styles.dayLabels}>
          {weekDays.map((day, i) => (
            <div key={i} className={styles.dayLabel}>{day}</div>
          ))}
        </div>

        <div className={styles.calendarWrapper}>
          <div className={styles.grid} ref={gridRef}>
            {calendarDays.map((week) => (
              <div key={week.weekIndex} className={styles.week}>
                {week.days.map((day, dayIndex) => {
                  const isTodayDay = isToday(day.date);
                  return (
                    <div
                      key={`${week.weekIndex}-${dayIndex}`}
                      className={`
                        ${styles.day}
                        ${isTodayDay ? styles.today : ""}
                        ${day.isFirstMondayOfMonth ? styles.monthStart : ""}
                        ${day.incidentLevel > 0 ? styles.hasData : ""}
                      `}
                      style={{ backgroundColor: getColor(day.incidentLevel) }}
                      ref={isTodayDay ? todayRef : null}
                      onClick={() => handleDayClick(day)}
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
          {legendColors.map((color, index) => (
            <div
              key={index}
              className={styles.legendItem}
              style={{ backgroundColor: color }}
              title={
                index === 0
                  ? "Aucun"
                  : index === legendColors.length - 1
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