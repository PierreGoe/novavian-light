/**
 * Store des paramètres de jeu configurables par le joueur.
 * Persisté en localStorage — remplace les variables d'environnement VITE_*
 * pour tout ce qui relève du comportement du jeu (pas du déploiement).
 */

import { reactive, watch } from 'vue'

const STORAGE_KEY = 'novavian-game-settings'

export interface GameSettings {
  // --- Vitesse & moteur ---
  /** Multiplicateur de vitesse globale (1 = normal, 10 = accéléré) */
  gameSpeedMultiplier: number

  // --- Carte & exploration ---
  /** Désactive le brouillard de guerre (toutes les tuiles sont visibles) */
  disableFogOfWar: boolean
  /** Rayon de révélation initial selon le rang du joueur */
  rankRevealRange: number

  // --- Difficulté ennemis ---
  /** Nombre de base d'infanterie dans un village ennemi */
  enemyBaseInfantry: number
  /** Nombre de base d'infanterie dans une forteresse ennemie */
  enemyStrongholdInfantry: number
  /** Active la pression du temps : les villages IA se développent au fil de la mission */
  timePressureEnabled: boolean
  /** Vitesse de montée de la pression (1 = normal ; >1 utile pour tester) */
  timePressureSpeed: number

  // --- Carte & affichage ---
  /** Affiche les zones d'influence des forteresses ennemies (halo rouge) */
  showInfluenceZones: boolean
  /** Vue isométrique de la carte (plateau incliné façon fake 3D) — choix mémorisé du joueur */
  mapIsoView: boolean
  /** Angles de la vue isométrique (deg) : x = inclinaison, z = rotation */
  mapIsoAngles: { x: number; z: number }

  // --- Triches / debug ---
  /** Démarre chaque mission avec 10 000 de chaque ressource */
  cheatResources: boolean
  /** Démarre chaque mission avec 1 000 points de victoire */
  cheatVictoryPoints: boolean
  /** Démarre chaque mission avec 100 fantassins au lieu de la garnison de départ normale */
  cheatStartingGarrison: boolean

  // --- Ressources initiales ---
  /** Ressources disponibles au début de chaque mission */
  initialResources: {
    wood: number
    clay: number
    iron: number
    crop: number
  }
}

const DEFAULT_SETTINGS: GameSettings = {
  gameSpeedMultiplier: 1,
  disableFogOfWar: false,
  rankRevealRange: 10,
  enemyBaseInfantry: 3,
  enemyStrongholdInfantry: 8,
  timePressureEnabled: true,
  timePressureSpeed: 1,
  showInfluenceZones: true,
  mapIsoView: false,
  mapIsoAngles: { x: 55, z: 45 },
  cheatResources: false,
  cheatVictoryPoints: false,
  cheatStartingGarrison: false,
  initialResources: { wood: 200, clay: 200, iron: 100, crop: 150 },
}

function loadSettings(): GameSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/** Objet réactif des paramètres de jeu — importable directement dans les stores et composants. */
export const gameSettings = reactive<GameSettings>(loadSettings())

/** Réinitialise tous les paramètres à leurs valeurs par défaut. */
export const resetGameSettings = () => {
  Object.assign(gameSettings, DEFAULT_SETTINGS)
}

// Persistance automatique à chaque modification
watch(
  gameSettings,
  (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  },
  { deep: true },
)
