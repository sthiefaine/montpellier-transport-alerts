"use client";
import React, { useState, useEffect, useRef } from "react";
import styles from "./IncidentCalendar.module.css";
import { isToday } from "@/lib/utils";

interface IncidentData {
  [date: string]: number;
}

// Interface pour les messages d'erreur par niveau
interface ErrorLabels {
  [level: number]: string;
}

// Nouvelle interface pour les jours structurés
interface DayItem {
  date: Date;
  dateStr: string;
  isFirstOfMonth: boolean;
  isFirstMondayOfMonth: boolean;
  incidentLevel: number;
  monthName: string;
}

// Structure pour organiser les jours par semaines
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

// Palette de couleurs avec dégradé jaune-orange-rouge-noir
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
  "#000000"  // Noir
];

const IncidentCalendarClient = ({
  data = {},
  year = new Date().getFullYear(),
  colorScale = defaultColorScale,
  emptyColor = "#ebedf0",
  errorLabels = {},
}: IncidentCalendarProps) => {
  const [calendarDays, setCalendarDays] = useState<WeekDays[]>([]);
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

  // Effet pour scroller vers la date du jour après le rendu
  useEffect(() => {
    if (todayRef.current && gridRef.current) {
      // Calcul du scroll pour centrer la date d'aujourd'hui
      const todayElement = todayRef.current;
      const gridElement = gridRef.current;

      // Position du jour courant par rapport au début de la grille
      const todayRect = todayElement.getBoundingClientRect();
      const gridRect = gridElement.getBoundingClientRect();

      // Calculer la position de scroll pour centrer le jour courant
      const scrollPosition =
        todayElement.offsetLeft - gridRect.width / 2 + todayRect.width / 2;

      // Scroller avec une petite animation
      gridElement.scrollTo({
        left: scrollPosition > 0 ? scrollPosition : 0,
        behavior: "smooth",
      });
    }
    setTooltip({
      visible: true,
      date: formatTooltipDate(new Date()),
      incident: "",
      level: data[formatDate(new Date())] || 0,
    });
  }, [calendarDays]);

  useEffect(() => {
    // Générer toutes les dates structurées pour l'année
    const generateStructuredDates = () => {
      const firstDay = new Date(year, 0, 1);
      const lastDay = new Date(year, 11, 31);

      // Ajuster le premier jour pour qu'il commence au début de la semaine (lundi)
      const firstDayOfWeek = firstDay.getDay();
      const adjustedFirstDay = new Date(firstDay);
      if (firstDayOfWeek === 0) {
        // Dimanche
        adjustedFirstDay.setDate(adjustedFirstDay.getDate() - 6);
      } else {
        adjustedFirstDay.setDate(
          adjustedFirstDay.getDate() - (firstDayOfWeek - 1)
        );
      }

      // Ajuster le dernier jour pour qu'il aille jusqu'à la fin de la semaine
      const lastDayOfWeek = lastDay.getDay();
      const adjustedLastDay = new Date(lastDay);
      if (lastDayOfWeek !== 0) {
        // Si ce n'est pas un dimanche
        adjustedLastDay.setDate(
          adjustedLastDay.getDate() + (7 - lastDayOfWeek)
        );
      }

      // Générer toutes les semaines avec des jours structurés
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

      // Ajouter la dernière semaine si elle n'est pas complète
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

    const generatedDays = generateStructuredDates();
    setCalendarDays(generatedDays);
  }, [year, data]);

  // Formater la date en chaîne 'YYYY-MM-DD'
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getColor = (incidentLevel: number): string => {
    if (incidentLevel <= 0) {
      return emptyColor;
    }
    
    // Pour les niveaux 10+, utiliser les dernières couleurs du dégradé
    if (incidentLevel >= 10) {
      // Calculer l'index pour les niveaux élevés (10+)
      // On utilise modulo pour ne pas dépasser la longueur du tableau
      const highLevelIndex = 10 + Math.min(incidentLevel - 10, 4);
      return colorScale[highLevelIndex] || colorScale[colorScale.length - 1];
    }
    
    // Pour les niveaux 1-9, utiliser directement l'index
    return colorScale[incidentLevel];
  };

  // Obtenir le texte du niveau d'incident pour l'infobulle
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

  // Calculer les couleurs à afficher dans la légende
  const getLegendColors = () => {
    // Si la palette contient beaucoup de couleurs, montrer une sélection représentative
    if (colorScale.length > 7) {
      // Montrer les couleurs 0, 1, 3, 5, 7, 10, et 14 (noir) pour un bon échantillon du dégradé
      return [0, 1, 3, 5, 7, 9, 10, 14].map(i => colorScale[i] || colorScale[colorScale.length - 1]);
    }
    // Sinon montrer toutes les couleurs
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
              <span>{tooltip.level === 0 ? "Aucun incident" : (tooltip.level === 1 ? "1 incident" : `${tooltip.level} incidents`)}</span>
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
              title={index === 0 ? "Aucun" : index === getLegendColors().length - 1 ? "10+" : `${index}`}
            />
          ))}
          <div className={styles.legendLabel}>10+</div>
        </div>
      </div>
    </div>
  );
};

export default IncidentCalendarClient;