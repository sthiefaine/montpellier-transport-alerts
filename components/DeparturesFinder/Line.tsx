"use client";

import { Bus } from "lucide-react";
import styles from "./DeparturesFinder.module.css";

// Mise à jour de l'interface Route pour inclure les nouveaux champs
interface Route {
  id: string;
  shortName: string;
  longName: string;
  color?: string | null;
  type: number;
  routeIds?: string[]; // Ajout: tableau des IDs de routes associées
  directionIds?: number[]; // Ajout: tableau des IDs de direction disponibles
  directions?: {
    id: string;
    name: string;
    directionId: number;
  }[]; // Ajout: informations sur les directions
}

interface LineSelectorProps {
  routes: Route[];
  selectedRoute: Route | null;
  onSelectRoute: (route: Route) => void;
}

export default function LineSelector({
  routes,
  selectedRoute,
  onSelectRoute,
}: LineSelectorProps) {
  // Regrouper les routes par type
  const tramRoutes = routes.filter(
    (route) => route.type === 0 || route.type === 1
  ); // Types tram
  const busRoutes = routes.filter(
    (route) => route.type === 2 || route.type === 3
  ); // Types bus
  const otherRoutes = routes.filter(
    (route) => !tramRoutes.includes(route) && !busRoutes.includes(route)
  );

  console.log('tram', tramRoutes)

  // Fonction pour déterminer si une couleur est claire ou foncée
  const isLightColor = (color?: string | null) => {
    if (!color) return false;

    // Supprimer le # si présent
    color = color.replace("#", "");

    // Convertir en RGB
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 2), 16);
    const b = parseInt(color.substring(4, 2), 16);

    // Calculer la luminosité (formule standard)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Retourner true si la couleur est claire (luminance > 0.5)
    return luminance > 0.5;
  };

  // Composant pour chaque groupe de lignes
  const RouteGroup = ({
    title,
    routes,
  }: {
    title: string;
    routes: Route[];
  }) => (
    <div className={styles.routeGroup}>
      <h3 className={styles.routeGroupTitle}>{title}</h3>
      <div className={styles.routeButtons}>
        {routes.map((route) => (
          <button
            key={route.id}
            className={`${styles.routeButton} ${
              selectedRoute?.id === route.id ? styles.selectedRoute : ""
            }`}
            onClick={() => onSelectRoute(route)}
            style={{
              backgroundColor: route.color ? `#${route.color}` : undefined,
              color: route.color
                ? isLightColor(route.color)
                  ? "#000"
                  : "#fff"
                : undefined,
            }}
            title={route.routeIds ? (route.routeIds.length > 1 ? `Ligne incluant ${route.routeIds.length} directions` : undefined) : undefined}
          >
            <span className={styles.routeNumber}>{route.shortName}</span>

          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.lineSelectorContainer}>
      {tramRoutes.length > 0 && (
        <RouteGroup title="Tramways" routes={tramRoutes} />
      )}
      {busRoutes.length > 0 && <RouteGroup title="Bus" routes={busRoutes} />}
      {otherRoutes.length > 0 && (
        <RouteGroup title="Autres lignes" routes={otherRoutes} />
      )}

      {routes.length === 0 && (
        <div className={styles.emptyState}>
          <Bus size={24} />
          <p>Aucune ligne disponible</p>
        </div>
      )}
    </div>
  );
}