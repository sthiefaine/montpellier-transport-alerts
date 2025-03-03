import { useState, useEffect, useRef, JSX } from "react";
import useSWR from "swr";
import { InfoIcon, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

// Types
type CalendarData = {
  [date: string]: number;
};

type HoveredDateInfo = {
  date: string;
  count: number;
  dayOfWeek: string;
  x: number;
  y: number;
} | null;

type MonthLabel = {
  month: string;
  position: number;
};

interface IncidentCalendarProps {
  fixedMonths?: number;
}

// Fonction pour formater la date en YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

// Fonction pour formater la date en format lisible
const formatReadableDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};



// Fonction pour générer les couleurs de la heatmap
const getColor = (count: number, maxCount: number): string => {
  if (count === 0) return "#ebedf0";

  const colors = ["#f0d0d0", "#e57373", "#ef5350", "#e53935", "#c62828"];

  const index = Math.min(
    Math.floor((count / maxCount) * colors.length),
    colors.length - 1
  );
  return colors[index];
};

// Fonction pour obtenir le nom du mois
const getMonthName = (month: number, year: number): string => {
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
  return `${months[month]}`;
};

// Fonction pour obtenir le jour de la semaine
const getDayOfWeek = (day: number): string => {
  const days = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ];
  return days[day];
};

// Fetcher pour récupérer les données d'incidents
const fetcher = async (url: string): Promise<CalendarData> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erreur lors du fetch");
  return res.json() as Promise<CalendarData>;
};

