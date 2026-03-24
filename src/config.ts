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

/** Durée d'une mission d'éclaireur (ms) */
export const SCOUT_MISSION_DURATION_MS = parseNumber(
  import.meta.env.VITE_SCOUT_MISSION_DURATION_MS,
  10_000,
)

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
// Meta
// ------------------------------------

export const APP_ENV = import.meta.env.VITE_APP_ENV ?? 'development'
export const IS_DEV = APP_ENV === 'development'
