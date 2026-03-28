// ============================================================
// Module de pillage — Système de poids & capacité de transport
// ============================================================
// Ce module est le seul point de vérité pour le calcul du butin.
//
// Pour évoluer le système :
//   - Modifier UNIT_CARRY_CAPACITY pour changer les poids par unité
//   - Modifier capLootToCapacity() pour changer la répartition
//   - Modifier computePillage() pour ajouter des modificateurs
//     (bonus de race, artefacts, météo, etc.)
// ============================================================

import { LOOT_FRACTION, RECENT_PILLAGE_THRESHOLD_MS } from '@/config'

// ------------------------------------
// Types
// ------------------------------------

/** Stock de ressources d'un village ennemi (pillable) */
export interface EnemyLootStock {
  gold: number
  wood: number
  iron: number
  crop: number
}

/** Résumé complet d'un pillage : butin, stock restant, méta-infos */
export interface PillageResult {
  /** Ressources effectivement emportées par les survivants */
  loot: EnemyLootStock
  /** Stock restant dans le village après pillage */
  newStock: EnemyLootStock
  /** Capacité totale de transport des survivants (en unités de ressource) */
  carryCapacity: number
  /** Vrai si le butin brut dépassait la capacité de transport */
  wasCapacityLimited: boolean
  /** Vrai si le village avait été pillé récemment (fraction de butin réduite) */
  wasRecentlyPillaged: boolean
}

// ------------------------------------
// Capacité de transport par type d'unité
// ------------------------------------

/**
 * Nombre de ressources (toutes confondues) qu'une unité peut transporter.
 *
 * Logique métier :
 *  - L'infanterie est polyvalente mais limitée
 *  - La cavalerie porte plus (sacoches + rapidité de manœuvre)
 *  - Les archers voyagent légers (carquois encombrants)
 *  - Les engins de siège n'ont presque pas de capacité de transport
 */
export const UNIT_CARRY_CAPACITY: Record<string, number> = {
  infantry: 20,
  archer: 12,
  cavalry: 40,
  siege: 5,
}

/** Capacité de transport par défaut pour les types inconnus */
const DEFAULT_CARRY_CAPACITY = 10

// ------------------------------------
// Fonctions utilitaires
// ------------------------------------

/**
 * Calcule la capacité totale de transport d'un groupe d'unités survivantes.
 * Accepte n'importe quel objet avec `type` et `count` (CombatUnit, MilitaryUnit…).
 */
export const computeLootCapacity = (units: Array<{ type: string; count: number }>): number =>
  units.reduce(
    (sum, u) => sum + u.count * (UNIT_CARRY_CAPACITY[u.type] ?? DEFAULT_CARRY_CAPACITY),
    0,
  )

/**
 * Plafonne le butin brut à la capacité de transport disponible.
 * La réduction est appliquée proportionnellement entre toutes les ressources
 * pour ne pas avantager ou pénaliser un type de ressource en particulier.
 */
const capLootToCapacity = (loot: EnemyLootStock, capacity: number): EnemyLootStock => {
  const total = loot.gold + loot.wood + loot.iron + loot.crop
  if (total <= 0 || capacity >= total) return { ...loot }

  const ratio = capacity / total
  return {
    gold: Math.floor(loot.gold * ratio),
    wood: Math.floor(loot.wood * ratio),
    iron: Math.floor(loot.iron * ratio),
    crop: Math.floor(loot.crop * ratio),
  }
}

// ------------------------------------
// Fonction principale
// ------------------------------------

/**
 * Calcule le pillage complet d'un village :
 *   1. Détermine la fraction accessible (réduite si pillé récemment)
 *   2. Calcule le butin brut (fraction × stock)
 *   3. Plafonne le butin à la capacité de transport des survivants
 *   4. Retourne le butin final, le nouveau stock, et les méta-infos
 *
 * @param stock          Stock actuel du village
 * @param survivors      Unités survivantes de l'attaquant
 * @param lastPillagedAt Timestamp du dernier pillage (undefined = jamais)
 */
export const computePillage = (
  stock: EnemyLootStock,
  survivors: Array<{ type: string; count: number }>,
  lastPillagedAt: number | undefined,
): PillageResult => {
  const now = Date.now()
  const wasRecentlyPillaged =
    lastPillagedAt !== undefined && now - lastPillagedAt < RECENT_PILLAGE_THRESHOLD_MS

  // Fraction du stock accessible selon l'historique de pillage
  const fraction = wasRecentlyPillaged ? LOOT_FRACTION * 0.5 : LOOT_FRACTION

  // Butin brut (sans contrainte de poids)
  const rawLoot: EnemyLootStock = {
    gold: Math.floor(stock.gold * fraction),
    wood: Math.floor(stock.wood * fraction),
    iron: Math.floor(stock.iron * fraction),
    crop: Math.floor(stock.crop * fraction),
  }

  // Contrainte de poids : les survivants ne peuvent emporter que ce qu'ils portent
  const carryCapacity = computeLootCapacity(survivors)
  const rawTotal = rawLoot.gold + rawLoot.wood + rawLoot.iron + rawLoot.crop
  const loot = capLootToCapacity(rawLoot, carryCapacity)

  // Stock restant
  const newStock: EnemyLootStock = {
    gold: Math.max(0, stock.gold - loot.gold),
    wood: Math.max(0, stock.wood - loot.wood),
    iron: Math.max(0, stock.iron - loot.iron),
    crop: Math.max(0, stock.crop - loot.crop),
  }

  return {
    loot,
    newStock,
    carryCapacity,
    wasCapacityLimited: rawTotal > carryCapacity,
    wasRecentlyPillaged,
  }
}
