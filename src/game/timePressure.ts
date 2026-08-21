/**
 * Pression du temps — croissance des villages IA.
 *
 * Le coefficient global G(t) monte linéairement avec le temps de jeu actif de la
 * mission (via l'horloge injectée, voir registerPressureClock) puis plafonne.
 * Chaque village IA a son propre rythme g_v, dérivé d'un hash déterministe de son
 * id de tuile — rien n'est persisté, tout se recalcule depuis l'horloge : pas de
 * ticks incrémentaux, pas de rattrapage offline (l'horloge de mission est déjà
 * plafonnée par MAX_OFFLINE_MS côté missionStore).
 *
 * Module feuille : ne doit importer que gameSettingsStore (les stores map/game/
 * mission l'importent — tout autre import de store créerait un cycle).
 */

import { gameSettings } from '@/stores/gameSettingsStore'

export const PRESSURE = {
  /** Temps de jeu actif (par mission) pour atteindre la pression max */
  RAMP_DURATION_MS: 45 * 60 * 1000,
  /** Coefficient global au plafond : G va de 1.0 → MAX_GLOBAL */
  MAX_GLOBAL: 3.0,
  /** Rythme de croissance g_v des villages « endormis » */
  VILLAGE_RATE_MIN: 0.6,
  /** Rythme de croissance g_v des villages « ambitieux » */
  VILLAGE_RATE_MAX: 1.6,
  /** Plafond du développement D_v d'un village */
  MAX_VILLAGE_DEV: 4.0,
  /** D_v à partir duquel une zone explorée reçoit un plancher d'hostilité « warned » (30) */
  CONQUEROR_WARNED_DEV: 1.6,
  /** D_v à partir duquel une zone explorée reçoit un plancher d'hostilité « hostile » (55) */
  CONQUEROR_HOSTILE_DEV: 2.2,
  /** Une garnison existante n'est re-grossie que si D_v a monté d'au moins ce ratio */
  GARRISON_GROWTH_STEP: 1.1,
}

// --- Horloge injectée -------------------------------------------------------
// missionStore enregistre son getGameTimestamp ici (il ne peut pas être importé
// directement : missionStore importe mapStore qui importe ce module).

let clockProvider: (() => number) | null = null

/** Branche l'horloge de mission (appelé par missionStore). */
export function registerPressureClock(fn: () => number): void {
  clockProvider = fn
}

/** Temps de jeu actif écoulé (ms) — 0 tant qu'aucune horloge n'est branchée (pression neutre). */
export function getPressureElapsedMs(): number {
  return clockProvider ? clockProvider() : 0
}

// --- Coefficients -----------------------------------------------------------

/** Coefficient global G(t) ∈ [1, MAX_GLOBAL] — linéaire puis plafond dur. */
export function getGlobalPressure(elapsedMs: number = getPressureElapsedMs()): number {
  if (!gameSettings.timePressureEnabled) return 1
  const speed = gameSettings.timePressureSpeed || 1
  const progress = Math.min(Math.max((elapsedMs * speed) / PRESSURE.RAMP_DURATION_MS, 0), 1)
  return 1 + (PRESSURE.MAX_GLOBAL - 1) * progress
}

/** Hash FNV-1a 32 bits → [0, 1) — stable, sans état, indépendant de la session. */
export function hash01(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 4294967296
}

/** Rythme de croissance propre au village g_v ∈ [RATE_MIN, RATE_MAX], déterministe depuis l'id. */
export function getVillageGrowthRate(tileId: string): number {
  return (
    PRESSURE.VILLAGE_RATE_MIN +
    (PRESSURE.VILLAGE_RATE_MAX - PRESSURE.VILLAGE_RATE_MIN) * hash01(tileId)
  )
}

/** Sous-ensemble de MapTile suffisant pour le calcul (évite d'importer mapStore). */
export interface VillageTileLike {
  id: string
  type: string
  destructionLevel?: number
}

/**
 * Développement D_v d'un village IA : combine G(t) et g_v, plafonné, puis amorti
 * par les dégâts de siège (un village à 100 % de destruction devient 'ruins' et
 * retourne 1 comme toute tuile non-village — raser un village relâche la pression).
 */
export function getVillageDev(tile: VillageTileLike, elapsedMs?: number): number {
  if (tile.type !== 'village_enemy' && tile.type !== 'stronghold') return 1
  const g = getGlobalPressure(elapsedMs)
  const raw = 1 + (g - 1) * getVillageGrowthRate(tile.id)
  const clamped = Math.min(Math.max(raw, 1), PRESSURE.MAX_VILLAGE_DEV)
  const damageFactor = Math.max(0.5, 1 - (tile.destructionLevel ?? 0) / 200)
  return clamped * damageFactor
}

// --- Ères (signal UI) -------------------------------------------------------

export type EraTone = 'calm' | 'notice' | 'warning' | 'danger' | 'critical'

export interface PressureEra {
  name: string
  icon: string
  tone: EraTone
}

/** Ère lisible dérivée de G — sert d'indicateur de menace dans l'UI de campagne. */
export function getEra(g: number = getGlobalPressure()): PressureEra {
  if (g < 1.3) return { name: 'Paix', icon: '🕊️', tone: 'calm' }
  if (g < 1.8) return { name: 'Tension', icon: '👀', tone: 'notice' }
  if (g < 2.4) return { name: 'Menace', icon: '⚔️', tone: 'warning' }
  if (g < PRESSURE.MAX_GLOBAL) return { name: 'Guerre', icon: '🔥', tone: 'danger' }
  return { name: 'Conquête', icon: '💀', tone: 'critical' }
}

// --- Fréquence des raids ----------------------------------------------------

/** Intervalle entre raids hostiles, resserré jusqu'à ×2 quand G atteint son plafond. */
export function getHostileAttackIntervalMs(baseIntervalMs: number): number {
  const g = getGlobalPressure()
  return Math.round(baseIntervalMs / (1 + (g - 1) / 2))
}
