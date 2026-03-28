// ============================================================
// Configuration centralisée
// ============================================================
// Toutes les variables d'environnement passent par ici.
// Les composants et stores n'importent jamais import.meta.env
// directement — ils importent depuis ce fichier.
//
// Ajouter une variable :
//   1. La déclarer dans .env.development et .env.production
//   2. L'ajouter dans ImportMetaEnv (env.d.ts)
//   3. L'exposer ici avec sa valeur par défaut + son type
// ============================================================

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

// ------------------------------------
// Temps de jeu
// ------------------------------------

/** Crédit offline maximum par tick (ms). 0 = le jeu se fige hors-ligne. */
export const MAX_OFFLINE_MS = parseNumber(import.meta.env.VITE_MAX_OFFLINE_MS, 0)

// ------------------------------------
// Combat
// ------------------------------------

/** Nombre de base d'infanterie dans un village ennemi standard */
export const ENEMY_BASE_INFANTRY = parseNumber(import.meta.env.VITE_ENEMY_BASE_INFANTRY, 3)

/** Nombre de base d'infanterie dans une forteresse ennemie */
export const ENEMY_STRONGHOLD_INFANTRY = parseNumber(
  import.meta.env.VITE_ENEMY_STRONGHOLD_INFANTRY,
  8,
)

// ------------------------------------
// Éclaireurs
// ------------------------------------

/** Vitesse de déplacement des éclaireurs en cases/seconde */
export const SCOUT_MOVE_SPEED_TPS = parseNumber(import.meta.env.VITE_SCOUT_MOVE_SPEED_TPS, 3)

// ------------------------------------
// Déplacement & temps de voyage
// ------------------------------------

/** Multiplicateur de vitesse globale du jeu (1 = normal, 10 = accéléré en dev) */
export const GAME_SPEED_MULTIPLIER = parseNumber(import.meta.env.VITE_GAME_SPEED_MULTIPLIER, 1)

// ------------------------------------
// Sauvegarde & timers
// ------------------------------------

/** Intervalle d'auto-save (ms) */
export const AUTOSAVE_INTERVAL_MS = parseNumber(import.meta.env.VITE_AUTOSAVE_INTERVAL_MS, 30_000)

/** Intervalle de mise à jour de la production (ms) */
export const PRODUCTION_INTERVAL_MS = parseNumber(
  import.meta.env.VITE_PRODUCTION_INTERVAL_MS,
  60_000,
)

// ------------------------------------
// Débogage / outils de développement
// ------------------------------------

/** Désactive le brouillard de guerre — toutes les tuiles apparaissent comme explorées */
export const DISABLE_FOG_OF_WAR = import.meta.env.VITE_DISABLE_FOG_OF_WAR === 'true'

/** Donne 10 000 de chaque ressource au démarrage d’une mission (debug uniquement) */
export const CHEAT_RESOURCES = import.meta.env.VITE_CHEAT_RESOURCES === 'true'

/** Donne 1 000 points de victoire au démarrage d’une mission (debug uniquement) */
export const CHEAT_VICTORY_POINTS = import.meta.env.VITE_CHEAT_VICTORY_POINTS === 'true'

// ------------------------------------
// Meta
// ------------------------------------

export const APP_ENV = import.meta.env.VITE_APP_ENV ?? 'development'
export const IS_DEV = APP_ENV === 'development'
