import React from 'react';
import { Heart } from 'lucide-react';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.copyright}>
          <p>&copy; {new Date().getFullYear()} TransportMonitor. Tous droits réservés.</p>
        </div>
        
        <div className={styles.madewith}>
          <p>Réalisé avec <Heart size={14} className={styles.heart} /> par l'équipe technique</p>
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