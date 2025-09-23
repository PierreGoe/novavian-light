# MiniTravianVue

## Description

MiniTravianVue est un prototype de jeu de stratégie inspiré de Travian, entièrement développé en front-end avec Vue.js, HTML/CSS et animations simples.
L'objectif est de tester et expérimenter les mécaniques de gameplay sans backend ni multijoueur. Ce projet est pensé comme un terrain d'expérimentation pour des développeurs souhaitant explorer la logique d'un jeu de stratégie dans le navigateur.

---

## Objectifs

- Permettre au joueur de créer une partie et de choisir sa "race".
- Développer un arbre de missions pour guider les décisions du joueur.
- Implémenter une version simplifiée d'une partie type Travian (ressources, constructions, interactions).
- Tester les mécaniques de gameplay et itérer facilement en front-end.

---

## Tech stack

- **Framework** : Vue.js 3 (Composition API)
- **Styles et animations** : HTML/CSS + keyframes et transitions
- **Stockage** : localStorage pour sauvegarde locale des parties
- **Outils** : Vite (ou autre serveur de dev Vue)

---

## Installation

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Ouvrir le navigateur sur <http://localhost:5173> (ou port indiqué par Vite).

---

## Structure du projet (suggestion)

```
src/
├─ components/
│  ├─ HomeScreen.vue        # Écran d'accueil / lancement de partie
│  ├─ RaceSelector.vue      # Sélection de la race du joueur
│  ├─ MissionTree.vue       # Arbre de missions
│  ├─ GameScreen.vue        # Écran de jeu principal
├─ store/                   # État global (Pinia ou reactive)
├─ utils/                   # Fonctions utilitaires (calcul ressources, progression)
└─ App.vue                  # Conteneur principal + router
```

---

## Roadmap / TODO list

### MVP – Écrans de base

1. **Écran d'accueil / lancement de partie**
   - Créer une nouvelle partie
   - Sélection de la race
   - Sauvegarde d'une partie en localStorage

2. **Écran d'arbre de missions**
   - Affichage d'un arbre simplifié avec choix de missions
   - Navigation et transitions entre les nœuds
   - Enregistrement du choix pour la phase de jeu suivante

3. **Écran de jeu simplifié**
   - Affichage des bâtiments, ressources, mini-carte
   - Calcul des ressources par tick ou action
   - Interactions basiques : construire, récolter

### Features supplémentaires / bonus

- Animations CSS pour constructions et mouvements
- Mini tutoriel interactif
- Gestion avancée des sauvegardes (plusieurs parties)
- Effets sonores simples (HTML5 audio)
- UI améliorée (transitions, notifications, responsive desktop)

---

## Contribution

Ce projet est un prototype personnel. Les contributions sont bienvenues pour expérimenter de nouvelles mécaniques, améliorer le gameplay ou l'UI.

---

## Licence

MIT
