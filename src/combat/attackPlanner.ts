// ============================================================
// Module de planification d'attaque
// ============================================================
// Logique pure sans dépendances aux stores Vue.
//
// Deux modes d'attaque sont disponibles :
//   - Rapide : sélection automatique selon une stratégie prédéfinie
//   - Personnalisé : le joueur fixe le nombre exact d'unités par type
//
// Pour ajouter une stratégie rapide :
//   1. Ajouter une valeur dans QuickAttackMode
//   2. Implémenter la stratégie dans QUICK_ATTACK_STRATEGIES
// ============================================================

import type { MovementUnit } from '@/stores/mapStore'

// ------------------------------------
// Types
// ------------------------------------

/** Une unité disponible dans la garnison du joueur */
export interface AvailableUnit {
  type: string
  count: number    // Nombre total disponible
  attack: number
  defense: number
  health: number
}

/** Sélection d'unités pour une attaque (type → nombre envoyé) */
export type AttackComposition = Record<string, number>

/** Résultat d'un plan d'attaque validé */
export interface AttackPlan {
  units: MovementUnit[]
  /** Nombre total d'unités envoyées */
  totalCount: number
  /** Capacité de transport totale (pour estimation du butin) */
  carryCapacity: number
  /** Vrai si des unités de siège sont incluses */
  hasSiege: boolean
}

/** Erreur de validation */
export interface AttackValidationError {
  field: string
  message: string
}

// ------------------------------------
// Modes d'attaque rapide
// ------------------------------------

/** Stratégies d'attaque rapide prédéfinies */
export type QuickAttackMode =
  | 'all'       // Toute l'armée
  | 'balanced'  // Équilibre attaque/défense/rapidité, sans siège
  | 'raid'      // Unités rapides uniquement (cavalerie > archers > infanterie), sans siège
  | 'siege'     // Optimisé destruction de village (inclut les armes de siège)

export interface QuickAttackStrategy {
  label: string
  description: string
  icon: string
}

export const QUICK_ATTACK_STRATEGIES: Record<QuickAttackMode, QuickAttackStrategy> = {
  all: {
    label: 'Toute l\'armée',
    description: 'Envoie toutes vos unités disponibles',
    icon: '⚔️',
  },
  balanced: {
    label: 'Attaque équilibrée',
    description: 'Toutes vos unités sauf les armes de siège',
    icon: '🛡️',
  },
  raid: {
    label: 'Raid éclair',
    description: 'Cavalerie en priorité, puis archers. Maximise la vitesse et le butin',
    icon: '⚡',
  },
  siege: {
    label: 'Siège',
    description: 'Toute l\'armée avec les armes de siège pour détruire le village',
    icon: '🏰',
  },
}

/** Priorité des types d'unités pour chaque stratégie (ordre décroissant d'envoi) */
const RAID_PRIORITY: string[] = ['cavalry', 'archer', 'infantry', 'siege']

/** Fraction de l'armée envoyée en mode "raid" (60% des unités rapides) */
const RAID_FRACTION = 0.6

// ------------------------------------
// Import capacité de transport
// ------------------------------------

import { UNIT_CARRY_CAPACITY } from '@/combat/loot'

const getCarryCapacity = (units: MovementUnit[]): number =>
  units.reduce((sum, u) => sum + u.count * (UNIT_CARRY_CAPACITY[u.type] ?? 10), 0)

// ------------------------------------
// Modes rapides
// ------------------------------------

/**
 * Génère automatiquement un plan d'attaque selon la stratégie choisie.
 *
 * @param available  Unités disponibles dans la garnison du joueur
 * @param mode       Stratégie d'attaque rapide
 */
export const buildQuickAttackPlan = (
  available: AvailableUnit[],
  mode: QuickAttackMode,
): AttackPlan | null => {
  const pool = available.filter((u) => u.count > 0)
  if (pool.length === 0) return null

  let selected: AvailableUnit[]

  switch (mode) {
    case 'all':
      selected = pool
      break

    case 'balanced':
      selected = pool.filter((u) => u.type !== 'siege')
      if (selected.length === 0) selected = pool // fallback si que du siège
      break

    case 'raid': {
      // Trier selon la priorité, puis envoyer RAID_FRACTION des unités rapides
      const sorted = [...pool].sort(
        (a, b) => RAID_PRIORITY.indexOf(a.type) - RAID_PRIORITY.indexOf(b.type),
      )
      selected = sorted
        .filter((u) => u.type !== 'siege')
        .map((u) => ({
          ...u,
          count: Math.max(1, Math.floor(u.count * RAID_FRACTION)),
        }))
      if (selected.length === 0) selected = pool
      break
    }

    case 'siege':
      selected = pool // Tout envoyer, siège inclus
      break

    default:
      selected = pool
  }

  return compositionToAttackPlan(
    selected.reduce<AttackComposition>((acc, u) => ({ ...acc, [u.type]: u.count }), {}),
    available,
  )
}

// ------------------------------------
// Mode personnalisé
// ------------------------------------

/**
 * Valide une composition personnalisée avant de construire le plan.
 * Retourne la liste des erreurs (vide = valide).
 */
export const validateCustomComposition = (
  composition: AttackComposition,
  available: AvailableUnit[],
): AttackValidationError[] => {
  const errors: AttackValidationError[] = []
  const availableMap = Object.fromEntries(available.map((u) => [u.type, u.count]))

  let totalSent = 0

  for (const [type, count] of Object.entries(composition)) {
    if (count < 0) {
      errors.push({ field: type, message: 'Le nombre doit être positif' })
      continue
    }
    const max = availableMap[type] ?? 0
    if (count > max) {
      errors.push({ field: type, message: `Maximum disponible : ${max}` })
    }
    totalSent += count
  }

  if (totalSent === 0) {
    errors.push({ field: '_total', message: 'Vous devez envoyer au moins une unité' })
  }

  return errors
}

/**
 * Construit un plan d'attaque depuis une composition personnalisée.
 * Retourne null si la composition est invalide.
 */
export const buildCustomAttackPlan = (
  composition: AttackComposition,
  available: AvailableUnit[],
): AttackPlan | null => {
  const errors = validateCustomComposition(composition, available)
  if (errors.length > 0) return null
  return compositionToAttackPlan(composition, available)
}

// ------------------------------------
// Utilitaires internes
// ------------------------------------

/** Convertit une composition (type → count) en AttackPlan complet */
const compositionToAttackPlan = (
  composition: AttackComposition,
  available: AvailableUnit[],
): AttackPlan => {
  const availableMap = Object.fromEntries(available.map((u) => [u.type, u]))

  const units: MovementUnit[] = Object.entries(composition)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => {
      const src = availableMap[type]
      return {
        type,
        count,
        attack: src?.attack ?? 0,
        defense: src?.defense ?? 0,
        health: src?.health ?? 0,
      }
    })

  return {
    units,
    totalCount: units.reduce((s, u) => s + u.count, 0),
    carryCapacity: getCarryCapacity(units),
    hasSiege: units.some((u) => u.type === 'siege'),
  }
}
