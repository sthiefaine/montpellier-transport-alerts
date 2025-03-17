import { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";
import AlertsContainer from "@/components/Alerts/AlertsContainer";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Alertes de transport en cours - Transport Montpellier",
  description:
    "Consultez les alertes actives et passées sur le réseau de transport de Montpellier",
};

export default async function AlertesPage() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={20} />
            <span>Retour à l'accueil</span>
          </Link>
          <h1 className={styles.title}>Alertes de transport</h1>
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.alertsContainer}>
            <Suspense>
              <AlertsContainer />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
