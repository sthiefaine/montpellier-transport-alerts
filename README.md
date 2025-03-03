# Montpellier Transport Alerts

Application de suivi des alertes de transport en commun de Montpellier en temps réel, basée sur les données GTFS-RT fournies par Montpellier Méditerranée Métropole.

## Fonctionnalités

- Affichage des alertes de transport en temps réel
- Tableau de bord avec statistiques sur les alertes
- Filtrage des alertes par ligne et par arrêt
- Vue détaillée de chaque alerte
- Mise à jour automatique des données toutes les 5 minutes

## Technologies utilisées

- Next.js 15 (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL
- TailwindCSS
- Recharts pour les graphiques
- SWR pour la gestion des requêtes API
- Vercel pour le déploiement et les tâches CRON

## Prérequis

- Node.js 18.17.0 ou supérieur
- PostgreSQL
- Compte [Vercel](https://vercel.com) (pour le déploiement)

## Installation locale

### 1. Cloner le dépôt

```bash
git clone https://github.com/votre-username/montpellier-alerts-nextjs.git
cd montpellier-alerts-nextjs
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

Copiez le fichier `.env.example` en `.env` et modifiez les variables selon votre configuration :

```bash
cp .env.example .env
```

### 4. Configurer la base de données

```bash
# Créer une base de données PostgreSQL
# Puis générer le client Prisma et les tables
npx prisma generate
npx prisma db push
```

### 5. Exécuter la récupération initiale des alertes

```bash
# Exécuter le script de récupération des alertes
npx tsx src/tasks/fetchAlerts.ts
```

### 6. Démarrer le serveur de développement

```bash
npm run dev
```

L'application sera accessible à l'adresse http://localhost:3000.

### Configurer les variables d'environnement sur Vercel

Dans les paramètres du projet sur Vercel, ajoutez les variables d'environnement suivantes :

- `DATABASE_URL` : URL de connexion à votre base de données PostgreSQL
- `ALERT_URL` : URL du fichier GTFS-RT des alertes
- `CRON_SECRET` : Secret pour sécuriser l'endpoint CRON

Les tâches CRON sont configurées dans le fichier `vercel.json`. Pour qu'elles

## Mises à jour manuelles

Pour mettre à jour manuellement les alertes sans attendre le CRON :

```bash
# En local
npx tsx src/tasks/fetchAlerts.ts

# Sur l'application déployée
curl -X GET https://votre-app.vercel.app/api/cron -H "Authorization: Bearer votre_cron_secret"
```

## Licence

Ce projet est sous licence MIT.

## Crédits

Données fournies par [Montpellier Méditerranée Métropole](https://data.montpellier3m.fr/dataset/offre-de-transport-tam-en-temps-reel).
