# PromptVault

> Base de données de prompts IA — sync multi-appareils, Google Auth, PWA + APK Android

## Fonctionnalités

- **Connexion Google** — un seul compte, tous les appareils
- **Sync automatique** via Firebase Firestore — PC, tablette, téléphone
- **Offline-first** — fonctionne sans connexion, sync au retour online
- **PWA installable** sur mobile et desktop
- **APK Android** générable via Capacitor
- **Interface premium** — recherche instantanée, catégories, tags, favoris

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router) |
| Auth | Firebase Auth (Google OAuth) |
| Base de données | Firestore (sync temps réel) |
| Cache offline | localStorage |
| APK Android | Capacitor 8 |
| UI | Tailwind CSS + Radix UI + Framer Motion |
| Deploy web | Vercel |

## Lancer en développement

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Build APK Android

### Prérequis
- Android Studio installé
- Java 17+

### Étapes

```bash
# 1. Build + sync + ouvre Android Studio
npm run build:apk

# 2. Dans Android Studio :
#    Build > Generate Signed APK
```

## Structure du projet

```
src/
├── app/
│   ├── auth/login/     # Connexion (Google + email/mdp)
│   ├── auth/register/  # Inscription
│   └── dashboard/      # Dashboard principal
├── lib/
│   ├── firebase.ts         # Config Firebase + exports Firestore
│   ├── firestore-sync.ts   # Sync cloud (CRUD Firestore)
│   ├── sync-engine.ts      # Moteur hybride (local + Firestore)
│   └── local-storage.ts    # Cache offline
└── types/
    └── database.ts     # Types TypeScript
```

## Déploiement web (Vercel)

```bash
npx vercel --prod
```

## Versions

- `v0.1.0` — Bootstrap PWA, auth locale
- `v0.2.0` — Firestore sync multi-appareils + Google Auth + Capacitor APK
