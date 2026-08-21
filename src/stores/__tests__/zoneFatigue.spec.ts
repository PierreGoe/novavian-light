import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useMapStore,
  FATIGUE_GAIN_RAID_REPELLED,
  FATIGUE_EXHAUSTED_THRESHOLD,
  HOSTILE_ATTACK_INTERVAL_MS,
  type FortressZone,
} from '../mapStore'
import { getWallDefenseMultiplier, WALL_DEFENSE_BONUS_PER_LEVEL } from '../../data/buildings'

const mapStore = useMapStore()

const makeZone = (overrides: Partial<FortressZone> = {}): FortressZone => ({
  fortressTileId: 'f-1',
  villageIds: [],
  influenceRadius: 4,
  power: 3,
  hostilityLevel: 60,
  hostilityState: 'hostile',
  nextAttackAt: Date.now() - 1000, // attaque déjà due
  ...overrides,
})

describe('fatigue militaire des zones', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    mapStore.mapState.fortressZones = { 'f-1': makeZone() }
    // Tuile forteresse explorée : sans elle, la garde brouillard bloque tout raid
    mapStore.mapState.mapTiles = [
      {
        id: 'f-1',
        type: 'stronghold',
        explored: true,
        current: false,
        position: { x: 0, y: 0 },
      },
    ]
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('addZoneFatigue accumule et plafonne à 100', () => {
    mapStore.addZoneFatigue('f-1', FATIGUE_GAIN_RAID_REPELLED)
    expect(mapStore.getEffectiveFatigue('f-1')).toBe(FATIGUE_GAIN_RAID_REPELLED)

    mapStore.addZoneFatigue('f-1', 999)
    expect(mapStore.getEffectiveFatigue('f-1')).toBe(100)
  })

  it('la fatigue décroît avec le temps (4 points / 30 s)', () => {
    mapStore.addZoneFatigue('f-1', 40)
    vi.advanceTimersByTime(90_000) // 3 ticks de 30s → −12
    expect(mapStore.getEffectiveFatigue('f-1')).toBe(28)
  })

  it("isZoneExhausted s'active au seuil et se relâche après récupération", () => {
    mapStore.addZoneFatigue('f-1', FATIGUE_EXHAUSTED_THRESHOLD + 10)
    expect(mapStore.isZoneExhausted('f-1')).toBe(true)

    // 11 points à récupérer à 4/30s → 3 ticks (90 s) suffisent
    vi.advanceTimersByTime(90_000)
    expect(mapStore.isZoneExhausted('f-1')).toBe(false)
  })

  it("une zone épuisée n'attaque pas : processHostileAttacks la saute et repousse nextAttackAt", () => {
    mapStore.addZoneFatigue('f-1', 80)

    const triggered = mapStore.processHostileAttacks()
    expect(triggered).toHaveLength(0)

    const zone = mapStore.mapState.fortressZones['f-1']
    // nextAttackAt repoussé du temps de récupération réel (≥ l'intervalle de base)
    expect(zone.nextAttackAt).toBeGreaterThan(Date.now() + HOSTILE_ATTACK_INTERVAL_MS - 1)
  })

  it('une zone reposée attaque normalement', () => {
    const triggered = mapStore.processHostileAttacks()
    expect(triggered).toHaveLength(1)
    expect(triggered[0].fortressTileId).toBe('f-1')
  })

  it('une forteresse sous le brouillard ne raide jamais, même hostile', () => {
    mapStore.mapState.mapTiles[0].explored = false
    const triggered = mapStore.processHostileAttacks()
    expect(triggered).toHaveLength(0)
    // et l'attaque est replanifiée, pas déclenchée en boucle
    expect(mapStore.mapState.fortressZones['f-1'].nextAttackAt).toBeGreaterThan(Date.now())
  })

  it('deux raids repoussés coup sur coup épuisent la zone (vision : pas d’attaque sans cesse)', () => {
    mapStore.addZoneFatigue('f-1', FATIGUE_GAIN_RAID_REPELLED)
    expect(mapStore.isZoneExhausted('f-1')).toBe(false) // 40 < 60 : elle réattaque, affaiblie

    mapStore.addZoneFatigue('f-1', FATIGUE_GAIN_RAID_REPELLED)
    expect(mapStore.isZoneExhausted('f-1')).toBe(true) // 80 ≥ 60 : repos forcé
    expect(mapStore.processHostileAttacks()).toHaveLength(0)
  })
})

describe("mur d'enceinte", () => {
  it('confère +8 % de défense par niveau', () => {
    expect(getWallDefenseMultiplier([])).toBe(1)
    expect(getWallDefenseMultiplier([{ type: 'wall', level: 5 }])).toBeCloseTo(
      1 + 5 * WALL_DEFENSE_BONUS_PER_LEVEL,
    )
    expect(getWallDefenseMultiplier([{ type: 'barracks', level: 3 }])).toBe(1)
  })
})
