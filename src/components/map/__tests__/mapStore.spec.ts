import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMapStore } from '../../../stores/mapStore'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('MapStore - Module isolé', () => {
  let mapStore: ReturnType<typeof useMapStore>

  beforeEach(() => {
    // Reset des mocks
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)

    // Créer une nouvelle instance du store
    mapStore = useMapStore()

    // Reset du store à l'état initial
    mapStore.resetMapState()
  })

  describe('État initial', () => {
    it('devrait initialiser avec la position de départ correcte', () => {
      expect(mapStore.currentPosition.value).toEqual({ x: 5, y: 5 })
    })

    it("devrait avoir 3 points d'exploration au départ", () => {
      expect(mapStore.explorationPoints.value).toBe(3)
    })

    it('devrait générer une carte 11x11', () => {
      expect(mapStore.mapTiles.value).toHaveLength(121) // 11 * 11
    })

    it('devrait avoir le village du joueur exploré au centre', () => {
      const centerTile = mapStore.getTileAt(5, 5)
      expect(centerTile).toBeTruthy()
      expect(centerTile?.type).toBe('village_player')
      expect(centerTile?.explored).toBe(true)
      expect(centerTile?.current).toBe(true)
    })
  })

  describe('Sélection de tuiles', () => {
    it('devrait pouvoir sélectionner une tuile explorée', () => {
      const centerTile = mapStore.getTileAt(5, 5)
      const success = mapStore.selectTile(centerTile!.id)
      expect(success).toBe(true)
      expect(mapStore.selectedTile.value?.id).toBe(centerTile!.id)
    })

    it('ne devrait pas pouvoir sélectionner une tuile non explorée', () => {
      const unexploredTile = mapStore.getTileAt(0, 0)
      unexploredTile!.explored = false // S'assurer qu'elle n'est pas explorée
      const success = mapStore.selectTile(unexploredTile!.id)
      expect(success).toBe(false)
    })

    it('devrait pouvoir vider la sélection', () => {
      const centerTile = mapStore.getTileAt(5, 5)
      mapStore.selectTile(centerTile!.id)
      mapStore.clearSelection()
      expect(mapStore.selectedTile.value).toBe(null)
    })
  })

  describe('Exploration', () => {
    it('devrait pouvoir explorer si on a des points', () => {
      const result = mapStore.explore()
      expect(result.success).toBe(true)
      expect(mapStore.explorationPoints.value).toBe(2) // Un point consommé
    })

    it('ne devrait pas pouvoir explorer sans points', () => {
      // Consommer tous les points
      mapStore.mapState.explorationPoints = 0

      const result = mapStore.explore()
      expect(result.success).toBe(false)
      expect(result.message).toContain('Pas assez de points')
    })

    it('devrait explorer une tuile adjacente aléatoire', () => {
      const unexploredCount = mapStore
        .getAdjacentTiles(5, 5)
        .filter((tile) => !tile.explored).length

      const result = mapStore.explore()
      expect(result.success).toBe(true)

      const newUnexploredCount = mapStore
        .getAdjacentTiles(5, 5)
        .filter((tile) => !tile.explored).length

      expect(newUnexploredCount).toBe(unexploredCount - 1)
    })
  })

  describe('Reconnaissance (Scout)', () => {
    it('devrait reconnaître une tuile explorée', () => {
      const centerTile = mapStore.getTileAt(5, 5)
      const result = mapStore.scout(centerTile!.id)
      expect(result.success).toBe(true)
    })

    it('ne devrait pas reconnaître une tuile non explorée', () => {
      const unexploredTile = mapStore.getTileAt(0, 0)
      unexploredTile!.explored = false
      const result = mapStore.scout(unexploredTile!.id)
      expect(result.success).toBe(false)
    })

    it('devrait retourner des informations spécifiques selon le type de terrain', () => {
      // Créer une tuile village ennemi explorée pour tester
      const enemyVillage = mapStore.getTileAt(3, 3)!
      enemyVillage.type = 'village_enemy'
      enemyVillage.explored = true

      const result = mapStore.scout(enemyVillage.id)
      expect(result.success).toBe(true)
      expect(result.info?.enemies).toBeDefined()
      expect(result.info?.resources).toBeDefined()
    })
  })

  describe('Utilitaires', () => {
    it('devrait obtenir une tuile par ID', () => {
      const centerTile = mapStore.getTileAt(5, 5)
      const foundTile = mapStore.getTileById(centerTile!.id)
      expect(foundTile).toEqual(centerTile)
    })

    it('devrait obtenir une tuile par coordonnées', () => {
      const tile = mapStore.getTileAt(5, 5)
      expect(tile?.position).toEqual({ x: 5, y: 5 })
    })

    it('devrait obtenir les tuiles adjacentes', () => {
      const adjacentTiles = mapStore.getAdjacentTiles(5, 5)
      expect(adjacentTiles).toHaveLength(8) // 8 directions
    })

    it('devrait retourner les bons noms de tuiles', () => {
      expect(mapStore.getTileName('forest')).toBe('Forêt')
      expect(mapStore.getTileName('village_player')).toBe('Votre Village')
    })

    it('devrait retourner les bonnes icônes de tuiles', () => {
      expect(mapStore.getTileIcon('forest')).toBe('🌲')
      expect(mapStore.getTileIcon('water')).toBe('🌊')
    })
  })

  describe('Persistance', () => {
    it("devrait sauvegarder l'état dans localStorage", () => {
      mapStore.saveMapState()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('novavian-map', expect.any(String))
    })

    it("devrait charger l'état depuis localStorage", () => {
      const mockData = {
        currentPosition: { x: 3, y: 3 },
        explorationPoints: 2,
        mapTiles: [],
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData))

      const loaded = mapStore.loadMapState()
      expect(loaded).toBe(true)
    })

    it('devrait gérer les erreurs de chargement', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')

      const loaded = mapStore.loadMapState()
      expect(loaded).toBe(false)
    })

    it("devrait réinitialiser l'état et supprimer la sauvegarde", () => {
      mapStore.resetMapState()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('novavian-map')
      expect(mapStore.currentPosition.value).toEqual({ x: 5, y: 5 })
    })
  })

  describe("Isolation - Pas d'impact sur les autres modules", () => {
    it('ne devrait pas affecter missionStore', () => {
      // Le mapStore ne devrait pas importer ou utiliser missionStore
      const mapStoreString = mapStore.toString()
      expect(mapStoreString).not.toContain('missionStore')
      expect(mapStoreString).not.toContain('useMissionStore')
    })

    it('ne devrait utiliser que sa propre clé de localStorage', () => {
      mapStore.saveMapState()
      const calls = localStorageMock.setItem.mock.calls
      const mapCalls = calls.filter((call) => call[0] === 'novavian-map')
      expect(mapCalls).toHaveLength(1)
    })

    it("devrait être réinitialisable sans affecter l'état global", () => {
      // Modifier l'état
      mapStore.explore()
      const pointsAfterExplore = mapStore.explorationPoints.value

      // Réinitialiser
      mapStore.resetMapState()

      // Vérifier que l'état est revenu au début
      expect(mapStore.explorationPoints.value).toBe(3)
      expect(pointsAfterExplore).toBe(2) // L'ancienne valeur était différente
    })
  })
})

// Tests d'intégration pour la régénération des points
describe("Régénération des points d'exploration", () => {
  let mapStore: ReturnType<typeof useMapStore>

  beforeEach(() => {
    vi.clearAllMocks()
    mapStore = useMapStore()
    mapStore.resetMapState()
  })

  it('devrait régénérer les points après une heure', () => {
    // Consommer un point
    mapStore.explore()
    expect(mapStore.explorationPoints.value).toBe(2)

    // Simuler une heure écoulée
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    mapStore.mapState.lastExplorationTime = oneHourAgo

    // Régénérer
    mapStore.regenerateExplorationPoints()

    // Vérifier qu'un point a été régénéré
    expect(mapStore.explorationPoints.value).toBe(3)
  })

  it('ne devrait pas dépasser le maximum de points', () => {
    // Simuler plusieurs heures écoulées avec tous les points déjà présents
    const manyHoursAgo = Date.now() - 10 * 60 * 60 * 1000 // 10 heures
    mapStore.mapState.lastExplorationTime = manyHoursAgo

    mapStore.regenerateExplorationPoints()

    // Ne devrait pas dépasser le maximum
    expect(mapStore.explorationPoints.value).toBe(3)
  })
})
