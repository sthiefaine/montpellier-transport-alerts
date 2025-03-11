'use client';

import { useState, useEffect } from 'react';
import styles from '../layout.module.css';
import { TrendingUp, CalendarDays, Zap, Filter } from 'lucide-react';

interface TrendData {
  date: string;
  avgDelay: number;
  punctualityRate: number;
  totalObservations: number;
}

interface RouteOption {
  id: string;
  number: string;
  name: string;
}

export default function TendancesPage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<TrendData[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>('all');
  const [trendPeriod, setTrendPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [metricType, setMetricType] = useState<'delay' | 'punctuality' | 'observations'>('delay');

  useEffect(() => {
    // Simuler le chargement de données
    setIsLoading(true);
    
    // Dans une vraie application, chargez les données depuis une API
    setTimeout(() => {
      // Générer des données factices pour 30 jours
      const trendData: TrendData[] = [];
      const now = new Date();
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Ajouter des variations aléatoires mais avec une tendance constante
        const trend = Math.sin(i / 5) * 10; // Simulation d'une tendance sinusoïdale
        
        trendData.push({
          date: dateStr,
          avgDelay: 40 + trend + (Math.random() * 10 - 5),
          punctualityRate: 70 + trend / 3 + (Math.random() * 5 - 2.5),
          totalObservations: 5000 + (Math.random() * 1000 - 500)
        });
      }
      
      setData(trendData);
      setRoutes([
        { id: 'all', number: 'Toutes', name: 'Toutes les lignes' },
        { id: '1', number: '1', name: 'Mosson ↔ Odysseum' },
        { id: '2', number: '2', name: 'Jacou ↔ St-Jean-de-Védas Centre' },
        { id: '3', number: '3', name: 'Juvignac ↔ Pérols Etang de l\'Or' },
        { id: '4', number: '4', name: 'Albert 1er ↔ Médiathèque Garcia Lorca' }
      ]);
      setIsLoading(false);
    }, 1500);
  }, []);

  const getTrendPercentage = (): { value: number, increase: boolean } => {
    if (data.length < 2) return { value: 0, increase: true };
    
    const firstValue = data[0][metricType === 'delay' ? 'avgDelay' : metricType === 'punctuality' ? 'punctualityRate' : 'totalObservations'];
    const lastValue = data[data.length - 1][metricType === 'delay' ? 'avgDelay' : metricType === 'punctuality' ? 'punctualityRate' : 'totalObservations'];
    
    const percentChange = ((lastValue - firstValue) / firstValue) * 100;
    const increase = metricType === 'delay' ? percentChange > 0 : percentChange < 0;
    
    // Pour le retard, une augmentation est négative, pour les autres c'est positif
    return { 
      value: Math.abs(percentChange).toFixed(1) as unknown as number, 
      increase: metricType === 'delay' ? !increase : increase 
    };
  };

  const trendInfo = getTrendPercentage();

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.sectionTitle}>Analyse des tendances</h2>
        
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label htmlFor="route-select">Ligne :</label>
            <select 
              id="route-select"
              className={styles.select}
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
            >
              {routes.map(route => (
                <option key={route.id} value={route.id}>
                  {route.number === 'Toutes' ? 'Toutes les lignes' : `Ligne ${route.number}`}
                </option>
              ))}
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="period-select">Période :</label>
            <div className={styles.segmentedControl}>
              <button 
                className={`${styles.segmentButton} ${trendPeriod === 'daily' ? styles.activeSegment : ''}`}
                onClick={() => setTrendPeriod('daily')}
              >
                Journalier
              </button>
              <button 
                className={`${styles.segmentButton} ${trendPeriod === 'weekly' ? styles.activeSegment : ''}`}
                onClick={() => setTrendPeriod('weekly')}
              >
                Hebdomadaire
              </button>
              <button 
                className={`${styles.segmentButton} ${trendPeriod === 'monthly' ? styles.activeSegment : ''}`}
                onClick={() => setTrendPeriod('monthly')}
              >
                Mensuel
              </button>
            </div>
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="metric-select">Métrique :</label>
            <div className={styles.segmentedControl}>
              <button 
                className={`${styles.segmentButton} ${metricType === 'delay' ? styles.activeSegment : ''}`}
                onClick={() => setMetricType('delay')}
              >
                Retard
              </button>
              <button 
                className={`${styles.segmentButton} ${metricType === 'punctuality' ? styles.activeSegment : ''}`}
                onClick={() => setMetricType('punctuality')}
              >
                Ponctualité
              </button>
              <button 
                className={`${styles.segmentButton} ${metricType === 'observations' ? styles.activeSegment : ''}`}
                onClick={() => setMetricType('observations')}
              >
                Volume
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Chargement des données de tendance...</p>
        </div>
      ) : (
        <>
          <div className={styles.gridLayout}>
            {/* Carte principale de tendance */}
            <div className={`${styles.card} ${styles.gridFull}`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <TrendingUp size={18} />
                  {metricType === 'delay' 
                    ? 'Évolution du retard moyen' 
                    : metricType === 'punctuality' 
                      ? 'Évolution du taux de ponctualité' 
                      : 'Évolution du nombre d\'observations'}
                </h3>
                <div className={styles.trendBadge} data-trend={trendInfo.increase ? 'up' : 'down'}>
                  <TrendingUp size={14} />
                  <span>{trendInfo.value}%</span>
                </div>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.chartPlaceholder}>
                  <p className={styles.placeholderText}>
                    Graphique de tendance montrant l'évolution {metricType === 'delay' 
                      ? 'du retard moyen' 
                      : metricType === 'punctuality' 
                        ? 'du taux de ponctualité' 
                        : 'du nombre d\'observations'} sur 30 jours
                    {selectedRoute !== 'all' ? ` pour la ligne ${routes.find(r => r.id === selectedRoute)?.number}` : ''}
                  </p>
                  <p className={styles.placeholderText}>
                    Dans une application réelle, utilisez des bibliothèques comme Recharts ou D3.js pour créer ce graphique.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Cartes d'analyses spécifiques */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <CalendarDays size={18} />
                  Analyse hebdomadaire
                </h3>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.chartPlaceholder}>
                  <p className={styles.placeholderText}>
                    Distribution par jour de la semaine
                  </p>
                </div>
              </div>
            </div>
            
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Zap size={18} />
                  Pics et événements
                </h3>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.eventList}>
                  <div className={styles.eventItem}>
                    <div className={styles.eventDate}>2023-10-15</div>
                    <div className={styles.eventMarker}></div>
                    <div className={styles.eventDescription}>
                      Pic de retard (+68%) - Conditions météorologiques
                    </div>
                  </div>
                  <div className={styles.eventItem}>
                    <div className={styles.eventDate}>2023-10-10</div>
                    <div className={styles.eventMarker}></div>
                    <div className={styles.eventDescription}>
                      Amélioration significative (-32%) - Nouvelle stratégie
                    </div>
                  </div>
                  <div className={styles.eventItem}>
                    <div className={styles.eventDate}>2023-10-02</div>
                    <div className={styles.eventMarker}></div>
                    <div className={styles.eventDescription}>
                      Perturbation majeure - Travaux sur la ligne
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tableau récapitulatif */}
            <div className={`${styles.card} ${styles.gridFull}`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <Filter size={18} />
                  Récapitulatif par période
                </h3>
              </div>
              <div className={styles.cardContent}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th>Retard moyen</th>
                      <th>Ponctualité</th>
                      <th>Observations</th>
                      <th>Tendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>7 derniers jours</td>
                      <td>42.3s</td>
                      <td>71.8%</td>
                      <td>34,567</td>
                      <td className={styles.trendCell}>
                        <span className={styles.trendIndicator} data-trend="up">↑</span>
                        <span>2.1%</span>
                      </td>
                    </tr>
                    <tr>
                      <td>30 derniers jours</td>
                      <td>38.7s</td>
                      <td>73.5%</td>
                      <td>156,432</td>
                      <td className={styles.trendCell}>
                        <span className={styles.trendIndicator} data-trend="down">↓</span>
                        <span>1.3%</span>
                      </td>
                    </tr>
                    <tr>
                      <td>90 derniers jours</td>
                      <td>41.2s</td>
                      <td>70.2%</td>
                      <td>452,986</td>
                      <td className={styles.trendCell}>
                        <span className={styles.trendIndicator} data-trend="up">↑</span>
                        <span>4.5%</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}