import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tableau de bord des retards - Transport Montpellier',
  description: 'Analyse complète de la ponctualité du réseau de transport en commun de Montpellier',
}

export default function DelayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}