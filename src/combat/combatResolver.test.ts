import { describe, it, expect } from 'vitest'
import { defaultResolver } from './combatResolver'
import type { Army } from './types'

const armyOf = (label: string, type: string, count: number): Army => ({
  label,
  units: [{ type, count, attack: 10, defense: 10, health: 10 }],
  modifiers: [],
})

describe('NaiveCombatResolver — triangle des contres', () => {
  it('une armée qui contre son adversaire le domine largement, à stats brutes égales', () => {
    // Cavalerie (10 unités) contre archer (10 unités), stats identiques par unité.
    const report = defaultResolver.resolve(
      armyOf('Cavalerie', 'cavalry', 10),
      armyOf('Archers', 'archer', 10),
    )

    expect(report.attackerVictory).toBe(true)
    // Le défenseur (contré) est anéanti…
    expect(report.defender.losses.survivors).toHaveLength(0)
    // …tandis que l'attaquant (qui contre) ne subit que des pertes marginales.
    const attackerSurvivorCount = report.attacker.losses.survivors.reduce(
      (s, u) => s + u.count,
      0,
    )
    expect(attackerSurvivorCount).toBeGreaterThanOrEqual(8)
  })

  it("le sens inverse pénalise l'attaquant contré", () => {
    // Infanterie attaquant des archers : l'archer contre l'infanterie, donc l'attaquant est pénalisé.
    const report = defaultResolver.resolve(
      armyOf('Infanterie', 'infantry', 10),
      armyOf('Archers', 'archer', 10),
    )

    // L'infanterie reste moins efficace que ne l'aurait été de la cavalerie dans le même scénario.
    const cavalryReport = defaultResolver.resolve(
      armyOf('Cavalerie', 'cavalry', 10),
      armyOf('Archers', 'archer', 10),
    )
    expect(report.attacker.totalPowerUsed).toBeLessThan(cavalryReport.attacker.totalPowerUsed)
  })

  it('le siège ne bénéficie ni ne souffre du triangle', () => {
    const siegeVsCavalry = defaultResolver.resolve(
      armyOf('Siège', 'siege', 10),
      armyOf('Cavalerie', 'cavalry', 10),
    )
    const infantryVsCavalry = defaultResolver.resolve(
      armyOf('Infanterie', 'infantry', 10),
      armyOf('Cavalerie', 'cavalry', 10),
    )

    // À stats brutes égales, le siège (neutre) inflige exactement sa puissance nominale (100),
    // sans bonus ni malus de contre — contrairement à l'infanterie qui contre la cavalerie.
    expect(siegeVsCavalry.attacker.totalPowerUsed).toBe(100)
    expect(infantryVsCavalry.attacker.totalPowerUsed).toBeGreaterThan(
      siegeVsCavalry.attacker.totalPowerUsed,
    )
  })

  it('la composition mixte donne un résultat intermédiaire entre pur-contré et pur-contrant', () => {
    const mixedArmy: Army = {
      label: 'Mixte',
      units: [
        { type: 'cavalry', count: 5, attack: 10, defense: 10, health: 10 },
        { type: 'infantry', count: 5, attack: 10, defense: 10, health: 10 },
      ],
      modifiers: [],
    }
    const defender = armyOf('Archers', 'archer', 10)

    const mixedReport = defaultResolver.resolve(mixedArmy, defender)
    const pureCavalryReport = defaultResolver.resolve(armyOf('Cavalerie', 'cavalry', 10), defender)
    const pureInfantryReport = defaultResolver.resolve(
      armyOf('Infanterie', 'infantry', 10),
      defender,
    )

    expect(mixedReport.attacker.totalPowerUsed).toBeLessThan(
      pureCavalryReport.attacker.totalPowerUsed,
    )
    expect(mixedReport.attacker.totalPowerUsed).toBeGreaterThan(
      pureInfantryReport.attacker.totalPowerUsed,
    )
  })
})
