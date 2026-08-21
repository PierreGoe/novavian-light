/**
 * Résolution rapide de combat pour les raids automatiques.
 * Évite les allocations lourdes du resolver complet (armées, pertes détaillées, etc.)
 * en calculant uniquement le résultat et un ratio de pertes.
 */

import type { CombatUnit, CombatReport, ArmyLosses, Army } from './types'
import { computeWeightedAttackPower, describeCounterEffect } from './roles'

export interface RaidResult {
  /** Le joueur a-t-il repoussé le raid ? */
  defenseSuccess: boolean
  /** Ratio de pertes du défenseur (0–1) */
  defenderLossRatio: number
  /** Ratio de pertes de l'attaquant (0–1) */
  attackerLossRatio: number
  /** Puissance totale d'attaque */
  attackPower: number
  /** Puissance totale de défense */
  defensePower: number
}

/**
 * Résout un raid de manière simplifiée (O(n) avec n = nombre de types d'unités).
 * Pas de création d'objets intermédiaires lourds.
 *
 * Prend les unités détaillées des deux camps (plutôt qu'une puissance déjà
 * agrégée) pour pouvoir appliquer le triangle des contres, qui dépend de la
 * composition de l'armée adverse — voir computeWeightedAttackPower (roles.ts).
 */
export function resolveRaidFast(
  raidUnits: readonly CombatUnit[],
  defenderUnits: readonly CombatUnit[],
): RaidResult {
  // Puissance de défense totale (non pondérée par le triangle — comme combatResolver)
  const defensePower = defenderUnits.reduce((s, u) => s + u.defense * u.count, 0)
  const raidDefense = raidUnits.reduce((s, u) => s + u.defense * u.count, 0)
  const defenseHP = defenderUnits.reduce((s, u) => s + u.health * u.count, 0)
  const raidHP = raidUnits.reduce((s, u) => s + u.health * u.count, 0)

  // Puissance d'attaque pondérée par le triangle des contres, dans les deux sens
  const raidPower = computeWeightedAttackPower(raidUnits, defenderUnits)
  const defenseAttack = computeWeightedAttackPower(defenderUnits, raidUnits)

  // L'attaquant gagne si sa puissance d'attaque > défense totale + riposte
  const defenseSuccess = defensePower + defenseAttack > raidPower

  // Ratio de dégâts subis par chaque camp
  const damageToDefender = Math.max(1, raidPower - Math.floor(defensePower * 0.5))
  const damageToAttacker = Math.max(1, defenseAttack - Math.floor(raidDefense * 0.5))

  const defenderLossRatio = defenseHP > 0 ? Math.min(1, damageToDefender / defenseHP) : 1
  const attackerLossRatio = raidHP > 0 ? Math.min(1, damageToAttacker / raidHP) : 1

  return {
    defenseSuccess,
    defenderLossRatio,
    attackerLossRatio,
    attackPower: raidPower,
    defensePower,
  }
}

/**
 * Construit un CombatReport complet à partir du RaidResult (pour l'historique).
 * Appelé une seule fois, pas à chaque tick.
 */
export function buildRaidReport(
  result: RaidResult,
  raidLabel: string,
  raidUnits: CombatUnit[],
  defenderUnits: CombatUnit[],
): CombatReport {
  const attackerLosses = computeUnitLosses(raidUnits, result.attackerLossRatio)
  const defenderLosses = computeUnitLosses(defenderUnits, result.defenderLossRatio)

  const attackerKilledTotal = Object.values(attackerLosses.killed).reduce((s, n) => s + n, 0)
  const defenderKilledTotal = Object.values(defenderLosses.killed).reduce((s, n) => s + n, 0)

  const counterNote = describeCounterEffect(raidLabel, raidUnits, 'votre garnison', defenderUnits)

  const summary =
    (result.defenseSuccess
      ? `Défense réussie ! Raid de ${raidLabel} repoussé. Pertes ennemies : ${attackerKilledTotal}. Pertes défenseurs : ${defenderKilledTotal}.`
      : `Défense échouée. ${raidLabel} a percé vos défenses. Vous avez perdu ${defenderKilledTotal} unité(s).`) +
    counterNote

  return {
    attackerVictory: !result.defenseSuccess,
    attacker: {
      army: { label: raidLabel, units: raidUnits, modifiers: [] },
      losses: attackerLosses,
      totalPowerUsed: result.attackPower,
    },
    defender: {
      army: { label: 'Défense de la ville', units: defenderUnits, modifiers: [] },
      losses: defenderLosses,
      totalPowerUsed: result.defensePower,
    },
    summary,
  }
}

/** Applique un ratio de pertes uniformément sur toutes les unités */
function computeUnitLosses(units: CombatUnit[], lossRatio: number): ArmyLosses {
  const killed: Record<string, number> = {}
  const survivors: CombatUnit[] = []

  for (const unit of units) {
    const lost = Math.min(unit.count, Math.floor(unit.count * lossRatio))
    killed[unit.type] = lost
    const remaining = unit.count - lost
    if (remaining > 0) {
      survivors.push({ ...unit, count: remaining })
    }
  }

  return { killed, survivors }
}
