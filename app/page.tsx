import React from "react";
import styles from "./page.module.css";
import Card from "@/app/components/Cards/Card";
import Header from "@/app/components/Header/Header";
import Footer from "@/app/components/Footer/Footer";

import { AlertTriangle, CheckCircle, BarChart2, Clock } from "lucide-react";
const Home = () => {
  const stats = {
    activeAlerts: 12,
    completedAlerts: 45,
    totalAlerts: 57,
    mostCommonType: "Retards importants",
  };

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        <section className={styles.statsSection}>
          <div className={styles.cardGrid}>
            <Card
              title="Alertes actives"
              value={stats.activeAlerts}
              icon={<AlertTriangle size={24} />}
              color="blue"
            />
            <Card
              title="Alertes terminées"
              value={stats.completedAlerts}
              icon={<CheckCircle size={24} />}
              color="green"
            />
            <Card
              title="Total alertes"
              value={stats.totalAlerts}
              icon={<BarChart2 size={24} />}
              color="yellow"
            />
            <Card
              title="Type le plus courant (toutes)"
              value={stats.mostCommonType}
              icon={<Clock size={24} />}
              color="red"
            />
          </div>
        </section>

        {/* Additional dashboard content will go here in the future */}
      </main>
      <Footer />
    </div>
  );
};

export default Home;
