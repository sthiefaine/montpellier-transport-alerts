"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Clock, ArrowRight, Bus, MapPin, Search, X, Plus, Settings } from "lucide-react";
import styles from "./NextDepartures.module.css";

interface NextDepartureData {
  tripId: string;
  line: {
    id: string;
    number: string;
    name: string;
    color: string | null;
  };
  stop: {
    id: string;
    name: string;
    code: string | null;
  };
  direction: {
    id: number | null;
    headsign: string;
  };
  delay: number;
  scheduledTime: string | null;
  estimatedTime: string | null;
  formattedScheduled: string | null;
  formattedEstimated: string | null;
}

interface StopData {
  id: string;
  name: string;
  code?: string | null;
}

interface NextDeparturesProps {
  // Support pour les deux formats d'API
  stopId?: string | string[]; // API legacy
  initialStopIds?: string | string[]; // Nouvelle API
  routeId?: string;
  directionId?: number | null;
  limit?: number;
  refreshInterval?: number;
  showTitle?: boolean;
  displayMode?: "auto" | "table" | "cards";
  onStopIdsChange?: (stopIds: string[]) => void;
  enableStopSelector?: boolean; // Permet de désactiver le sélecteur
}

// Composant de popup pour la sélection d'arrêts
const StopSelector = ({ 
  isOpen, 
  onClose, 
  selectedStops, 
  onStopIdsChange 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  selectedStops: StopData[]; 
  onStopIdsChange: (stops: StopData[]) => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<StopData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStopsList, setSelectedStopsList] = useState<StopData[]>(selectedStops);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Focaliser l'input de recherche quand la popup s'ouvre
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);
  
  // Recherche d'arrêts via API
  const searchStops = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/gtfs/stops/search?q=${encodeURIComponent(term)}`);
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error("Erreur lors de la recherche d'arrêts:", err);
      setError("Impossible de rechercher des arrêts");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Recherche avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchStops(searchTerm);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // Ajouter un arrêt à la sélection
  const addStop = (stop: StopData) => {
    // Vérifier si l'arrêt est déjà sélectionné
    if (!selectedStopsList.some(s => s.id === stop.id)) {
      const newSelection = [...selectedStopsList, stop];
      setSelectedStopsList(newSelection);
    }
  };
  
  // Supprimer un arrêt de la sélection
  const removeStop = (stopId: string) => {
    const newSelection = selectedStopsList.filter(s => s.id !== stopId);
    setSelectedStopsList(newSelection);
  };
  
  // Valider la sélection
  const confirmSelection = () => {
    onStopIdsChange(selectedStopsList);
    onClose();
  };
  
  // Si la popup n'est pas ouverte, ne rien afficher
  if (!isOpen) return null;
  
  return (
    <div className={styles.stopSelectorOverlay}>
      <div className={styles.stopSelectorModal}>
        <div className={styles.stopSelectorHeader}>
          <h3>Sélectionner des arrêts</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={16} />
          </button>
        </div>
        
        <div className={styles.stopSelectorContent}>
          {/* Section de recherche */}
          <div className={styles.searchContainer}>
            <div className={styles.searchInputWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input 
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un arrêt..."
                className={styles.searchInput}
              />
              {searchTerm && (
                <button 
                  className={styles.clearSearchButton}
                  onClick={() => setSearchTerm("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          
          {/* Liste des arrêts sélectionnés */}
          <div className={styles.selectedStopsContainer}>
            <h4>Arrêts sélectionnés ({selectedStopsList.length})</h4>
            {selectedStopsList.length === 0 ? (
              <div className={styles.noStopsSelected}>
                Aucun arrêt sélectionné
              </div>
            ) : (
              <div className={styles.selectedStopsList}>
                {selectedStopsList.map(stop => (
                  <div key={stop.id} className={styles.selectedStopItem}>
                    <div className={styles.selectedStopName}>
                      <MapPin size={14} className={styles.stopIcon} />
                      {stop.name}
                      {stop.code && <span className={styles.stopCode}> ({stop.code})</span>}
                    </div>
                    <button 
                      className={styles.removeStopButton}
                      onClick={() => removeStop(stop.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Résultats de recherche */}
          {searchTerm && (
            <div className={styles.searchResultsContainer}>
              <h4>Résultats de recherche</h4>
              
              {isSearching ? (
                <div className={styles.searchingIndicator}>
                  <div className={styles.smallSpinner}></div>
                  Recherche en cours...
                </div>
              ) : error ? (
                <div className={styles.searchError}>{error}</div>
              ) : searchResults.length === 0 ? (
                <div className={styles.noSearchResults}>
                  Aucun résultat trouvé pour "{searchTerm}"
                </div>
              ) : (
                <div className={styles.searchResultsList}>
                  {searchResults.map(stop => {
                    const isAlreadySelected = selectedStopsList.some(s => s.id === stop.id);
                    return (
                      <div 
                        key={stop.id} 
                        className={`${styles.searchResultItem} ${isAlreadySelected ? styles.alreadySelected : ''}`}
                      >
                        <div className={styles.stopSearchInfo}>
                          <MapPin size={14} className={styles.stopIcon} />
                          {stop.name}
                          {stop.code && <span className={styles.stopCode}> ({stop.code})</span>}
                        </div>
                        <button 
                          className={styles.addStopButton}
                          onClick={() => addStop(stop)}
                          disabled={isAlreadySelected}
                        >
                          {isAlreadySelected ? 'Ajouté' : <Plus size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className={styles.stopSelectorFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            Annuler
          </button>
          <button 
            className={styles.confirmButton} 
            onClick={confirmSelection}
          >
            Valider ({selectedStopsList.length} arrêt{selectedStopsList.length !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
};

const NextDepartures: React.FC<NextDeparturesProps> = ({
  stopId,
  initialStopIds,
  routeId,
  directionId,
  limit = 10,
  refreshInterval = 60000,
  showTitle = true,
  displayMode = "auto",
  onStopIdsChange,
  enableStopSelector = true,
}) => {
  // Conversion des stopIds fournis en tableau
  // Priorité à initialStopIds, fallback sur stopId pour la rétrocompatibilité
  const getInitialStopIds = (): string[] => {
    const idSource = initialStopIds !== undefined ? initialStopIds : stopId;
    if (!idSource) return [];
    return Array.isArray(idSource) ? idSource : [idSource];
  };

  const [stopIds, setStopIds] = useState<string[]>(getInitialStopIds());
  const [stopDetails, setStopDetails] = useState<StopData[]>([]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  
  const [departures, setDepartures] = useState<NextDepartureData[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">(
    displayMode === "auto" ? "table" : displayMode
  );
  const [stopNames, setStopNames] = useState<string[]>([]);

  // Effet pour mettre à jour les stopIds si les props changent (pour le mode contrôlé)
  useEffect(() => {
    const newStopIds = getInitialStopIds();
    // Seulement si les IDs ont changé et que ce n'est pas juste une initialisation
    if (JSON.stringify(newStopIds) !== JSON.stringify(stopIds)) {
      setStopIds(newStopIds);
    }
  }, [stopId, initialStopIds]);

  // Récupérer les détails des arrêts
  useEffect(() => {
    const fetchStopDetails = async () => {
      if (stopIds.length === 0) {
        setStopDetails([]);
        return;
      }
      
      try {
        const queries = stopIds.map(id => `id=${encodeURIComponent(id)}`).join('&');
        const response = await fetch(`/api/gtfs/stops/details?${queries}`);
        
        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`);
        }
        
        const data = await response.json();
        setStopDetails(data);
      } catch (err) {
        console.error("Erreur lors de la récupération des détails d'arrêts:", err);
        // Ne pas modifier les détails existants en cas d'erreur
      }
    };
    
    fetchStopDetails();
  }, [stopIds]);
  
  // Mettre à jour le parent si le callback existe
  useEffect(() => {
    if (onStopIdsChange) {
      onStopIdsChange(stopIds);
    }
  }, [stopIds, onStopIdsChange]);

  // Détecter la taille de l'écran pour le mode responsive
  useEffect(() => {
    if (displayMode === "auto") {
      const handleResize = () => {
        setViewMode(window.innerWidth < 768 ? "cards" : "table");
      };

      // Définir le mode initial
      handleResize();

      // Ajouter l'écouteur d'événement
      window.addEventListener("resize", handleResize);

      // Nettoyer l'écouteur d'événement
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    } else {
      setViewMode(displayMode);
    }
  }, [displayMode]);

  const fetchDepartures = async () => {
    if (stopIds.length === 0) {
      setDepartures([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);

      let url = "/api/gtfs/departures/next?limit=" + limit;

      // Ajouter les stopIds à l'URL
      stopIds.forEach(id => {
        url += "&stopId=" + encodeURIComponent(id);
      });

      // Ajouter les autres paramètres
      if (routeId) url += "&routeId=" + encodeURIComponent(routeId);
      if (directionId !== undefined && directionId !== null)
        url += "&directionId=" + directionId;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Ajuster les heures en fonction du fuseau horaire local
      const adjustedData = data.map((departure: NextDepartureData) => {
        return {
          ...departure,
          formattedScheduled: departure.scheduledTime
            ? new Date(departure.scheduledTime).toLocaleTimeString("fr-FR")
            : null,
          formattedEstimated: departure.estimatedTime
            ? new Date(departure.estimatedTime).toLocaleTimeString("fr-FR")
            : null,
        };
      });

      // Extraire les noms d'arrêts uniques
      const uniqueStopNames = [...new Set<string>(adjustedData.map((d: NextDepartureData) => d.stop.name))];
      setStopNames(uniqueStopNames);

      setDepartures(adjustedData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Erreur lors du chargement des prochains départs:", err);
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour calculer et formater le temps restant
  const calculateCountdown = useCallback((estimatedTime: string | null): string => {
    if (!estimatedTime) return "--:--";
    
    const now = new Date();
    const estimated = new Date(estimatedTime);
    const diffMs = estimated.getTime() - now.getTime();
    
    // Si le départ est passé, afficher +xx:xx pour indiquer le temps écoulé depuis le départ
    if (diffMs < 0) {
      const elapsedMs = Math.abs(diffMs);
      const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
      const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
      
      // Format +hh:mm:ss ou +mm:ss
      if (hours > 0) {
        return `+${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        return `+${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    // Calculer heures, minutes, secondes pour le temps restant
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    // Format (hh:)mm:ss - heures seulement si > 0
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }, []);

  // Mettre à jour tous les comptes à rebours chaque seconde
  useEffect(() => {
    // Fonction pour mettre à jour tous les comptes à rebours
    const updateAllCountdowns = () => {
      const newCountdowns: Record<string, string> = {};
      
      departures.forEach((departure) => {
        const key = `${departure.tripId}-${departure.stop.id}-${departure.line.id}`;
        newCountdowns[key] = calculateCountdown(departure.estimatedTime);
      });
      
      setCountdowns(newCountdowns);
    };
    
    // Mettre à jour immédiatement
    updateAllCountdowns();
    
    // Puis mettre à jour toutes les secondes
    const intervalId = setInterval(updateAllCountdowns, 1000);
    
    // Nettoyer l'intervalle à la fin
    return () => clearInterval(intervalId);
  }, [departures, calculateCountdown]);

  // Charger les départs lors de l'initialisation et après chaque changement de filtres
  useEffect(() => {
    fetchDepartures();

    // Configurer la mise à jour périodique
    const interval = setInterval(fetchDepartures, refreshInterval);

    // Nettoyer l'intervalle lors du démontage
    return () => clearInterval(interval);
  }, [stopIds, routeId, directionId, limit, refreshInterval]);

  // Formatter le retard pour l'affichage
  const formatDelay = (seconds: number | null) => {
    if (seconds === null) return "";

    if (seconds === 0) return "À l'heure";

    const absDelay = Math.abs(seconds);

    if (absDelay < 60) {
      return seconds > 0 ? `Retard de ${absDelay}s` : `Avance de ${absDelay}s`;
    }

    const minutes = Math.floor(absDelay / 60);
    const remainingSeconds = absDelay % 60;

    if (remainingSeconds === 0) {
      return seconds > 0
        ? `Retard de ${minutes}min`
        : `Avance de ${minutes}min`;
    } else {
      return seconds > 0
        ? `Retard de ${minutes}min ${remainingSeconds}s`
        : `Avance de ${minutes}min ${remainingSeconds}s`;
    }
  };

  // Déterminer la classe CSS pour le retard
  const getDelayClass = (delay: number | null) => {
    if (delay === null) return "";
    if (delay === 0) return styles.onTime;
    if (delay > 0) return styles.late;
    return styles.early;
  };

  // Générer une clé unique pour chaque départ
  const getCountdownKey = (departure: NextDepartureData, index: number) => {
    return `${departure.tripId}-${departure.stop.id}-${departure.line.id}`;
  };

  // Dé-duplication des départs avant le rendu
  const uniqueDepartures = React.useMemo(() => {
    // Utiliser un Map pour éliminer les doublons
    const uniqueMap = new Map();

    departures.forEach((departure, index) => {
      // Créer une clé basée sur les données pertinentes
      const key = `${departure.tripId}-${departure.stop.id}-${departure.line.id}-${departure.formattedEstimated}`;

      // Ne garder que la première occurrence
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...departure, _index: index });
      }
    });

    // Convertir le Map en tableau
    return Array.from(uniqueMap.values());
  }, [departures]);

  // Génère une clé unique garantie pour chaque départ
  const generateUniqueKey = (departure: any, index: number) => {
    // Utiliser l'index original et un index secondaire pour garantir l'unicité absolue
    return `idx-${departure._index}-${index}`;
  };
  
  // Gérer les modifications de la sélection d'arrêts
  const handleStopSelection = (selectedStops: StopData[]) => {
    const newStopIds = selectedStops.map(stop => stop.id);
    setStopIds(newStopIds);
  };

  // Rendu du tableau pour desktop
  const renderTable = () => (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ligne</th>
            {/* Toujours afficher l'arrêt quand on a plusieurs stopId */}
            {(stopIds.length !== 1) && <th>Arrêt</th>}
            <th>Direction</th>
            <th>Retard</th>
            <th>ETA</th>
          </tr>
        </thead>
        <tbody>
          {uniqueDepartures.map((departure, index) => (
            <tr key={generateUniqueKey(departure, index)}>
              <td className={styles.lineColumn}>
                <div
                  className={styles.lineNumber}
                  style={{
                    backgroundColor: departure.line.color || "#666",
                    color: isLightColor(departure.line.color) ? "#000" : "#fff",
                  }}
                >
                  {departure.line.number}
                </div>
              </td>
              {(stopIds.length !== 1) && (
                <td className={styles.stopColumn}>{departure.stop.name}</td>
              )}
              <td
                className={styles.directionColumn}
                title={departure.direction.headsign}
              >
                {truncateText(departure.direction.headsign, 20)}
              </td>
              <td
                className={`${styles.delayColumn} ${getDelayClass(
                  departure.delay
                )}`}
              >
                {formatDelay(departure.delay)}
              </td>
              <td className={`${styles.timeColumn} ${getCountdownClass(countdowns[getCountdownKey(departure, index)])}`}>
                {countdowns[getCountdownKey(departure, index)] || calculateCountdown(departure.estimatedTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
  // Fonction pour déterminer la classe CSS basée sur le compte à rebours
  function getCountdownClass(countdown: string | undefined): string {
    if (!countdown) return "";
    
    // Si c'est un départ passé (format +xx:xx)
    if (countdown.startsWith('+')) return styles.late;
    
    // Si le format est HH:MM:SS ou MM:SS
    const parts = countdown.split(':');
    let minutes = 0;
    
    if (parts.length === 3) {
      // format HH:MM:SS
      minutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 2) {
      // format MM:SS
      minutes = parseInt(parts[0]);
    }
    
    if (minutes <= 2) return styles.late;
    if (minutes <= 5) return styles.early;
    return styles.onTime;
  }

  // Rendu des cartes pour mobile
  const renderCards = () => (
    <div className={styles.cardsContainer}>
      {uniqueDepartures.map((departure, index) => (
        <div
          key={generateUniqueKey(departure, index)}
          className={styles.departureCard}
        >
          <div className={styles.cardHeader}>
            <div
              className={styles.cardLineNumber}
              style={{
                backgroundColor: departure.line.color || "#666",
                color: isLightColor(departure.line.color) ? "#000" : "#fff",
              }}
            >
              {departure.line.number}
            </div>

            <div className={styles.cardTimeInfo}>
              <div className={`${styles.estimatedTime} ${getCountdownClass(countdowns[getCountdownKey(departure, index)])}`}>
                {countdowns[getCountdownKey(departure, index)] || calculateCountdown(departure.estimatedTime)}
              </div>
            </div>
          </div>

          <div className={styles.cardDetails}>
            {(stopIds.length !== 1) && (
              <div className={styles.cardStop}>
                <MapPin size={14} className={styles.cardIcon} />
                {departure.stop.name}
              </div>
            )}

            <div className={styles.cardDirection}>
              <Bus size={14} className={styles.cardIcon} />
              {departure.direction.headsign}
            </div>

            <div
              className={`${styles.cardDelay} ${getDelayClass(
                departure.delay
              )}`}
            >
              {formatDelay(departure.delay)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Créer l'affichage des noms d'arrêts dans le titre
  const renderStopNames = () => {
    // Si aucun nom d'arrêt, retourner une chaîne vide
    if (stopNames.length === 0) return "";
    
    // Si un seul arrêt, afficher son nom
    if (stopNames.length === 1) return `Arrêt: ${stopNames[0]}`;
    
    // Si 2 ou 3 arrêts, les afficher tous
    if (stopNames.length <= 3) return `Arrêts: ${stopNames.join(", ")}`;
    
    // Si plus de 3 arrêts, montrer les 2 premiers et le nombre total
    return `Arrêts: ${stopNames[0]}, ${stopNames[1]} et ${stopNames.length - 2} autres`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {showTitle && (
          <div className={styles.titleContainer}>
            <h3 className={styles.title}>
              Prochains départs
              {stopIds.length > 0 && departures.length > 0 && (
                <span className={styles.subtitle}>
                  {renderStopNames()}
                </span>
              )}
            </h3>
            {enableStopSelector && (
              <button 
                className={styles.selectStopsButton}
                onClick={() => setIsSelectorOpen(true)}
                title="Sélectionner des arrêts"
              >
                <Settings size={16} />
              </button>
            )}
          </div>
        )}

        <div className={styles.headerActions}>
          {/* Toggle optionnel pour basculer manuellement entre les vues */}
          {displayMode === "auto" && (
            <button
              onClick={() =>
                setViewMode(viewMode === "table" ? "cards" : "table")
              }
              className={styles.toggleButton}
              title={viewMode === "table" ? "Vue cartes" : "Vue tableau"}
            >
              {viewMode === "table" ? "Cartes" : "Tableau"}
            </button>
          )}

          <button
            onClick={fetchDepartures}
            className={styles.refreshButton}
            disabled={loading}
            title="Rafraîchir les données"
          >
            <RefreshCw size={16} className={loading ? styles.spinning : ""} />
          </button>
        </div>
      </div>

      {/* Message pour inviter à sélectionner des arrêts quand aucun n'est sélectionné */}
      {stopIds.length === 0 ? (
        <div className={styles.noStopsSelected}>
          <p>Aucun arrêt sélectionné</p>
          {enableStopSelector && (
            <button 
              className={styles.selectFirstStopButton}
              onClick={() => setIsSelectorOpen(true)}
            >
              Sélectionner des arrêts
            </button>
          )}
        </div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : loading && departures.length === 0 ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Chargement des prochains départs...</span>
        </div>
      ) : departures.length === 0 ? (
        <div className={styles.noData}>Aucun départ prévu pour le moment</div>
      ) : (
        <>
          {viewMode === "table" ? renderTable() : renderCards()}

          {lastUpdated && (
            <div className={styles.lastUpdated}>
              <Clock size={12} />
              <span>Actualisé à {lastUpdated.toLocaleTimeString("fr-FR")}</span>
            </div>
          )}
        </>
      )}
      
      {/* Popup de sélection d'arrêts */}
      {enableStopSelector && (
        <StopSelector 
          isOpen={isSelectorOpen}
          onClose={() => setIsSelectorOpen(false)}
          selectedStops={stopDetails}
          onStopIdsChange={handleStopSelection}
        />
      )}
    </div>
  );
};

// Fonction pour tronquer le texte avec des points de suspension
function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Fonction utilitaire pour déterminer si une couleur est claire
function isLightColor(color: string | null): boolean {
  if (!color) return false;

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

export default NextDepartures;