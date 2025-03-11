'use client';

import { useState, useEffect } from 'react';
import styles from '../layout.module.css';
import { BarChart3, ArrowLeftRight, AlertCircle } from 'lucide-react';

interface RouteStats {
  id: string;
  number: string;
  name: string;
  color: string;
  avgDelay: number;
  punctualityRate: number;
  observations: number;
}

interface ComparisonData {
  routes: RouteStats[];
  periodTypes: string[];
  weekdays: string[];
}

export default function ComparaisonPage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<ComparisonData | null>(null);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [comparisonType, setComparisonType] = useState<'lines' | 'weekdays' | 'periods'>('lines');

  useEffect(() => {
    // Simuler le chargement de données
    setIsLoading(true);
    
    // Dans une vraie application, récupérez ces données depuis une API
    setTimeout(() => {
      setData({
        routes: [
          { id: '1', number: '1', name: 'Mosson ↔ Odysseum', color: '#8BC53F', avgDelay: 32.4, punctualityRate: 78.5, observations: 45872 },
          { id: '2', number: '2', name: 'Jacou ↔ St-Jean-de-Védas Centre', color: '#CE7D37', avgDelay: 41.3, punctualityRate: 72.1, observations: 42156 },
          { id: '3', number: '3', name: 'Juvignac ↔ Pérols Etang de l\'Or', color: '#8F61AA', avgDelay: 38.7, punctualityRate: 75.3, observations: 38941 },
          { id: '4', number: '4', name: 'Albert 1er ↔ Médiathèque Garcia Lorca', color: '#AD0B32', avgDelay: 59.2, punctualityRate: 64.8, observations: 28756 },
          { id: '6', number: '6', name: 'Euromédecine ↔ Pas du Loup', color: '#0075BF', avgDelay: 45.6, punctualityRate: 70.2, observations: 25483 }
        ],
        periodTypes: ['Heures de pointe', 'Heures creuses', 'Soirée', 'Week-end'],
        weekdays: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
      });
      setSelectedRoutes(['1', '3']);
      setIsLoading(false);
    }, 1500);
  }, []);

  const handleRouteToggle = (routeId: string) => {
    setSelectedRoutes(prev => 
      prev.includes(routeId) 
        ? prev.filter(id => id !== routeId) 
        : [...prev, routeId]
    );
  };

  const handleComparisonTypeChange = (type: 'lines' | 'weekdays' | 'periods') => {
    setComparisonType(type);
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.sectionTitle}>Comparaison de performances</h2>
        <div className={styles.actionButtons}>
          <button 
            className={`${styles.actionButton} ${comparisonType === 'lines' ? styles.activeButton : ''}`}
            onClick={() => handleComparisonTypeChange('lines')}
          >
            Par ligne
          </button>
          <button 
            className={`${styles.actionButton} ${comparisonType === 'weekdays' ? styles.activeButton : ''}`}
            onClick={() => handleComparisonTypeChange('weekdays')}
          >
            Par jour
          </button>
          <button 
            className={`${styles.actionButton} ${comparisonType === 'periods' ? styles.activeButton : ''}`}
            onClick={() => handleComparisonTypeChange('periods')}
          >
            Par période
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Chargement des données comparatives...</p>
        </div>
      ) : (
        <>
          {comparisonType === 'lines' && (
            <div className={styles.comparisonContainer}>
              <div className={styles.selectionPanel}>
                <h3 className={styles.selectionTitle}>Sélectionner des lignes</h3>
                <div className={styles.selectionList}>
                  {data?.routes.map(route => (
                    <div 
                      key={route.id}
                      className={`${styles.selectionItem} ${selectedRoutes.includes(route.id) ? styles.selectedItem : ''}`}
                      onClick={() => handleRouteToggle(route.id)}
                    >
                      <div 
                        className={styles.colorDot}
                        style={{ backgroundColor: route.color }}
                      ></div>
                      <span className={styles.itemLabel}>Ligne {route.number}</span>
                      <span className={styles.itemSublabel}>{route.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className={styles.comparisonCharts}>
                <div className={`${styles.card} ${styles.gridFull}`}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <BarChart3 size={18} />
                      Comparaison de retards par ligne
                    </h3>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.chartPlaceholder}>
                      {selectedRoutes.length > 0 ? (
                        <p className={styles.placeholderText}>
                          Graphique comparatif des retards moyens pour les lignes sélectionnées : 
                          {selectedRoutes.map(id => {
                            const route = data?.routes.find(r => r.id === id);
                            return route ? ` Ligne ${route.number}` : '';
                          }).join(', ')}
                        </p>
                      ) : (
                        <div className={styles.noSelectionMessage}>
                          <AlertCircle size={36} />
                          <p>Veuillez sélectionner au moins une ligne pour afficher la comparaison</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className={`${styles.card} ${styles.gridFull}`}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <ArrowLeftRight size={18} />
                      Comparaison de ponctualité par ligne
                    </h3>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.chartPlaceholder}>
                      {selectedRoutes.length > 0 ? (
                        <div className={styles.comparisonTable}>
                          <table className={styles.dataTable}>
                            <thead>
                              <tr>
                                <th>Ligne</th>
                                <th>Retard moyen</th>
                                <th>Ponctualité</th>
                                <th>Observations</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedRoutes.map(id => {
                                const route = data?.routes.find(r => r.id === id);
                                return route ? (
                                  <tr key={route.id}>
                                    <td className={styles.routeCell}>
                                      <div 
                                        className={styles.routeColor} 
                                        style={{ backgroundColor: route.color }}
                                      ></div>
                                      <span>Ligne {route.number}</span>
                                    </td>
                                    <td>{route.avgDelay}s</td>
                                    <td>{route.punctualityRate}%</td>
                                    <td>{route.observations.toLocaleString()}</td>
                                  </tr>
                                ) : null;
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className={styles.noSelectionMessage}>
                          <AlertCircle size={36} />
                          <p>Veuillez sélectionner au moins une ligne pour afficher la comparaison</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {comparisonType === 'weekdays' && (
            <div className={`${styles.card} ${styles.gridFull}`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <BarChart3 size={18} />
                  Comparaison par jour de la semaine
                </h3>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.chartPlaceholder}>
                  <p className={styles.placeholderText}>
                    Graphique de comparaison des performances par jour de la semaine
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {comparisonType === 'periods' && (
            <div className={`${styles.card} ${styles.gridFull}`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <BarChart3 size={18} />
                  Comparaison par période de la journée
                </h3>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.chartPlaceholder}>
                  <p className={styles.placeholderText}>
                    Graphique de comparaison des performances par période (heure de pointe, heure creuse, etc.)
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}