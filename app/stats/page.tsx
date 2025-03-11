'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import layoutStyles from './layout.module.css';
import { BarChart3, TrendingUp, TrendingDown, Clock, CalendarDays, AlertTriangle, FileText, LineChart, Zap } from 'lucide-react';

interface StatsSummary {
  totalObservations: number;
  avgDelay: number;
  maxDelay: number;
  punctualityRate: number;
  earlyRate: number;
  lateRate: number;
  criticalDelays: number;
  mostDelayedRoute: {
    id: string;
    number: string;
    avgDelay: number;
  };
  mostDelayedStop: {
    id: string;
    name: string;
    avgDelay: number;
  };
}

export default function StatsHomePage() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    // Simuler le chargement des données - À remplacer par un appel API réel
    setIsLoading(true);
    
    // Dans une application réelle, vous feriez un appel à l'API ici
    setTimeout(() => {
      setSummary({
        totalObservations: 187652,
        avgDelay: 42.8,
        maxDelay: 412,
        punctualityRate: 68.4,
        earlyRate: 12.3,
        lateRate: 19.3,
        criticalDelays: 215,
        mostDelayedRoute: {
          id: 'route-4',
          number: '4',
          avgDelay: 98.3
        },
        mostDelayedStop: {
          id: 'stop-756',
          name: 'Centre Commercial',
          avgDelay: 153.7
        }
      });
      setIsLoading(false);
    }, 1500);
  }, [timeRange]);

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d') => {
    setTimeRange(range);
  };

  return (
    <div>
      <div className={layoutStyles.pageHeader}>
        <h2 className={layoutStyles.sectionTitle}>Tableau de bord statistique</h2>
        
        <div className={styles.timeRangeSelector}>
          <span className={styles.timeRangeLabel}>Période d'analyse:</span>
          <div className={styles.segmentedControl}>
            <button 
              className={`${styles.filterOption} ${timeRange === '7d' ? styles.filterOptionActive : ''}`}
              onClick={() => handleTimeRangeChange('7d')}
            >
              7 derniers jours
            </button>
            <button 
              className={`${styles.filterOption} ${timeRange === '30d' ? styles.filterOptionActive : ''}`}
              onClick={() => handleTimeRangeChange('30d')}
            >
              30 derniers jours
            </button>
            <button 
              className={`${styles.filterOption} ${timeRange === '90d' ? styles.filterOptionActive : ''}`}
              onClick={() => handleTimeRangeChange('90d')}
            >
              90 derniers jours
            </button>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className={layoutStyles.loadingState}>
          <div className={layoutStyles.spinner}></div>
          <p>Chargement des données statistiques...</p>
        </div>
      ) : (
        <>
          {/* Première rangée - KPIs principaux */}
          <div className={layoutStyles.gridLayout}>
            {/* Carte de taux de ponctualité */}
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <h3 className={styles.metricTitle}>
                  <Clock className={styles.metricIcon} />
                  <span>Taux de ponctualité</span>
                </h3>
                <span className={`${styles.badge} ${styles.badgePrimary}`}>
                  {timeRange === '30d' ? 'Mensuel' : timeRange === '7d' ? 'Hebdomadaire' : 'Trimestriel'}
                </span>
              </div>
              <div className={styles.metricValue}>{summary?.punctualityRate}%</div>
              <div className={`${styles.metricChange} ${styles.metricChangeUp}`}>
                <TrendingUp size={16} />
                <span>+2.3% par rapport à la période précédente</span>
              </div>
              <div className={styles.progressContainer}>
                <div 
                  className={styles.progressBar}
                  style={{ width: `${summary?.punctualityRate}%` }}
                ></div>
              </div>
              <p className={styles.metricDescription}>
                Pourcentage de passages avec moins d'une minute d'écart
              </p>
            </div>

            {/* Carte de retard moyen */}
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <h3 className={styles.metricTitle}>
                  <TrendingUp className={styles.metricIcon} />
                  <span>Retard moyen</span>
                </h3>
                {summary?.avgDelay ? (
                  summary?.avgDelay > 60 ? (
                    <span className={`${styles.badge} ${styles.badgeDanger}`}>Élevé</span>
                  ) : summary?.avgDelay > 30 ? (
                    <span className={`${styles.badge} ${styles.badgeWarning}`}>Modéré</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>Faible</span>
                  )
                ) : (
                  <span className={`${styles.badge} ${styles.badgeSuccess}`}>Faible</span>
                )}
              </div>
              <div className={styles.metricValue}>{summary?.avgDelay}s</div>
              <div className={`${styles.metricChange} ${styles.metricChangeDown}`}>
                <TrendingDown size={16} />
                <span>-1.7s par rapport à la période précédente</span>
              </div>
              <div className={styles.progressContainer}>
                <div 
                  className={`${styles.progressBar} ${styles.progressBarWarning}`}
                  style={{ width: `${Math.min(100, (summary?.avgDelay || 0) / 120 * 100)}%` }}
                ></div>
              </div>
              <p className={styles.metricDescription}>
                Moyenne de tous les retards observés sur la période
              </p>
            </div>
          </div>

          {/* Seconde rangée - Graphiques et analyses */}
          <div className={layoutStyles.gridLayout}>
            {/* Tendances récentes - occuperait toute la largeur */}
            <div className={`${layoutStyles.card} ${layoutStyles.gridFull}`}>
              <div className={layoutStyles.cardHeader}>
                <h3 className={layoutStyles.cardTitle}>
                  <TrendingUp size={18} />
                  <span>Tendances récentes</span>
                </h3>
                <div className={layoutStyles.trendBadge} data-trend="up">
                  <TrendingUp size={14} />
                  <span>+2.3%</span>
                </div>
              </div>
              <div className={layoutStyles.cardContent}>
                <div className={styles.graphContainer}>
                  <div className={styles.graphPlaceholder}>
                    <BarChart3 size={36} color="#6366f1" />
                    <p>Graphique de tendances montrant l'évolution de la ponctualité</p>
                    <p>Dans une application complète, utilisez Recharts pour visualiser ces données</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Troisième rangée - Sections détaillées */}
          <div className={layoutStyles.gridLayout}>
            {/* Points d'attention */}
            <div className={layoutStyles.card}>
              <div className={layoutStyles.cardHeader}>
                <h3 className={layoutStyles.cardTitle}>
                  <AlertTriangle size={18} />
                  <span>Points d'attention</span>
                </h3>
              </div>
              <div className={layoutStyles.cardContent}>
                <div className={styles.highlightBox} style={{marginBottom: '1rem'}}>
                  <h4 className={styles.highlightTitle}>
                    <AlertTriangle size={16} />
                    <span>Ligne la plus retardée</span>
                  </h4>
                  <div className={styles.highlightContent}>
                    <strong>Ligne {summary?.mostDelayedRoute.number}</strong> - Retard moyen de {summary?.mostDelayedRoute.avgDelay}s
                    <div className={styles.sparkline} style={{marginTop: '0.75rem'}}></div>
                  </div>
                </div>
                
                <div className={styles.highlightBox} style={{marginBottom: '1rem'}}>
                  <h4 className={styles.highlightTitle}>
                    <AlertTriangle size={16} />
                    <span>Arrêt problématique</span>
                  </h4>
                  <div className={styles.highlightContent}>
                    <strong>{summary?.mostDelayedStop.name}</strong> - Retard moyen de {summary?.mostDelayedStop.avgDelay}s
                    <div className={styles.sparkline} style={{marginTop: '0.75rem'}}></div>
                  </div>
                </div>
                
                <div className={styles.highlightBox}>
                  <h4 className={styles.highlightTitle}>
                    <CalendarDays size={16} />
                    <span>Journée critique</span>
                  </h4>
                  <div className={styles.highlightContent}>
                    <strong>Lundi</strong> - Retard moyen de 76.3s
                    <div className={styles.sparkline} style={{marginTop: '0.75rem'}}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution des retards */}
            <div className={layoutStyles.card}>
              <div className={layoutStyles.cardHeader}>
                <h3 className={layoutStyles.cardTitle}>
                  <BarChart3 size={18} />
                  <span>Distribution des retards</span>
                </h3>
              </div>
              <div className={layoutStyles.cardContent}>
                <div className={styles.graphContainer}>
                  <div className={styles.graphPlaceholder}>
                    <LineChart size={36} color="#6366f1" />
                    <p>Histogramme montrant la distribution des retards</p>
                  </div>
                </div>
                <div className={styles.dataTableContainer} style={{marginTop: '1.5rem'}}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Plage de retard</th>
                        <th>Proportion</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <span className={`${styles.indicator} ${styles.indicatorSuccess}`}></span>
                          À l'heure (±60s)
                        </td>
                        <td><strong>{summary?.punctualityRate}%</strong></td>
                      </tr>
                      <tr>
                        <td>
                          <span className={`${styles.indicator} ${styles.indicatorWarning}`}></span>
                          Retard léger (60-180s)
                        </td>
                        <td><strong>{Math.round(summary?.lateRate || 0) * 0.7}%</strong></td>
                      </tr>
                      <tr>
                        <td>
                          <span className={`${styles.indicator} ${styles.indicatorDanger}`}></span>
                          Retard important ({'>'}180s)
                        </td>
                        <td><strong>{Math.round(summary?.lateRate || 0) * 0.3}%</strong></td>
                      </tr>
                      <tr>
                        <td>
                          <span className={`${styles.indicator} ${styles.indicatorPrimary}`}></span>
                          En avance
                        </td>
                        <td><strong>{summary?.earlyRate}%</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quatrième rangée - Synthèse et actions */}
          <div className={layoutStyles.gridFull}>
            <div className={styles.featureBlock}>
              <div className={styles.featureIcon}>
                <Zap size={24} />
              </div>
              <div className={styles.featureContent}>
                <h3 className={styles.featureTitle}>Améliorer la ponctualité</h3>
                <p className={styles.featureDescription}>
                  Nos analyses montrent que les retards sont principalement concentrés sur certaines lignes et certains créneaux horaires. Une optimisation de la régulation du trafic pourrait améliorer la ponctualité de 15% sans ressources supplémentaires.
                </p>
              </div>
            </div>
          </div>
          
          <div className={layoutStyles.gridLayout}>
            <div className={styles.featureBlock}>
              <div className={styles.featureIcon}>
                <FileText size={24} />
              </div>
              <div className={styles.featureContent}>
                <h3 className={styles.featureTitle}>Rapport détaillé</h3>
                <p className={styles.featureDescription}>
                  Pour une analyse plus approfondie, consultez le rapport complet ou exportez les données brutes via la section Export.
                </p>
              </div>
            </div>
            
            <div className={styles.featureBlock}>
              <div className={styles.featureIcon}>
                <CalendarDays size={24} />
              </div>
              <div className={styles.featureContent}>
                <h3 className={styles.featureTitle}>Prévisions</h3>
                <p className={styles.featureDescription}>
                  Les tendances actuelles indiquent une amélioration constante de la ponctualité pour les prochaines semaines.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}