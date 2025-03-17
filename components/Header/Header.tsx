"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Bell, BarChart2, Menu, X, User } from "lucide-react";
import styles from "./Header.module.css";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <Link href="/">
            <div className={styles.logoContent}>
              <BarChart2 size={24} className={styles.logoIcon} />
              <h1>
                Transport<span>Monitor</span>
              </h1>
            </div>
          </Link>
        </div>

        <button
          className={styles.mobileMenuButton}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={styles.userMenu}></div>
      </div>
    </header>
  );
};

export default Header;
