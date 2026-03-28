import { type TerrainType } from './TerrainTypes'

// Types de nodes de jeu disponibles (hors boss qui est placé manuellement)
export type GameNodeType = 'combat' | 'elite' | 'shop' | 'event' | 'rest' | 'empty'

export interface BiomeEventWeights {
  combat: number
  elite: number
  shop: number
  event: number
  rest: number
  /** Cellules sans événement (case vide traversable) */
  empty: number
}

/**
 * Table de probabilités d'événements selon le biome.
 * Les poids sont relatifs (pas besoin de sommer à 1).
 *
 * Logique géographique :
 * - Plaine   : variété, beaucoup d'espaces vides
 * - Forêt    : embuscades (combat), événements mystérieux, repos
 * - Montagne : impossible (passable: false) — ignoré par EventOverlay
 * - Eau      : impossible (passable: false) — ignoré par EventOverlay
 */
export const BIOME_EVENT_TABLE: Record<TerrainType, BiomeEventWeights> = {
  plain: {
    combat: 25,
    elite: 5,
    shop: 15,
    event: 10,
    rest: 10,
    empty: 35,
  },
  forest: {
    combat: 35,
    elite: 10,
    shop: 5,
    event: 20,
    rest: 20,
    empty: 10,
  },
  // Non-passable : valeurs jamais utilisées, mais présentes pour la complétude du type
  mountain: {
    combat: 0,
    elite: 0,
    shop: 0,
    event: 0,
    rest: 0,
    empty: 100,
  },
  water: {
    combat: 0,
    elite: 0,
    shop: 0,
    event: 0,
    rest: 0,
    empty: 100,
  },
}

/** Tire un type d'événement selon les poids du biome */
export const pickEventForBiome = (terrain: TerrainType): GameNodeType => {
  const weights = BIOME_EVENT_TABLE[terrain]
  const entries = Object.entries(weights) as [GameNodeType, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)

  let rand = Math.random() * total
  for (const [type, weight] of entries) {
    rand -= weight
    if (rand <= 0) return type
  }
  return 'empty'
}
