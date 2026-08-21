import { describe, it, expect, beforeEach } from 'vitest'
import {
  PRESSURE,
  registerPressureClock,
  getPressureElapsedMs,
  getGlobalPressure,
  hash01,
  getVillageGrowthRate,
  getVillageDev,
  getEra,
  getHostileAttackIntervalMs,
} from './timePressure'
import { gameSettings, resetGameSettings } from '@/stores/gameSettingsStore'

const villageTile = (overrides: Partial<Parameters<typeof getVillageDev>[0]> = {}) => ({
  id: '12-7',
  type: 'village_enemy',
  ...overrides,
})

beforeEach(() => {
  resetGameSettings()
  registerPressureClock(() => 0)
})

describe('getGlobalPressure', () => {
  it('vaut 1 à t=0', () => {
    expect(getGlobalPressure(0)).toBe(1)
  })

  it('atteint MAX_GLOBAL au bout de la rampe et y plafonne', () => {
    expect(getGlobalPressure(PRESSURE.RAMP_DURATION_MS)).toBe(PRESSURE.MAX_GLOBAL)
    expect(getGlobalPressure(PRESSURE.RAMP_DURATION_MS * 10)).toBe(PRESSURE.MAX_GLOBAL)
  })

  it('monte linéairement : mi-rampe = mi-chemin entre 1 et MAX_GLOBAL', () => {
    expect(getGlobalPressure(PRESSURE.RAMP_DURATION_MS / 2)).toBeCloseTo(
      (1 + PRESSURE.MAX_GLOBAL) / 2,
    )
  })

  it('retourne 1 quand la pression est désactivée, même en fin de rampe', () => {
    gameSettings.timePressureEnabled = false
    expect(getGlobalPressure(PRESSURE.RAMP_DURATION_MS)).toBe(1)
  })

  it('timePressureSpeed accélère la rampe', () => {
    gameSettings.timePressureSpeed = 2
    expect(getGlobalPressure(PRESSURE.RAMP_DURATION_MS / 2)).toBe(PRESSURE.MAX_GLOBAL)
  })

  it("lit l'horloge injectée quand elapsedMs n'est pas fourni", () => {
    registerPressureClock(() => PRESSURE.RAMP_DURATION_MS)
    expect(getPressureElapsedMs()).toBe(PRESSURE.RAMP_DURATION_MS)
    expect(getGlobalPressure()).toBe(PRESSURE.MAX_GLOBAL)
  })
})

describe('hash01 / getVillageGrowthRate', () => {
  it('est stable pour un même id et borné dans [0, 1)', () => {
    expect(hash01('12-7')).toBe(hash01('12-7'))
    for (const id of ['0-0', '49-49', '12-7', 'abc']) {
      const h = hash01(id)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
    }
  })

  it('donne des rythmes différents à des villages différents, dans [RATE_MIN, RATE_MAX]', () => {
    const a = getVillageGrowthRate('3-4')
    const b = getVillageGrowthRate('4-3')
    expect(a).not.toBe(b)
    for (const rate of [a, b]) {
      expect(rate).toBeGreaterThanOrEqual(PRESSURE.VILLAGE_RATE_MIN)
      expect(rate).toBeLessThanOrEqual(PRESSURE.VILLAGE_RATE_MAX)
    }
  })
})

describe('getVillageDev', () => {
  it('vaut 1 à pression neutre (comportement actuel du jeu inchangé)', () => {
    expect(getVillageDev(villageTile(), 0)).toBe(1)
  })

  it('vaut 1 pour toute tuile non-village (les ruines sortent du circuit)', () => {
    expect(getVillageDev(villageTile({ type: 'ruins' }), PRESSURE.RAMP_DURATION_MS)).toBe(1)
    expect(getVillageDev(villageTile({ type: 'plains' }), PRESSURE.RAMP_DURATION_MS)).toBe(1)
  })

  it('croît avec le temps et reste plafonné à MAX_VILLAGE_DEV', () => {
    const early = getVillageDev(villageTile(), PRESSURE.RAMP_DURATION_MS / 4)
    const late = getVillageDev(villageTile(), PRESSURE.RAMP_DURATION_MS)
    expect(late).toBeGreaterThan(early)
    expect(early).toBeGreaterThan(1)
    expect(late).toBeLessThanOrEqual(PRESSURE.MAX_VILLAGE_DEV)
  })

  it('est amorti par les dégâts de siège (jusqu’à −50 %)', () => {
    const intact = getVillageDev(villageTile(), PRESSURE.RAMP_DURATION_MS)
    const damaged = getVillageDev(
      villageTile({ destructionLevel: 50 }),
      PRESSURE.RAMP_DURATION_MS,
    )
    const wrecked = getVillageDev(
      villageTile({ destructionLevel: 99 }),
      PRESSURE.RAMP_DURATION_MS,
    )
    expect(damaged).toBeCloseTo(intact * 0.75)
    expect(wrecked).toBeGreaterThanOrEqual(intact * 0.5)
    expect(wrecked).toBeLessThan(damaged)
  })
})

describe('getEra', () => {
  it('traverse les 5 ères dans l’ordre quand G monte', () => {
    expect(getEra(1).name).toBe('Paix')
    expect(getEra(1.5).name).toBe('Tension')
    expect(getEra(2).name).toBe('Menace')
    expect(getEra(2.7).name).toBe('Guerre')
    expect(getEra(PRESSURE.MAX_GLOBAL).name).toBe('Conquête')
  })
})

describe('getHostileAttackIntervalMs', () => {
  it('garde l’intervalle de base à pression neutre et le divise par 2 au plafond', () => {
    registerPressureClock(() => 0)
    expect(getHostileAttackIntervalMs(10_000)).toBe(10_000)
    registerPressureClock(() => PRESSURE.RAMP_DURATION_MS)
    expect(getHostileAttackIntervalMs(10_000)).toBe(5_000)
  })
})
