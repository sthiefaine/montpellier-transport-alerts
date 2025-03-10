"use client";

import React, { useState, useEffect } from "react";
import styles from "./DeparturesFinder.module.css";

interface Route {
  id: string;
  shortName: string;
  longName?: string;
  color?: string | null;
  type?: number;
  routeId?: string;
  [key: string]: any;
}

interface DirectionSelectorProps {
  route: Route;
  selectedDirection: number | null;
  onSelectDirection: (directionId: number | null) => void;
}

interface Direction {
  id: string | number;
  directionId: number;
  name: string;
  routeId?: string;
}

const DirectionSelector: React.FC<DirectionSelectorProps> = ({
  route,
  selectedDirection,
  onSelectDirection,
}) => {
  const [directions, setDirections] = useState<Direction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDirections = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/routes/byName/${route.shortName}/directions`
        );

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(
          `Loaded ${data.length} directions for line ${route.shortName}:`,
          data
        );

        if (Array.isArray(data) && data.length > 0) {
          // Vérifier que chaque direction a bien une propriété name non vide
          const validDirections = data.map((dir) => ({
            ...dir,
            // Assurer que le nom est défini, sinon utiliser une valeur par défaut
            name:
              dir.name ||
              `Direction ${dir.directionId === 0 ? "Aller" : "Retour"}`,
          }));
          setDirections(validDirections);
        } else {
          // Direction par défaut si aucune n'est trouvée
          setDirections([
            { id: 0, directionId: 0, name: "Direction Aller" },
            { id: 1, directionId: 1, name: "Direction Retour" },
          ]);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des directions:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
        // Direction par défaut en cas d'erreur
        setDirections([
          { id: 0, directionId: 0, name: "Direction Aller" },
          { id: 1, directionId: 1, name: "Direction Retour" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDirections();
  }, [route.shortName]);

  if (loading) {
    return (
      <div className={styles.loadingDirections}>
        <div className={styles.spinner}></div>
        <span>Chargement des directions...</span>
      </div>
    );
  }

  return (
    <>
      {/* Option "Toutes" */}
      <button
        key="all"
        className={`${styles.directionButton} ${
          selectedDirection === null ? styles.activeDirection : ""
        }`}
        onClick={() => onSelectDirection(null)}
      >
        Toutes
      </button>

      {/* Directions spécifiques */}
      {directions.map((direction) => (
        <button
          key={direction.directionId}
          className={`${styles.directionButton} ${
            selectedDirection === direction.directionId
              ? styles.activeDirection
              : ""
          }`}
          onClick={() => onSelectDirection(direction.directionId)}
        >
          {direction.name ||
            `Direction ${direction.directionId === 0 ? "Aller" : "Retour"}`}
        </button>
      ))}
    </>
  );
};

export default DirectionSelector;
