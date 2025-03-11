'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';
import { BarChart3, TrendingUp, PieChart, Map, FileText, Layers } from 'lucide-react';

export default function StatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [dateRange, setDateRange] = useState<'7j' | '30j' | '90j' | '365j'>('30j');
  const [compareMode, setCompareMode] = useState<'none' | 'prev-period' | 'prev-year'>('none');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>Statistiques avancées</h1>
          <div className={styles.controls}>
            <div className={styles.controlGroup}>
              <label htmlFor="date-range">Période d'analyse:</label>
              <select 
                id="date-range"
                className={styles.select} 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
              >
                <option value="7j">7 derniers jours</option>
                <option value="30j">30 derniers jours</option>
                <option value="90j">90 derniers jours</option>
                <option value="365j">Dernière année</option>
              </select>
            </div>
            <div className={styles.controlGroup}>
              <label htmlFor="compare-mode">Comparaison:</label>
              <select 
                id="compare-mode"
                className={styles.select} 
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value as any)}
              >
                <option value="none">Aucune</option>
                <option value="prev-period">Période précédente</option>
                <option value="prev-year">Année précédente</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <Link 
              href="/stats" 
              className={`${styles.navLink} ${pathname === '/stats' ? styles.active : ''}`}
            >
              <Layers size={18} />
              <span>Tableau de bord</span>
            </Link>
            <Link 
              href="/stats/comparaison" 
              className={`${styles.navLink} ${pathname === '/stats/comparaison' ? styles.active : ''}`}
            >
              <BarChart3 size={18} />
              <span>Comparaisons</span>
            </Link>
            <Link 
              href="/stats/tendances" 
              className={`${styles.navLink} ${pathname === '/stats/tendances' ? styles.active : ''}`}
            >
              <TrendingUp size={18} />
              <span>Tendances</span>
            </Link>
            <Link 
              href="/stats/distribution" 
              className={`${styles.navLink} ${pathname === '/stats/distribution' ? styles.active : ''}`}
            >
              <PieChart size={18} />
              <span>Distribution</span>
            </Link>
            <Link 
              href="/stats/cartographie" 
              className={`${styles.navLink} ${pathname === '/stats/cartographie' ? styles.active : ''}`}
            >
              <Map size={18} />
              <span>Cartographie</span>
            </Link>
            <Link 
              href="/stats/export" 
              className={`${styles.navLink} ${pathname === '/stats/export' ? styles.active : ''}`}
            >
              <FileText size={18} />
              <span>Export</span>
            </Link>
          </nav>
        </aside>

        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </div>
  );
}