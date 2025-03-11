"use client";

import { useState, useEffect, useRef } from "react";
import { InfoIcon, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./IncidentCalendar.module.css";

type CalendarData = {
  [date: string]: number;
};

type TooltipInfo = {
  date: string;
  count: number;
  x: number;
  y: number;
  visible: boolean;
};

interface IncidentCalendarClientProps {
  calendarData: CalendarData;
  fixedMonths?: number;
}

// Format une date au format YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

// Format une date au format lisible en français
const formatReadableDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

// Détermine la couleur en fonction du nombre d'incidents
const getColor = (count: number, maxCount: number): string => {
  if (count === 0) return "#f1f5f9";

  const colors = ["#fee2e2", "#fecaca", "#fca5a5", "#ef4444", "#dc2626"];

  const index = Math.min(
    Math.floor((count / maxCount) * colors.length),
    colors.length - 1
  );
  return colors[index];
};

// Obtient le nom du mois abrégé
const getMonthName = (month: number): string => {
  const months = [
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
  return months[month];
};

export default function IncidentCalendarClient({
  calendarData,
  fixedMonths = 13, // Changé de 9 à 13 mois
}: IncidentCalendarClientProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [maxCount, setMaxCount] = useState<number>(5);
  const [tooltip, setTooltip] = useState<TooltipInfo>({
    date: "",
    count: 0,
    x: 0,
    y: 0,
    visible: false,
  });
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 6); // 6 mois avant le mois courant
    return date;
  });

  // Nombre de semaines à afficher
  const weeksToShow = Math.round(fixedMonths * 4.33) + 1;

  // Calculer la valeur maximale pour la colorisation
  useEffect(() => {
    if (Object.keys(calendarData).length) {
      const values = Object.values(calendarData);
      const max = values.length > 0 ? Math.max(...values) : 5;
      setMaxCount(max > 0 ? max : 5);
    }
  }, [calendarData]);

  // Centrer automatiquement sur le mois courant lors du chargement initial
  useEffect(() => {
    if (wrapperRef.current) {
      // Trouver la position approximative du mois courant (au milieu)
      const centerWeek = Math.round(weeksToShow / 2);
      const centerPosition = centerWeek * 14; // 14px par colonne
      
      // Ajuster pour centrer dans la fenêtre
      const halfViewportWidth = wrapperRef.current.clientWidth / 2;
      wrapperRef.current.scrollLeft = centerPosition - halfViewportWidth;
    }
  }, [weeksToShow]);

  // Naviguer vers la période précédente
  const navigateBack = () => {
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() - 3);
    setStartDate(newDate);
  };

  // Naviguer vers la période suivante
  const navigateForward = () => {
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() + 3);

    // Ne pas aller au-delà de la date actuelle moins le nombre de mois fixes
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() - fixedMonths + 3);
    maxDate.setDate(1);

    if (newDate <= maxDate) {
      setStartDate(newDate);
    }
  };

  // Naviguer vers aujourd'hui
  const navigateToday = () => {
    const today = new Date();
    today.setDate(1);
    today.setMonth(today.getMonth() - 6); // Le mois courant sera au milieu
    setStartDate(today);

    // Faire défiler vers la position appropriée
    setTimeout(() => {
      if (wrapperRef.current) {
        // Centrer le mois courant dans la vue
        const centerWeek = Math.round(weeksToShow / 2);
        const centerPosition = centerWeek * 14; // 14px par colonne
        
        // Ajuster pour centrer dans la fenêtre
        const halfViewportWidth = wrapperRef.current.clientWidth / 2;
        wrapperRef.current.scrollLeft = centerPosition - halfViewportWidth;
      }
    }, 10);
  };

  // Vérifier si la période actuelle est visible
  const isCurrentPeriodVisible = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const visibleEndDate = new Date(startDate);
    visibleEndDate.setMonth(visibleEndDate.getMonth() + fixedMonths - 1);

    return (
      (visibleEndDate.getMonth() >= currentMonth &&
        visibleEndDate.getFullYear() === currentYear) ||
      visibleEndDate.getFullYear() > currentYear
    );
  };

  // Générer le calendrier
  const generateCalendar = () => {
    const calendarStartDate = new Date(startDate);

    // Ajuster pour commencer au premier jour de la semaine (dimanche)
    const firstDayOfWeek = calendarStartDate.getDay();
    calendarStartDate.setDate(calendarStartDate.getDate() - firstDayOfWeek);

    // Variables pour le suivi des mois
    const monthLabels = [];
    let currentMonth = -1; // Initialiser à une valeur qui ne correspond à aucun mois

    // Constante pour la largeur d'une colonne (cellule + marges)
    const COLUMN_WIDTH = 14; // 0.75rem (cellule) + 0.25rem (marges) = ~14px

    // Créer les colonnes de jours
    const weeks = [];

    // Ajouter l'en-tête des jours de la semaine
    const dayHeaders = (
      <div key="dayheaders" className={styles.weekColumn}>
        {["D", "L", "M", "M", "J", "V", "S"].map((day, idx) => (
          <div key={`dayheader-${idx}`} className={styles.dayLabel}>
            {day}
          </div>
        ))}
      </div>
    );

    weeks.push(dayHeaders);

    // Créer les colonnes de semaines
    let currentDate = new Date(calendarStartDate);
    for (let week = 0; week < weeksToShow; week++) {
      const days = [];

      // Vérifier si un nouveau mois commence dans cette semaine
      for (let day = 0; day < 7; day++) {
        // Si premier jour du mois et changement de mois, ajouter un label de mois
        if (
          currentDate.getDate() === 1 &&
          currentDate.getMonth() !== currentMonth
        ) {
          currentMonth = currentDate.getMonth();
          monthLabels.push({
            month: getMonthName(currentMonth),
            position: week + day / 7, // Position plus précise en tenant compte du jour
          });
        }

        const dateString = formatDate(currentDate);
        const count = calendarData[dateString] || 0;
        const color = getColor(count, maxCount);
        const isToday = dateString === formatDate(new Date());

        days.push(
          <div
            key={`${week}-${day}`}
            className={`${styles.dayCell} ${isToday ? styles.todayCell : ""}`}
            style={{ backgroundColor: color }}
            onMouseEnter={(e) => {
              if (calendarRef.current) {
                const rect = e.currentTarget.getBoundingClientRect();
                const calendarRect = calendarRef.current.getBoundingClientRect();

                setTooltip({
                  date: dateString,
                  count,
                  x: rect.left + rect.width / 2 - calendarRect.left,
                  y: rect.top - calendarRect.top,
                  visible: true,
                });
              }
            }}
            onMouseLeave={() => {
              setTooltip((prev) => ({ ...prev, visible: false }));
            }}
          />
        );

        // Passer au jour suivant
        currentDate.setDate(currentDate.getDate() + 1);
      }

      weeks.push(
        <div key={`week-${week}`} className={styles.weekColumn}>
          {days}
        </div>
      );
    }

    // Générer les étiquettes de mois avec un positionnement amélioré
    const monthElements = monthLabels.map((label, index) => {
      // Calculer la position plus précisément
      const position = label.position * COLUMN_WIDTH + 18;

      return (
        <div
          key={`month-${index}`}
          className={styles.monthLabel}
          style={{ left: `${position}px` }}
        >
          {label.month}
        </div>
      );
    });

    return (
      <div className={styles.calendarContent} ref={calendarRef}>
        <div className={styles.monthsRow}>{monthElements}</div>
        <div className={styles.calendarGrid}>{weeks}</div>

        {tooltip.visible && (
          <div
            className={styles.tooltip}
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          >
            <div className={styles.tooltipDate}>
              {formatReadableDate(tooltip.date)}
            </div>
            {tooltip.count > 0 && (
              <div className={styles.tooltipCount}>
                {tooltip.count} incident{tooltip.count > 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Si pas de données
  if (!Object.keys(calendarData).length) {
    return (
      <div className="text-center py-4 text-gray-500">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          Calendrier d'incidents
          <button
            className={styles.infoButton}
            onClick={() => setShowLegend(!showLegend)}
            aria-label="Légende"
          >
            <InfoIcon size={14} />
          </button>
          {showLegend && (
            <div className={styles.legend}>
              <span className={styles.legendLabel}>Moins</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={`legend-${level}`}
                  className={styles.legendBox}
                  style={{ backgroundColor: getColor(level, 4) }}
                />
              ))}
              <span className={styles.legendLabel}>Plus</span>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <button
            className={styles.navButton}
            onClick={navigateBack}
            aria-label="Mois précédents"
          >
            <ChevronLeft size={16} />
          </button>

          {!isCurrentPeriodVisible() && (
            <button
              className={styles.todayButton}
              onClick={navigateToday}
              aria-label="Aujourd'hui"
            >
              Aujourd'hui
            </button>
          )}

          <button
            className={styles.navButton}
            onClick={navigateForward}
            aria-label="Mois suivants"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className={styles.calendarWrapper} ref={wrapperRef}>
        {generateCalendar()}
      </div>

      <div className={styles.footer}>
        <Calendar size={12} />
        Affichage de {fixedMonths} mois d'activité
      </div>
    </div>
  );
}