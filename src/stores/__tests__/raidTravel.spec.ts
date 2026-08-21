import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useMapStore,
  HOSTILE_ATTACK_INTERVAL_MS,
  TRIBUTE_HOSTILITY_REDUCTION,
  TRIBUTE_TRUCE_DURATION_MS,
  type FortressZone,
} from '../mapStore'
import { gameSettings } from '../gameSettingsStore'

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

// Joueur à distance Chebyshev 3 de la forteresse, infanterie 0.1 case/s → 30 s
const TRAVEL_MS = 30_000

describe('temps de trajet des raids hostiles', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    gameSettings.gameSpeedMultiplier = 1
    mapStore.mapState.fortressZones = { 'f-1': makeZone() }
    mapStore.mapState.currentPosition = { x: 3, y: 0 }
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

  it("un raid lancé voyage : il n'arrive qu'après le temps de trajet", () => {
    const first = mapStore.processHostileAttacks()
    expect(first.launched).toHaveLength(1)
    expect(first.arrived).toHaveLength(0)

    const zone = mapStore.mapState.fortressZones['f-1']
    expect(zone.incomingAttackAt).toBe(Date.now() + TRAVEL_MS)
    // nextAttackAt aligné sur l'impact : les countdowns UI restent honnêtes
    expect(zone.nextAttackAt).toBe(zone.incomingAttackAt)

    // En vol : aucun nouveau lancement, aucune arrivée
    vi.advanceTimersByTime(TRAVEL_MS / 2)
    const midFlight = mapStore.processHostileAttacks()
    expect(midFlight.launched).toHaveLength(0)
    expect(midFlight.arrived).toHaveLength(0)

    // Impact
    vi.advanceTimersByTime(TRAVEL_MS / 2)
    const impact = mapStore.processHostileAttacks()
    expect(impact.arrived).toHaveLength(1)
    expect(zone.incomingAttackAt).toBeUndefined()
    // Le prochain lancement est replanifié après l'intervalle de base
    expect(zone.nextAttackAt).toBeGreaterThanOrEqual(Date.now() + HOSTILE_ATTACK_INTERVAL_MS)
  })

  it('une zone pacifiée pendant le vol rappelle son raid', () => {
    mapStore.processHostileAttacks() // lancement
    mapStore.reduceHostility('f-1', 60) // hostilité 60 → 0 : quitte l'état hostile

    const zone = mapStore.mapState.fortressZones['f-1']
    expect(zone.hostilityState).not.toBe('hostile')
    expect(zone.incomingAttackAt).toBeUndefined()
    expect(zone.nextAttackAt).toBeUndefined()
  })
})

describe('tribut : calmer une forteresse', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    gameSettings.gameSpeedMultiplier = 1
    mapStore.mapState.fortressZones = { 'f-1': makeZone() }
    mapStore.mapState.currentPosition = { x: 3, y: 0 }
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

  it("le tribut baisse l'hostilité, pose une trêve et rappelle le raid en vol", () => {
    mapStore.processHostileAttacks() // un raid part
    expect(mapStore.mapState.fortressZones['f-1'].incomingAttackAt).toBeDefined()

    mapStore.applyTribute('f-1')

    const zone = mapStore.mapState.fortressZones['f-1']
    expect(zone.incomingAttackAt).toBeUndefined()
    expect(zone.truceUntil).toBe(Date.now() + TRIBUTE_TRUCE_DURATION_MS)
    // 60 − 35 = 25 → la zone repasse sous le seuil hostile
    expect(zone.hostilityLevel).toBe(60 - TRIBUTE_HOSTILITY_REDUCTION)
    expect(zone.hostilityState).not.toBe('hostile')
    expect(zone.nextAttackAt).toBeUndefined()
  })

  it('une zone encore hostile après tribut ne relance aucun raid avant la fin de la trêve', () => {
    // Hostilité max : le tribut ne suffit pas à quitter l'état hostile (cas plancher conquérant)
    mapStore.mapState.fortressZones['f-1'] = makeZone({ hostilityLevel: 100 })

    mapStore.applyTribute('f-1')
    const zone = mapStore.mapState.fortressZones['f-1']
    expect(zone.hostilityState).toBe('hostile')
    expect(zone.nextAttackAt).toBe(zone.truceUntil)

    // Même avec un nextAttackAt échu, la garde de trêve bloque tout lancement
    zone.nextAttackAt = Date.now() - 1000
    const { launched } = mapStore.processHostileAttacks()
    expect(launched).toHaveLength(0)
    expect(zone.nextAttackAt).toBe(zone.truceUntil)

    // Trêve expirée : le lancement redevient possible
    vi.advanceTimersByTime(TRIBUTE_TRUCE_DURATION_MS + 1000)
    const after = mapStore.processHostileAttacks()
    expect(after.launched).toHaveLength(1)
  })

  it('getTributeCost a un plancher pour les zones sans développement', () => {
    const cost = mapStore.getTributeCost('f-1') // aucun village → dev 0 → plancher 20
    expect(cost).toEqual({ wood: 20, clay: 20, iron: 10, crop: 20 })
  })
})
