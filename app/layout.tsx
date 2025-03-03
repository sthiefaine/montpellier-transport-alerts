import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import { SWRConfig } from "swr";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Alertes Transport Montpellier',
  description: 'Suivi des alertes de transport en commun à Montpellier',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
<html lang="fr">
      <body>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-grow py-8">
            {children}
          </main>
          <footer className="bg-white py-6 mt-12">
            <div className="container">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="mb-4 md:mb-0">
                  <p className="text-gray-600 text-sm">
                    Données fournies par{' '}
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
                <div className="text-gray-600 text-sm">
                  <p>© {new Date().getFullYear()} Alertes TAM</p>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
