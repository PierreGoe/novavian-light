import { describe, it, expect, beforeEach } from 'vitest'
import { useMapStore, type MapTile } from '../mapStore'

const mapStore = useMapStore()

const makeTile = (id: string, overrides: Partial<MapTile> = {}): MapTile => ({
  id,
  type: 'plains',
  explored: false,
  current: false,
  position: { x: 0, y: 0 },
  ...overrides,
})

// L'index tilesById (Map module-scope) doit rester transparent : mêmes objets réactifs
// que mapState.mapTiles, et reconstruit quand le tableau est réassigné (loadMapState,
// resetMapState) — comportement identique à l'ancien .find() linéaire.
describe('getTileById (index O(1))', () => {
  beforeEach(() => {
    // Store singleton : reset manuel entre les specs
    localStorage.clear()
    mapStore.mapState.mapTiles = [makeTile('0-0'), makeTile('1-0'), makeTile('2-3')]
  })

  it('retourne le même objet réactif que celui du tableau (mutation en place visible)', () => {
    const tile = mapStore.getTileById('1-0')
    expect(tile).toBe(mapStore.mapState.mapTiles[1])

    // Mutation en place (comme la garnison/le butin en jeu) : visible via la référence
    tile!.explored = true
    expect(mapStore.mapState.mapTiles[1].explored).toBe(true)
  })

  it('retourne null pour un id inconnu', () => {
    expect(mapStore.getTileById('99-99')).toBeNull()
  })

  it("suit une réassignation de mapTiles (loadMapState/resetMapState)", () => {
    mapStore.mapState.mapTiles = [makeTile('5-5')]
    expect(mapStore.getTileById('5-5')?.id).toBe('5-5')
    // L'ancienne tuile ne doit plus être trouvée
    expect(mapStore.getTileById('0-0')).toBeNull()
  })
})
