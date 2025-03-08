import React from "react";
import styles from "./Footer.module.css";

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.copyright}>
          <p>&copy; {new Date().getFullYear()} TransportMonitor.</p>
        </div>

        <div className={styles.madewith}>
          <p className="text-gray-600 text-sm">
            Données fournies par{" "}
            <a
              href="https://data.montpellier3m.fr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Montpellier Méditerranée Métropole
            </a>
          </p>
        </div>

        <div className={styles.links}>
          <a href="/mentions-legales">Mentions légales</a>
          <a href="/confidentialite">Confidentialité</a>
          <a href="/contact">Contact</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
