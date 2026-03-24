// ============================================================
// Combat Resolver — Interface + Implémentation naïve
// ============================================================
// Pour changer de système de combat :
//   1. Créer une classe qui implémente ICombatResolver
//   2. Remplacer l'export `defaultResolver` par votre instance
// ============================================================

import type { Army, CombatReport, CombatUnit, ArmyLosses, CombatModifier } from './types'

// --- Interface (contrat stable) ---

export interface ICombatResolver {
  resolve(attacker: Army, defender: Army): CombatReport
}

// --- Helpers internes ---

/** Calcule la puissance totale d'attaque d'une armée (avec modifiers) */
function computeAttackPower(army: Army): number {
  const { mult, flat } = aggregateModifiers(army.modifiers)

  const raw = army.units.reduce((sum, u) => sum + u.attack * u.count, 0)
  return Math.max(0, Math.floor(raw * mult.attack + flat.attack))
}

/** Calcule la puissance totale de défense d'une armée (avec modifiers) */
function computeDefensePower(army: Army): number {
  const { mult, flat } = aggregateModifiers(army.modifiers)

  const raw = army.units.reduce((sum, u) => sum + u.defense * u.count, 0)
  return Math.max(0, Math.floor(raw * mult.defense + flat.defense))
}

/** Agrège tous les modifiers en un seul multiplicateur et un seul flat */
function aggregateModifiers(modifiers: CombatModifier[]) {
  let attackMult = 1
  let defenseMult = 1
  let attackFlat = 0
  let defenseFlat = 0

  for (const mod of modifiers) {
    if (mod.attackMultiplier != null) attackMult *= mod.attackMultiplier
    if (mod.defenseMultiplier != null) defenseMult *= mod.defenseMultiplier
    if (mod.attackFlat != null) attackFlat += mod.attackFlat
    if (mod.defenseFlat != null) defenseFlat += mod.defenseFlat
  }

  return {
    mult: { attack: attackMult, defense: defenseMult },
    flat: { attack: attackFlat, defense: defenseFlat },
  }
}

/** Calcule les pertes d'une armée recevant `incomingDamage` points de dégâts.
 *  Répartit les pertes proportionnellement entre les types d'unités. */
function computeLosses(army: Army, incomingDamage: number): ArmyLosses {
  const totalHp = army.units.reduce((s, u) => s + u.health * u.count, 0)
  if (totalHp <= 0) {
    return {
      killed: Object.fromEntries(army.units.map((u) => [u.type, u.count])),
      survivors: [],
    }
  }

  // Ratio de dégâts par rapport aux PV totaux (capped à 1)
  const damageRatio = Math.min(1, incomingDamage / totalHp)

  const killed: Record<string, number> = {}
  const survivors: CombatUnit[] = []

  for (const unit of army.units) {
    const lost = Math.min(unit.count, Math.floor(unit.count * damageRatio))
    killed[unit.type] = lost

    if (unit.count - lost > 0) {
      survivors.push({ ...unit, count: unit.count - lost })
    }
  }

  return { killed, survivors }
}

// --- Implémentation naïve ---

class NaiveCombatResolver implements ICombatResolver {
  resolve(attacker: Army, defender: Army): CombatReport {
    const attackPower = computeAttackPower(attacker)
    const attackDefense = computeDefensePower(attacker) // unused for now but ready
    const defenderPower = computeAttackPower(defender) // defender's garrison attacks back
    const defenderDefense = computeDefensePower(defender)

    // Dégâts infligés :
    //   attacker → defender : attackPower vs defenderDefense
    //   defender → attacker : defenderPower vs attackDefense (riposte)
    const damageToDefender = Math.max(1, attackPower - Math.floor(defenderDefense * 0.5))
    const damageToAttacker = Math.max(1, defenderPower - Math.floor(attackDefense * 0.5))

    const defenderLosses = computeLosses(defender, damageToDefender)
    const attackerLosses = computeLosses(attacker, damageToAttacker)

    // Victoire si les survivants défenseurs sont éliminés (ou presque)
    const defenderSurvivorsCount = defenderLosses.survivors.reduce((s, u) => s + u.count, 0)
    const attackerSurvivorsCount = attackerLosses.survivors.reduce((s, u) => s + u.count, 0)

    const attackerVictory =
      defenderSurvivorsCount === 0 || attackPower > defenderDefense + defenderPower

    // Résumé
    const attackerKilledTotal = Object.values(attackerLosses.killed).reduce((s, n) => s + n, 0)
    const defenderKilledTotal = Object.values(defenderLosses.killed).reduce((s, n) => s + n, 0)

    const summary = attackerVictory
      ? `Victoire ! Vous avez conquis ${defender.label}. Pertes : ${attackerKilledTotal} unité(s). Ennemis éliminés : ${defenderKilledTotal}.`
      : `Défaite. ${defender.label} a repoussé l'attaque. Vous avez perdu ${attackerKilledTotal} unité(s).`

    return {
      attackerVictory,
      attacker: {
        army: attacker,
        losses: attackerLosses,
        totalPowerUsed: attackPower,
      },
      defender: {
        army: defender,
        losses: defenderLosses,
        totalPowerUsed: defenderPower,
      },
      summary,
    }
  }
}

// --- Export singleton (swap ici pour changer de resolver) ---

export const defaultResolver: ICombatResolver = new NaiveCombatResolver()
