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
// Déplacement & temps de voyage
// ------------------------------------

/** Multiplicateur de vitesse globale du jeu (1 = normal, 10 = accéléré en dev) */
export const GAME_SPEED_MULTIPLIER = parseNumber(import.meta.env.VITE_GAME_SPEED_MULTIPLIER, 1)

// ------------------------------------
// Sauvegarde & timers
// ------------------------------------

/** Intervalle d'auto-save (ms) */
export const AUTOSAVE_INTERVAL_MS = parseNumber(import.meta.env.VITE_AUTOSAVE_INTERVAL_MS, 30_000)

// ------------------------------------
// Ressources & stockage
// ------------------------------------

/**
 * Capacité de stockage de base par ressource (avant bonus de niveau du Bâtiment Principal).
 * Ordre de grandeur choisi par rapport aux coûts de bâtiments.ts : suffisant pour stocker
 * le coût d'une amélioration de milieu de partie sans forcer le joueur à dépenser en
 * continu, tout en restant assez bas pour que le plafond soit ressenti tôt.
 */
export const BASE_RESOURCE_CAPACITY = parseNumber(
  import.meta.env.VITE_BASE_RESOURCE_CAPACITY,
  2_000,
)

/**
 * Capacité de stockage additionnelle par ressource, par niveau de Bâtiment Principal.
 * Au niveau 10 (max), cela porte la capacité à 2 000 + 10 × 800 = 10 000, du même ordre
 * de grandeur que les coûts d'amélioration les plus élevés (~3 900 pour les Casernes niv. 10).
 */
export const CAPACITY_PER_HQ_LEVEL = parseNumber(import.meta.env.VITE_CAPACITY_PER_HQ_LEVEL, 800)

// ------------------------------------
// Débogage / outils de développement
// ------------------------------------

/** Désactive le brouillard de guerre — toutes les tuiles apparaissent comme explorées */
export const DISABLE_FOG_OF_WAR = import.meta.env.VITE_DISABLE_FOG_OF_WAR === 'true'

/** Rayon de révélation de départ (distance de Chebyshev) selon le rang du joueur */
export const RANK_REVEAL_RANGE = parseNumber(import.meta.env.VITE_RANK_REVEAL_RANGE, 10)

/** Donne 10 000 de chaque ressource au démarrage d’une mission (debug uniquement) */
export const CHEAT_RESOURCES = import.meta.env.VITE_CHEAT_RESOURCES === 'true'

/** Donne 1 000 points de victoire au démarrage d’une mission (debug uniquement) */
export const CHEAT_VICTORY_POINTS = import.meta.env.VITE_CHEAT_VICTORY_POINTS === 'true'

// ------------------------------------// Phase 2 — Pillage & économie de guerre
// ------------------------------------

/** Durée en ms pour qu'une garnison vaincue se reconstitue complètement (défaut : 1 min) */
export const GARRISON_REGEN_DURATION_MS = parseNumber(
  import.meta.env.VITE_GARRISON_REGEN_DURATION_MS,
  1 * 60 * 1000,
)

/** Intervalle en ms entre deux ticks de régénération du stock ennemi (défaut : 1 min) */
export const ENEMY_REGEN_INTERVAL_MS = parseNumber(
  import.meta.env.VITE_ENEMY_REGEN_INTERVAL_MS,
  1 * 60 * 1000,
)

/** Fraction du stock pillée par attaque victorieuse (défaut : 0.4 = 40%) */
export const LOOT_FRACTION = parseNumber(import.meta.env.VITE_LOOT_FRACTION, 0.4)

/** Durée en ms sous laquelle un village est considéré « récemment pillé » (défaut : 1 min) */
export const RECENT_PILLAGE_THRESHOLD_MS = parseNumber(
  import.meta.env.VITE_RECENT_PILLAGE_THRESHOLD_MS,
  1 * 60 * 1000,
)

// ------------------------------------// Meta
// ------------------------------------

export const APP_ENV = import.meta.env.VITE_APP_ENV ?? 'development'
export const IS_DEV = APP_ENV === 'development'
