import { describe, it, expect } from 'vitest'
import {
  computeCounterMultiplier,
  computeWeightedAttackPower,
  getDominantRole,
  describeCounterEffect,
  getUnitRole,
  COUNTER_BONUS_MULTIPLIER,
} from './roles'

describe('getUnitRole', () => {
  it('reconnaît les 4 rôles génériques', () => {
    expect(getUnitRole('infantry')).toBe('infantry')
    expect(getUnitRole('archer')).toBe('archer')
    expect(getUnitRole('cavalry')).toBe('cavalry')
    expect(getUnitRole('siege')).toBe('siege')
  })

  it('retourne null pour un type inconnu', () => {
    expect(getUnitRole('licorne')).toBeNull()
  })
})

describe('computeCounterMultiplier', () => {
  it('applique le bonus complet face à une armée 100% contrée', () => {
    const mult = computeCounterMultiplier('cavalry', [{ type: 'archer', count: 10 }])
    expect(mult).toBeCloseTo(COUNTER_BONUS_MULTIPLIER)
  })

  it('applique le malus complet face à une armée qui contre le rôle attaquant', () => {
    // La cavalerie contre l'archer → quand l'archer attaque la cavalerie, il subit le malus.
    const mult = computeCounterMultiplier('archer', [{ type: 'cavalry', count: 10 }])
    expect(mult).toBeCloseTo(1 / COUNTER_BONUS_MULTIPLIER)
  })

  it('reste neutre face au siège (hors du triangle)', () => {
    expect(computeCounterMultiplier('cavalry', [{ type: 'siege', count: 10 }])).toBeCloseTo(1)
    expect(computeCounterMultiplier('siege', [{ type: 'cavalry', count: 10 }])).toBeCloseTo(1)
    expect(computeCounterMultiplier('siege', [{ type: 'archer', count: 10 }])).toBeCloseTo(1)
  })

  it('pondère proportionnellement sur une armée adverse mixte', () => {
    // Cavalerie face à 50% archer (contré, bonus) / 50% infanterie (contre la cavalerie, malus)
    const mult = computeCounterMultiplier('cavalry', [
      { type: 'archer', count: 5 },
      { type: 'infantry', count: 5 },
    ])
    const expected = 0.5 * COUNTER_BONUS_MULTIPLIER + 0.5 * (1 / COUNTER_BONUS_MULTIPLIER)
    expect(mult).toBeCloseTo(expected)
  })

  it('est neutre pour un rôle inconnu ou une armée adverse vide', () => {
    expect(computeCounterMultiplier(null, [{ type: 'archer', count: 10 }])).toBe(1)
    expect(computeCounterMultiplier('cavalry', [])).toBe(1)
  })
})

describe('computeWeightedAttackPower', () => {
  it('applique le multiplicateur par type puis somme les contributions', () => {
    // 5 cavalerie (bonus x1.5) + 5 infanterie (malus x1/1.5) face à 100% archer
    const power = computeWeightedAttackPower(
      [
        { type: 'cavalry', count: 5, attack: 10 },
        { type: 'infantry', count: 5, attack: 10 },
      ],
      [{ type: 'archer', count: 10 }],
    )
    const expected = 5 * 10 * COUNTER_BONUS_MULTIPLIER + 5 * 10 * (1 / COUNTER_BONUS_MULTIPLIER)
    expect(power).toBeCloseTo(expected)
  })
})

describe('getDominantRole', () => {
  it("retourne le rôle avec le plus d'unités", () => {
    expect(
      getDominantRole([
        { type: 'infantry', count: 3 },
        { type: 'cavalry', count: 7 },
      ]),
    ).toBe('cavalry')
  })

  it('ignore les types inconnus et retourne null si aucun rôle connu', () => {
    expect(getDominantRole([{ type: 'licorne', count: 100 }])).toBeNull()
    expect(getDominantRole([])).toBeNull()
  })
})

describe('describeCounterEffect', () => {
  it("décrit le contre quand l'attaquant surclasse le défenseur", () => {
    const note = describeCounterEffect(
      'Votre armée',
      [{ type: 'cavalry', count: 10 }],
      'leur armée',
      [{ type: 'archer', count: 10 }],
    )
    expect(note).toContain('Votre armée')
    expect(note).toContain('surclassé')
  })

  it('décrit le contre inverse quand le défenseur surclasse l’attaquant', () => {
    const note = describeCounterEffect(
      'Votre armée',
      [{ type: 'infantry', count: 10 }],
      'leur armée',
      [{ type: 'archer', count: 10 }],
    )
    expect(note).toContain('leur armée')
    expect(note).toContain('surclassé')
  })

  it('ne dit rien si aucun contre net ne joue (ex: siège pur des deux côtés)', () => {
    const note = describeCounterEffect(
      'Votre armée',
      [{ type: 'siege', count: 10 }],
      'leur armée',
      [{ type: 'siege', count: 10 }],
    )
    expect(note).toBe('')
  })
})