const IncidentCalendar: React.FC<IncidentCalendarProps> = ({
  fixedMonths = 9,
}) => {
  const calendarRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // États
  const [calendarData, setCalendarData] = useState<CalendarData>({});
  const [maxCount, setMaxCount] = useState<number>(5);
  const [hoveredDate, setHoveredDate] = useState<HoveredDateInfo>(null);
  const [legendVisible, setLegendVisible] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date>(() => {
    // Par défaut, commencer 6 mois avant le mois actuel (pour voir 6 mois d'historique + 3 mois à venir)
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 6);
    return date;
  });

  // Calculer combien de semaines nous devons afficher
  const weeksToShow = Math.round(fixedMonths * 4.33) + 1; // +1 pour être sûr d'afficher tous les jours

  // Définir l'URL pour récupérer les données d'incidents
  // Nous récupérons une année et demie pour avoir des données en cache pour la navigation
  const { data, error, isLoading } = useSWR<CalendarData>(
    `/api/alerts/calendar?months=18`,
    fetcher
  );

  // Effet pour charger les données
  useEffect(() => {
    if (data) {
      setCalendarData(data);
      const values = Object.values(data);
      const max = values.length > 0 ? Math.max(...values) : 5;
      setMaxCount(max > 0 ? max : 5);
    }
  }, [data, isLoading, error]);

  // Fonctions de navigation
  const navigateBack = () => {
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() - 3); // Reculer de 3 mois
    setStartDate(newDate);

    // Faire défiler au début après le changement
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0;
      }
    }, 0);
  };

  const navigateForward = () => {
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() + 3); // Avancer de 3 mois

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() - fixedMonths + 3); 
    maxDate.setDate(1);

    if (newDate <= maxDate) {
      setStartDate(newDate);

      // Faire défiler au début après le changement
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = 0;
        }
      }, 0);
    }
  };

  const navigateToday = () => {
    const today = new Date();
    today.setDate(1);
    today.setMonth(today.getMonth() - 6); // Positionne le mois actuel au milieu de la vue (6 mois avant, 3 après)
    setStartDate(today);

    // Faire défiler pour montrer le mois actuel
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const currentMonthPosition = 6 * 4.33 * 14; // Position approximative du mois actuel
        scrollContainerRef.current.scrollLeft = currentMonthPosition;
      }
    }, 0);
  };

  // Fonction pour vérifier si la période actuelle (mois actuel +/- 1) est visible
  const isCurrentPeriodVisible = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + fixedMonths);

    const startMonth = new Date(startDate);
    startMonth.setMonth(startMonth.getMonth() + 5); // Le mois 5 dans notre vue devrait être proche du mois actuel
    const startMonthValue = startMonth.getMonth();
    const startYearValue = startMonth.getFullYear();

    return (
      Math.abs(startMonthValue - currentMonth) <= 1 &&
      startYearValue === currentYear
    );
  };

  // Générer le calendrier
  const generateCalendar = (): JSX.Element => {
    // On commence au premier jour du mois de départ
    const calendarStartDate = new Date(startDate);

    // Reculer jusqu'au premier jour de la semaine pour commencer proprement
    const firstDayOfWeek = calendarStartDate.getDay();
    calendarStartDate.setDate(calendarStartDate.getDate() - firstDayOfWeek);

    // Générer les cases du calendrier par semaine
    const weeks: JSX.Element[] = [];
    let currentDate = new Date(calendarStartDate);

    for (let week = 0; week < weeksToShow; week++) {
      const days: JSX.Element[] = [];

      for (let day = 0; day < 7; day++) {
        const dateString = formatDate(currentDate);
        const count = calendarData[dateString] || 0;
        const color = getColor(count, maxCount);

        // Vérifier si la date est dans la plage à afficher
        const isInRange =
          currentDate >= calendarStartDate && week < weeksToShow;

        // Mettre en évidence le jour actuel
        const isToday = dateString === formatDate(new Date());

        if (isInRange) {
          days.push(
            <div
              key={dateString}
              className={`w-2.5 h-2.5 m-0.5 rounded-sm cursor-pointer transition-all duration-200 hover:transform hover:scale-150 ${
                isToday ? "ring-1 ring-blue-500" : ""
              }`}
              style={{ backgroundColor: color }}
              onMouseEnter={(e) => {
                // Récupérer la position pour l'infobulle
                const rect = e.currentTarget.getBoundingClientRect();
                const calendarRect =
                  calendarRef.current?.getBoundingClientRect() || {
                    left: 0,
                    top: 0,
                  };

                setHoveredDate({
                  date: dateString,
                  count,
                  dayOfWeek: getDayOfWeek(currentDate.getDay()),
                  x: rect.left - calendarRect.left,
                  y: rect.top - calendarRect.top,
                });
              }}
              onMouseLeave={() => setHoveredDate(null)}
            />
          );
        } else {
          // Espace vide pour les jours hors plage
          days.push(
            <div key={`empty-${week}-${day}`} className="w-2.5 h-2.5 m-0.5" />
          );
        }

        // Passer au jour suivant
        currentDate.setDate(currentDate.getDate() + 1);
      }

      weeks.push(
        <div key={`week-${week}`} className="flex flex-col">
          {days}
        </div>
      );
    }

    // Générer les en-têtes des mois
    const months: JSX.Element[] = [];
    const monthLabels: MonthLabel[] = [];
    currentDate = new Date(calendarStartDate);

    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    // On ne commence pas forcément au début du mois, donc le premier label
    // doit être placé en fonction de la position dans le mois
    const daysPassedInFirstMonth = currentDate.getDate() - 1;
    const weeksPassedInFirstMonth = Math.floor(
      (daysPassedInFirstMonth + firstDayOfWeek) / 7
    );

    monthLabels.push({
      month: getMonthName(currentMonth, currentYear),
      position: 0,
    });

    for (let i = 0; i < weeksToShow * 7; i++) {
      if (currentDate.getMonth() !== currentMonth) {
        currentMonth = currentDate.getMonth();
        currentYear = currentDate.getFullYear();
        monthLabels.push({
          month: getMonthName(currentMonth, currentYear),
          position: i / 7, // Position en semaines
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Filtrer les labels trop proches les uns des autres
    const filteredLabels = monthLabels.reduce(
      (acc: MonthLabel[], label, index) => {
        // Si c'est le premier label, l'ajouter
        if (index === 0) return [label];

        // Sinon, vérifier si ce label est suffisamment loin du précédent
        const lastLabel = acc[acc.length - 1];
        const minDistance = 2.5; // Au moins 2.5 semaines d'écart (environ 35px)

        if (label.position - lastLabel.position >= minDistance) {
          acc.push(label);
        }

        return acc;
      },
      []
    );

    filteredLabels.forEach((label, index) => {
      months.push(
        <div
          key={`month-${index}`}
          className="text-xs text-gray-500 absolute top-0 whitespace-nowrap"
          style={{ left: `${label.position * 14 + 12}px` }} // 14px par semaine
        >
          {label.month}
        </div>
      );
    });

    return (
      <div className="relative pt-6" ref={calendarRef}>
        <div className="h-6 relative mb-1">{months}</div>
        <div className="flex" ref={scrollContainerRef}>
          {weeks}
        </div>
      </div>
    );
  };

  // Rendu de l'infobulle
  const renderTooltip = () => {
    if (!hoveredDate) return null;

    // Calculer la position de l'infobulle
    const tooltipStyle: React.CSSProperties = {
      position: "absolute",
      left: `${hoveredDate.x}px`,
      top: `${hoveredDate.y - 50}px`, // Positionner au-dessus du carré
    };

    return (
      <div
        className="bg-gray-800 text-white text-xs rounded py-1.5 px-2.5 z-10 shadow-lg min-w-max whitespace-nowrap"
        style={tooltipStyle}
      >
        <div className="font-bold">{hoveredDate.dayOfWeek}</div>
        <div>{formatReadableDate(hoveredDate.date)}</div>
        <div className="mt-1 font-semibold">
          {hoveredDate.count} incident{hoveredDate.count !== 1 ? "s" : ""}
        </div>
      </div>
    );
  };

  // Style pour masquer la barre de défilement tout en permettant le défilement
  const hideScrollbarStyle = `
    .hide-scrollbar::-webkit-scrollbar {
      height: 4px;
      background: transparent;
    }
    .hide-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.1);
      border-radius: 4px;
    }
    .hide-scrollbar:hover::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2);
    }
  `;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-3">
        <h3 className="text-sm font-bold mb-2">Calendrier d'incidents</h3>
        <div className="text-center py-8 text-gray-500">
          Chargement du calendrier...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-3">
        <h3 className="text-sm font-bold mb-2">Calendrier d'incidents</h3>
        <div className="text-center py-4 text-red-500">
          Erreur lors du chargement des données du calendrier
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-3 relative">
      <style>{hideScrollbarStyle}</style>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold flex items-center">
          Calendrier d'incidents
          <button
            className="ml-2 text-gray-400 hover:text-gray-600"
            onClick={() => setLegendVisible(!legendVisible)}
          >
            <InfoIcon size={14} />
          </button>
        </h3>

        <div className="flex items-center">
          {legendVisible && (
            <div className="flex items-center text-xs mr-4">
              <span className="mr-1">Moins</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={`legend-${level}`}
                  className="w-2.5 h-2.5 mx-px rounded-sm"
                  style={{ backgroundColor: getColor(level, 4) }}
                />
              ))}
              <span className="ml-1">Plus</span>
            </div>
          )}

          <div className="flex space-x-1">
            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={navigateBack}
              title="3 mois précédents"
            >
              <ChevronLeft size={16} />
            </button>

            {!isCurrentPeriodVisible() && (
              <button
                className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                onClick={navigateToday}
              >
                Aujourd'hui
              </button>
            )}

            <button
              className="p-1 rounded hover:bg-gray-100"
              onClick={navigateForward}
              title="3 mois suivants"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto hide-scrollbar">
        {generateCalendar()}
        {renderTooltip()}
      </div>

      <div className="text-xs text-gray-500 mt-2 text-center">
        <Calendar className="inline-block w-3 h-3 mr-1" />
        Affichage de {fixedMonths} mois
      </div>
    </div>
  );
};

export default IncidentCalendar;
