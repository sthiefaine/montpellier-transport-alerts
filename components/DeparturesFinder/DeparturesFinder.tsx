"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  MapPin,
  Bus,
  Clock,
  Info,
  Filter,
  X,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import NextDepartures from "@/components/NextDepartures/NextDepartures";
import styles from "./DeparturesFinder.module.css";
import LineSelector from "./Line";
import StopSelector from "./Stop";
import DirectionSelector from "./DirectionSelector";
import {
  Route,
  Stop,
  EnhancedStop,
  TerminusByRoute,
  DeparturesFinderProps,
} from "@/lib/types/departures";

export default function DeparturesFinder({
  initialRoutes,
  initialPopularStops,
  terminusByRoute,
}: DeparturesFinderProps) {
  const [routes, setRoutes] = useState<Route[]>(initialRoutes);
  const [popularStops, setPopularStops] = useState<Stop[]>(initialPopularStops);
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [filteredStops, setFilteredStops] = useState<Stop[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"lines" | "stops">("lines");
  const [stopsForRoute, setStopsForRoute] = useState<EnhancedStop[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Quand une route est sélectionnée, récupérer ses arrêts
  useEffect(() => {
    if (selectedRoute) {
      console.log("Fetching stops for route:", selectedRoute);
      fetchStopsForRoute(selectedRoute);
    } else {
      setStopsForRoute([]);
    }
  }, [selectedRoute]);

  // Fonction pour récupérer les arrêts d'une ligne spécifique
  const fetchStopsForRoute = async (route: Route) => {
    try {
      setIsLoading(true);
      // Utiliser le shortName pour récupérer tous les arrêts de la ligne
      const shortName = route.shortName;

      const response = await fetch(`/api/routes/${shortName}/stops`);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data: EnhancedStop[] = await response.json();
      console.log(`Loaded ${data.length} stops for line ${shortName}`);

      // Les données sont déjà triées par l'API : d'abord par direction, puis par position
      setStopsForRoute(data);
    } catch (error) {
      console.error("Erreur lors du chargement des arrêts:", error);
      setStopsForRoute([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction améliorée pour rechercher des arrêts par nom
  const fetchStopsBySearch = async (query: string) => {
    setIsLoading(true);
    try {
      // Appeler l'API de la nouvelle table StopsList
      const response = await fetch(
        `/api/gtfs/stops-list?q=${encodeURIComponent(
          query
        )}&details=true&limit=20`
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const searchResults: Stop[] = data.data.map((item: any) => ({
        id: item.stopId || item.id, // Utiliser le lien vers Stop si disponible
        name: item.description || item.name,
        code: null,
        lat: item.lat,
        lon: item.lon,
        lignesPassantes: item.lignesPassantes,
        lignesEtDirections: item.lignesEtDirections,
        station: item.station,
        commune: item.commune,
        source: item.source,
      }));

      setFilteredStops(searchResults);
    } catch (error) {
      console.error("Erreur lors de la recherche d'arrêts:", error);

      // Fallback au comportement précédent si l'API n'est pas disponible
      const searchResults = popularStops.filter(
        (stop) =>
          stop.name.toLowerCase().includes(query.toLowerCase()) ||
          stop.code?.toLowerCase().includes(query.toLowerCase())
      );

      setFilteredStops(searchResults);
    } finally {
      setIsLoading(false);
    }
  };

  // Quand une recherche est effectuée, mettre à jour les arrêts filtrés
  useEffect(() => {
    if (searchQuery.length > 2) {
      fetchStopsBySearch(searchQuery);
    } else if (searchQuery.length === 0) {
      setFilteredStops([]);
    }
  }, [searchQuery]);

  // Gérer la sélection d'une ligne
  const handleRouteSelect = (route: Route) => {
    console.log("Selected route:", route);
    setSelectedRoute(route);
    setSelectedStop(null);
    setActiveTab("stops");
    setSelectedDirection(null); // null signifie "Toutes"
  };

  // Gérer la sélection d'un arrêt
  const handleStopSelect = (stop: Stop) => {
    setSelectedStop(stop);

    // Si la direction est sur "Toutes" (null) et que l'arrêt a une direction spécifique
    if (selectedDirection === null && stop.directionId !== undefined) {
      console.log(
        `Automatically selecting direction ${stop.directionId} based on stop ${stop.name}`
      );
      setSelectedDirection(stop.directionId);
    }

    // Si on a sélectionné via la recherche, réinitialiser la ligne et la direction
    if (!selectedRoute) {
      setSelectedDirection(null);
    }
  };

  // Gérer la sélection d'une direction
  const handleDirectionSelect = (direction: number | null) => {
    setSelectedDirection(direction);
  };

  // Réinitialiser tous les filtres
  const resetFilters = () => {
    setSelectedRoute(null);
    setSelectedStop(null);
    setSelectedDirection(null);
    setSearchQuery("");
    setActiveTab("lines");
  };

  // Safe getter for routeId with fallback to id
  const getRouteId = (route: Route): string => {
    return route.routeId || route.id;
  };

  // Afficher des informations enrichies pour l'arrêt sélectionné
  const renderStopInfo = () => {
    if (!selectedStop) return null;

    // Types de station avec icônes
    const stationType = selectedStop.source || selectedStop.station;
    const stationIcon =
      selectedStop.source === "tram"
        ? "🚊"
        : selectedStop.source === "bus"
        ? "🚌"
        : null;

    // Lignes passantes
    const hasLines =
      selectedStop.lignesPassantes || selectedStop.lignesEtDirections;

    if (!stationType && !hasLines && !selectedStop.commune) return null;

    return (
      <div className={styles.stopInfoBox}>
        {stationType && (
          <div className={styles.stopInfoItem}>
            {stationIcon && (
              <span className={styles.infoIcon}>{stationIcon}</span>
            )}
            <span>
              {stationType === "tram"
                ? "Station de tramway"
                : stationType === "bus"
                ? "Arrêt de bus"
                : stationType}
            </span>
          </div>
        )}

        {hasLines && (
          <div className={styles.stopInfoItem}>
            <span className={styles.infoIcon}>🔄</span>
            <span>
              Lignes :{" "}
              {selectedStop.lignesPassantes ||
                (selectedStop.lignesEtDirections || "")
                  .split(";")
                  .map((l: string) => l.split(" ")[0])
                  .join(", ")}
            </span>
          </div>
        )}

        {selectedStop.commune && (
          <div className={styles.stopInfoItem}>
            <span className={styles.infoIcon}>📍</span>
            <span>{selectedStop.commune}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.selectionPanel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Rechercher des départs</h2>

          <button
            className={styles.filterToggle}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? <X size={18} /> : <Filter size={18} />}
            <span className="md:hidden">Filtres</span>
          </button>
        </div>

        <div
          className={`${styles.filterContainer} ${
            showFilters ? styles.showFilters : ""
          }`}
        >
          <div className={styles.tabContainer}>
            <button
              className={`${styles.tab} ${
                activeTab === "lines" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("lines")}
            >
              <Bus size={16} />
              <span>Par ligne</span>
            </button>
            <button
              className={`${styles.tab} ${
                activeTab === "stops" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("stops")}
            >
              <MapPin size={16} />
              <span>Par arrêt</span>
            </button>
          </div>

          {activeTab === "lines" && (
            <div className={styles.selectorWrapper}>
              <LineSelector
                routes={routes}
                selectedRoute={selectedRoute}
                onSelectRoute={handleRouteSelect}
              />
            </div>
          )}

          {activeTab === "stops" && (
            <div className={styles.selectorWrapper}>
              <div className={styles.searchBox}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Rechercher un arrêt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button
                    className={styles.clearButton}
                    onClick={() => setSearchQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <StopSelector
                stops={
                  searchQuery
                    ? filteredStops
                    : selectedRoute
                    ? stopsForRoute
                    : popularStops
                }
                selectedStop={selectedStop}
                onSelectStop={handleStopSelect}
                isLoading={isLoading}
                selectedDirection={selectedDirection}
                emptyMessage={
                  searchQuery && filteredStops.length === 0
                    ? "Aucun arrêt ne correspond à votre recherche"
                    : selectedRoute && stopsForRoute.length === 0
                    ? "Chargement des arrêts pour cette ligne..."
                    : "Sélectionnez un arrêt ou recherchez-en un"
                }
                label={
                  searchQuery
                    ? "Résultats de recherche"
                    : selectedRoute
                    ? `Arrêts de la ligne ${selectedRoute.shortName}`
                    : "Arrêts populaires"
                }
              />
            </div>
          )}

          {/* Section pour les directions si une ligne est sélectionnée */}
          {selectedRoute && (
            <div className={styles.directionSelector}>
              <h3 className={styles.sectionTitle}>Direction</h3>
              <div className={styles.directionButtons}>
                <DirectionSelector
                  route={selectedRoute}
                  selectedDirection={selectedDirection}
                  onSelectDirection={handleDirectionSelect}
                />
              </div>
            </div>
          )}

          {/* Affichage des sélections actuelles */}
          {(selectedRoute || selectedStop) && (
            <div className={styles.currentSelection}>
              <h3 className={styles.sectionTitle}>Sélection</h3>
              <div className={styles.selectionPills}>
                {selectedRoute && (
                  <div
                    className={styles.pill}
                    style={{
                      backgroundColor: selectedRoute.color
                        ? `#${selectedRoute.color}`
                        : "#666",
                      color:
                        selectedRoute.color && isLightColor(selectedRoute.color)
                          ? "#000"
                          : "#fff",
                    }}
                  >
                    <span>Ligne {selectedRoute.shortName}</span>
                    <button
                      className={styles.clearPill}
                      onClick={() => setSelectedRoute(null)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {selectedStop && (
                  <div className={styles.pill}>
                    <MapPin size={14} />
                    <span>{selectedStop.name}</span>
                    <button
                      className={styles.clearPill}
                      onClick={() => setSelectedStop(null)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {(selectedRoute || selectedStop) && (
                  <button className={styles.resetButton} onClick={resetFilters}>
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Information enrichie pour l'arrêt sélectionné */}
          {selectedStop && renderStopInfo()}
        </div>
      </div>

      <div className={styles.resultsPanel}>
        {selectedStop ? (
          <NextDepartures
            initialStopIds={selectedStop.id}
            routeId={selectedRoute ? getRouteId(selectedRoute) : undefined}
            directionId={selectedDirection}
            limit={20}
            refreshInterval={30000}
            showTitle={true}
            displayMode="auto"
          />
        ) : selectedRoute ? (
          <NextDepartures
            routeId={getRouteId(selectedRoute)}
            directionId={selectedDirection}
            limit={20}
            refreshInterval={30000}
            showTitle={true}
            displayMode="auto"
          />
        ) : (
          <NextDepartures
            limit={5}
            refreshInterval={30000}
            showTitle={false}
            displayMode="auto"
          />
        )}

        {(selectedRoute || selectedStop) && (
          <div className={styles.infoBox}>
            <div className={styles.infoHeader}>
              <Info size={16} />
              <h3>Bon à savoir</h3>
            </div>
            <p>
              Les horaires indiqués sont en temps réel et peuvent varier en
              fonction des conditions de circulation.
              {selectedRoute &&
                " Les retards sont actualisés automatiquement toutes les 30 secondes."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Fonction utilitaire pour déterminer si une couleur est claire
function isLightColor(color: string): boolean {
  // Supprimer le # si présent
  color = color.replace("#", "");

  // Convertir en RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Calculer la luminosité (formule standard)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Retourner true si la couleur est claire (luminance > 0.5)
  return luminance > 0.5;
}
