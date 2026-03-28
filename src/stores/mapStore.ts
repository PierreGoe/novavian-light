import { reactive, computed } from 'vue'
import { createRawGrid } from '@/utils/map/TerrainGrid'
import { smoothTerrain } from '@/utils/map/CellularAutomata'
import type { TerrainType as CATerrainType } from '@/utils/map/TerrainTypes'
import { TERRAIN_CONFIG } from '@/utils/map/TerrainTypes'
import { GAME_SPEED_MULTIPLIER } from '@/config'

// Types pour la carte et l'exploration
export type TerrainType =
  | 'plains'
  | 'forest'
  | 'mountain'
  | 'water'
  | 'village_player'
  | 'village_enemy'
  | 'ruins'
  | 'stronghold'

/** Unité dans un mouvement de troupes (snapshot envoyé au moment du dispatch) */
export interface MovementUnit {
  type: string
  count: number
  attack: number
  defense: number
  health: number
}

/** Mouvement de troupes en transit sur la carte */
export interface TroopMovement {
  id: string
  sourceTileId: string
  targetTileId: string
  /** Timestamp réel au départ (Date.now()) */
  departureTime: number
  /** Timestamp réel à l'arrivée (Date.now() + durée du trajet) */
  arrivalTime: number
  units: MovementUnit[]
}

/** Coût de déplacement par type de terrain (exploration map) */
export const TERRAIN_MOVE_COST: Record<TerrainType, number> = {
  plains: 1.0,
  forest: 1.5,
  mountain: 99,
  water: 99,
  village_player: 1.0,
  village_enemy: 1.0,
  ruins: 1.2,
  stronghold: 2.0,
}

/**
 * Vitesse de déplacement par type d'unité, en cases/seconde.
 * L'armée se déplace à la vitesse de l'unité la plus lente.
 */
export const UNIT_MOVE_SPEED: Record<string, number> = {
  infantry: 1.0,   // 1 case/sec — référence
  archer:   0.8,   // Moins mobile (équipement + carquois)
  cavalry:  2.5,   // Très rapide
  siege:    0.3,   // Engins de siège — extrêmement lent
}

export interface ScoutInfo {
  enemies?: Array<{ type: string; strength: number }>
  resources?: {
    gold?: number
    wood?: number
    clay?: number
    iron?: number
    crop?: number
  }
  treasures?: string[]
  message?: string
}

/** Unité de garnison persistée sur une tuile ennemie */
export interface GarrisonUnit {
  type: string
  count: number
  attack: number
  defense: number
  health: number
}

/** Garnison ennemie mémorisée (snapshot après 1re attaque) */
export interface TileGarrison {
  units: GarrisonUnit[]
  lastAttackedAt?: number // game-time en ms
}

export interface MapTile {
  id: string
  type: TerrainType
  explored: boolean
  current: boolean
  position: { x: number; y: number }
  bonus?: string
  resources?: {
    wood?: number
    clay?: number
    iron?: number
    crop?: number
  }
  enemies?: {
    type: string
    strength: number
  }[]
  /** Garnison persistée — remplie au premier combat, mise à jour ensuite */
  garrison?: TileGarrison
}

export interface ExplorationState {
  currentPosition: { x: number; y: number }
  mapTiles: MapTile[]
  selectedTileId: string | null
  explorationPoints: number
  maxExplorationPoints: number
  lastExplorationTime: number
  discoveredLocations: string[]
  viewportOffset: { x: number; y: number } // Position du viewport pour le scroll
  zoomLevel: number // Niveau de zoom (nombre de tuiles visibles: 5, 6, 7... 15, 20, etc.)
  /** Mouvements de troupes en cours vers des tuiles ennemies */
  activeMovements: TroopMovement[]
}

// Configuration de la carte
export const MAP_CONFIG = {
  size: 100, // Taille de la carte (100x100)
  chunkSize: 20, // Taille d'un chunk pour le chargement par sections
  defaultViewportSize: 15, // Nombre de tuiles visibles par défaut dans le viewport
  minViewportSize: 5, // Zoom max (5x5 tuiles)
  maxViewportSize: 25, // Dézoom max (25x25 tuiles)
  tileSize: 40, // Taille d'une tuile en pixels (constante)
}

// État initial de la carte
const initialMapState: ExplorationState = {
  currentPosition: { x: 50, y: 50 }, // Position de départ au centre (50, 50 pour 100x100)
  mapTiles: [],
  selectedTileId: null,
  explorationPoints: 3,
  maxExplorationPoints: 3,
  lastExplorationTime: Date.now(),
  discoveredLocations: [],
  viewportOffset: {
    x: 50 - Math.floor(MAP_CONFIG.defaultViewportSize / 2),
    y: 50 - Math.floor(MAP_CONFIG.defaultViewportSize / 2),
  },
  zoomLevel: MAP_CONFIG.defaultViewportSize, // Le zoom est maintenant le nombre de tuiles visibles
  activeMovements: [],
}

// Correspondance biome CA → terrain mapStore
const CA_TO_MAP_TERRAIN: Record<CATerrainType, TerrainType> = {
  plain: 'plains',
  forest: 'forest',
  mountain: 'mountain',
  water: 'water',
}

// Générer la carte initiale via automate cellulaire (clusters naturels)
const generateInitialMap = (): MapTile[] => {
  const mapSize = MAP_CONFIG.size
  const CENTER = Math.floor(mapSize / 2)

  // Pipeline CA — grille brute puis lissage en 5 itérations
  const rawGrid = createRawGrid(mapSize, mapSize)
  const smoothGrid = smoothTerrain(rawGrid, 5)

  const tiles: MapTile[] = []

  for (let x = 0; x < mapSize; x++) {
    for (let y = 0; y < mapSize; y++) {
      const id = `${x}-${y}`
      const isCenter = x === CENTER && y === CENTER
      const caTerrain = smoothGrid[y][x].terrain // [row=y][col=x]
      const passable = TERRAIN_CONFIG[caTerrain].passable

      let type: TerrainType = CA_TO_MAP_TERRAIN[caTerrain]

      if (isCenter) {
        type = 'village_player'
      } else if (passable && type === 'plains') {
        const rand = Math.random()
        if (rand < 0.05) type = 'village_enemy'
        else if (rand < 0.07) type = 'stronghold'
        else if (rand < 0.09) type = 'ruins'
        // ~91% reste 'plains'
      }

      tiles.push({
        id,
        type,
        explored: isCenter,
        current: isCenter,
        position: { x, y },
        bonus:
          type === 'forest'
            ? '+50% Bois'
            : type === 'mountain'
              ? '+50% Pierre'
              : type === 'water'
                ? '+50% Poisson'
                : undefined,
      })
    }
  }

  return tiles
}

// État réactif (commence vide, sera chargé ou généré par loadMapState)
const mapState = reactive<ExplorationState>({
  ...initialMapState,
})

// Store principal
export const useMapStore = () => {
  // Getters
  const currentPosition = computed(() => mapState.currentPosition)
  const mapTiles = computed(() => mapState.mapTiles)
  const selectedTile = computed(() => {
    if (!mapState.selectedTileId) return null
    return mapState.mapTiles.find((tile) => tile.id === mapState.selectedTileId) || null
  })
  const explorationPoints = computed(() => mapState.explorationPoints)
  const canExplore = computed(() => mapState.explorationPoints > 0)

  // Utilitaires pour les tuiles
  const getTileById = (id: string): MapTile | null => {
    return mapState.mapTiles.find((tile) => tile.id === id) || null
  }

  const getTileAt = (x: number, y: number): MapTile | null => {
    return mapState.mapTiles.find((tile) => tile.position.x === x && tile.position.y === y) || null
  }

  const getAdjacentTiles = (x: number, y: number): MapTile[] => {
    const adjacent: MapTile[] = []
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }, // gauche, droite
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 }, // haut, bas
      { dx: -1, dy: -1 },
      { dx: -1, dy: 1 }, // diagonales
      { dx: 1, dy: -1 },
      { dx: 1, dy: 1 },
    ]

    directions.forEach((dir) => {
      const tile = getTileAt(x + dir.dx, y + dir.dy)
      if (tile) adjacent.push(tile)
    })

    return adjacent
  }

  // Obtenir les tuiles dans une zone (pour viewport)
  const getTilesInRange = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): MapTile[] => {
    return mapState.mapTiles.filter(
      (tile: MapTile) =>
        tile.position.x >= startX &&
        tile.position.x < endX &&
        tile.position.y >= startY &&
        tile.position.y < endY,
    )
  }

  // Déplacer le viewport
  const moveViewport = (x: number, y: number) => {
    const currentViewportSize = mapState.zoomLevel // zoomLevel = nombre de tuiles visibles
    mapState.viewportOffset = {
      x: Math.max(0, Math.min(MAP_CONFIG.size - currentViewportSize, x)),
      y: Math.max(0, Math.min(MAP_CONFIG.size - currentViewportSize, y)),
    }
    saveMapState()
  }

  // Centrer le viewport sur une position
  const centerViewportOn = (x: number, y: number) => {
    const currentViewportSize = mapState.zoomLevel
    const halfView = Math.floor(currentViewportSize / 2)
    moveViewport(x - halfView, y - halfView)
  }

  // Changer le zoom (nombre de tuiles visibles)
  const setZoomLevel = (viewportSize: number) => {
    const oldViewportSize = mapState.zoomLevel
    const newViewportSize = Math.max(
      MAP_CONFIG.minViewportSize,
      Math.min(MAP_CONFIG.maxViewportSize, viewportSize),
    )

    // Ajuster l'offset pour garder le centre approximativement au même endroit
    const centerX = mapState.viewportOffset.x + oldViewportSize / 2
    const centerY = mapState.viewportOffset.y + oldViewportSize / 2

    mapState.zoomLevel = newViewportSize

    // Recentrer
    mapState.viewportOffset = {
      x: Math.max(0, Math.min(MAP_CONFIG.size - newViewportSize, centerX - newViewportSize / 2)),
      y: Math.max(0, Math.min(MAP_CONFIG.size - newViewportSize, centerY - newViewportSize / 2)),
    }

    saveMapState()
  }

  // Zoom in (voir moins de tuiles)
  const zoomIn = () => {
    setZoomLevel(mapState.zoomLevel - 1)
  }

  // Zoom out (voir plus de tuiles)
  const zoomOut = () => {
    setZoomLevel(mapState.zoomLevel + 1)
  } // Actions de sélection
  const selectTile = (tileId: string) => {
    const tile = getTileById(tileId)
    if (tile && tile.explored) {
      mapState.selectedTileId = tileId
      return true
    }
    return false
  }

  const clearSelection = () => {
    mapState.selectedTileId = null
  }

  // Actions d'exploration
  const explore = (): { success: boolean; message: string } => {
    if (mapState.explorationPoints <= 0) {
      return { success: false, message: "Pas assez de points d'exploration" }
    }

    // Trouver les tuiles adjacentes non explorées
    const { x, y } = mapState.currentPosition
    const adjacentTiles = getAdjacentTiles(x, y)
    const unexplored = adjacentTiles.filter((tile) => !tile.explored)

    if (unexplored.length === 0) {
      return { success: false, message: 'Aucune nouvelle zone à explorer à proximité' }
    }

    // Explorer une tuile aléatoire
    const randomTile = unexplored[Math.floor(Math.random() * unexplored.length)]
    randomTile.explored = true

    // Consommer un point d'exploration
    mapState.explorationPoints--
    mapState.lastExplorationTime = Date.now()

    // Ajouter à la liste des découvertes
    mapState.discoveredLocations.push(randomTile.id)

    saveMapState()

    return {
      success: true,
      message: `Nouvelle zone découverte : ${getTileName(randomTile.type)}`,
    }
  }

  const scout = (tileId: string): { success: boolean; message: string; info?: ScoutInfo } => {
    const tile = getTileById(tileId)
    if (!tile) {
      return { success: false, message: 'Zone introuvable' }
    }

    if (!tile.explored) {
      return { success: false, message: "Cette zone n'a pas encore été explorée" }
    }

    // Informations détaillées selon le type de terrain
    let info: ScoutInfo = {}

    switch (tile.type) {
      case 'village_enemy':
        info = {
          enemies: [
            { type: 'Garde', strength: Math.floor(Math.random() * 50) + 25 },
            { type: 'Archer', strength: Math.floor(Math.random() * 30) + 15 },
          ],
          resources: {
            gold: Math.floor(Math.random() * 100) + 50,
            wood: Math.floor(Math.random() * 200) + 100,
          },
        }
        break
      case 'ruins':
        info = {
          treasures: ['Artefact ancien', 'Livre de sorts'],
          resources: {
            iron: Math.floor(Math.random() * 150) + 75,
          },
        }
        break
      case 'stronghold':
        info = {
          enemies: [{ type: 'Commandant', strength: Math.floor(Math.random() * 100) + 75 }],
          resources: {
            gold: Math.floor(Math.random() * 300) + 200,
          },
        }
        break
      default:
        info = { message: 'Zone paisible, aucune menace détectée' }
    }

    return {
      success: true,
      message: `Reconnaissance de ${getTileName(tile.type)} terminée`,
      info,
    }
  }

  // Utilitaires d'affichage
  const getTileName = (type: TerrainType): string => {
    const names = {
      plains: 'Plaines',
      forest: 'Forêt',
      mountain: 'Montagnes',
      water: 'Lac',
      village_player: 'Votre Village',
      village_enemy: 'Village Ennemi',
      ruins: 'Ruines',
      stronghold: 'Forteresse',
    }
    return names[type] || 'Terrain Inconnu'
  }

  const getTileIcon = (type: TerrainType): string => {
    const icons = {
      plains: '🌾',
      forest: '🌲',
      mountain: '⛰️',
      water: '🌊',
      village_player: '🏠',
      village_enemy: '🏘️',
      ruins: '🏛️',
      stronghold: '🏰',
    }
    return icons[type] || '❓'
  }

  const getTileDescription = (type: TerrainType): string => {
    const descriptions = {
      plains: "Vastes plaines fertiles, idéales pour l'agriculture.",
      forest: 'Forêt dense riche en bois et gibier.',
      mountain: 'Montagnes rocheuses contenant des minerais précieux.',
      water: "Etendue d'eau poissonneuse.",
      village_player: 'Votre village principal.',
      village_enemy: 'Un village ennemi à conquérir.',
      ruins: 'Anciennes ruines mystérieuses.',
      stronghold: 'Une puissante forteresse ennemie.',
    }
    return descriptions[type] || 'Terrain mystérieux.'
  }

  // Régénération des points d'exploration
  const regenerateExplorationPoints = () => {
    const now = Date.now()
    const timeSinceLastExploration = now - mapState.lastExplorationTime
    const hoursElapsed = timeSinceLastExploration / (1000 * 60 * 60) // en heures

    if (hoursElapsed >= 1 && mapState.explorationPoints < mapState.maxExplorationPoints) {
      const pointsToAdd = Math.min(
        Math.floor(hoursElapsed),
        mapState.maxExplorationPoints - mapState.explorationPoints,
      )
      mapState.explorationPoints += pointsToAdd
      mapState.lastExplorationTime = now
      saveMapState()
    }
  }

  // ------------------------------------
  // Déplacement de troupes
  // ------------------------------------

  /**
   * Calcule le temps de trajet en ms vers une tuile cible.
   *
   * Formule : travel_ms = (distance_tiles / effective_speed) * 1000 / GAME_SPEED_MULTIPLIER
   *   - distance      : distance de Chebyshev en tiles
   *   - effective_speed = slowest_unit_tps / terrain_cost
   *   - GAME_SPEED_MULTIPLIER : accélérateur global (env var)
   *
   * @param units Si omis, utilise la vitesse infanterie (1.0 t/s) par défaut.
   */
  const calculateTravelTimeMs = (targetTileId: string, units?: MovementUnit[]): number => {
    const dest = getTileById(targetTileId)
    if (!dest) return 0
    const { x: sx, y: sy } = mapState.currentPosition
    const distance = Math.max(
      Math.abs(dest.position.x - sx),
      Math.abs(dest.position.y - sy),
    )
    if (distance === 0) return 0
    const terrainCost = TERRAIN_MOVE_COST[dest.type] ?? 1
    // Vitesse en tiles/sec de l'unité la plus lente (ou 1.0 par défaut)
    const slowestTps = units && units.length > 0
      ? Math.min(...units.map((u) => UNIT_MOVE_SPEED[u.type] ?? 1.0))
      : 1.0
    // Vitesse effective : terrain dur étend le trajet
    const effectiveSpeed = slowestTps / terrainCost
    return Math.round((distance / effectiveSpeed) * 1000 / GAME_SPEED_MULTIPLIER)
  }

  /** Envoie un snapshot de troupes vers une tuile cible. Retourne le mouvement créé. */
  const dispatchTroops = (targetTileId: string, units: MovementUnit[]): TroopMovement | null => {
    const travelMs = calculateTravelTimeMs(targetTileId, units)
    if (travelMs <= 0) return null
    const now = Date.now()
    const movement: TroopMovement = {
      id: `mov-${now}`,
      sourceTileId: `${mapState.currentPosition.x}-${mapState.currentPosition.y}`,
      targetTileId,
      departureTime: now,
      arrivalTime: now + travelMs,
      units,
    }
    mapState.activeMovements.push(movement)
    saveMapState()
    return movement
  }

  /** Retire un mouvement de la liste (après résolution du combat ou annulation) */
  const resolveMovement = (movementId: string) => {
    const idx = mapState.activeMovements.findIndex((m) => m.id === movementId)
    if (idx !== -1) {
      mapState.activeMovements.splice(idx, 1)
      saveMapState()
    }
  }

  /** Renvoie les mouvements dont l'heure d'arrivée est passée */
  const getArrivedMovements = (): TroopMovement[] => {
    const now = Date.now()
    return mapState.activeMovements.filter((m) => m.arrivalTime <= now)
  }

  /** Renvoie les mouvements actifs vers une tuile donnée */
  const getMovementsToTile = (tileId: string): TroopMovement[] => {
    return mapState.activeMovements.filter((m) => m.targetTileId === tileId)
  }

  // Sauvegarde et chargement
  const saveMapState = () => {
    // PROTECTION: Ne jamais sauvegarder une carte vide
    // Cela évite d'écraser une carte valide existante avec des données vides
    if (mapState.mapTiles.length === 0) {
      return
    }

    const data = {
      currentPosition: mapState.currentPosition,
      mapTiles: mapState.mapTiles,
      selectedTileId: mapState.selectedTileId,
      explorationPoints: mapState.explorationPoints,
      lastExplorationTime: mapState.lastExplorationTime,
      discoveredLocations: mapState.discoveredLocations,
      activeMovements: mapState.activeMovements,
    }

    localStorage.setItem('novavian-map', JSON.stringify(data))
  }

  const loadMapState = (): boolean => {
    try {
      const saved = localStorage.getItem('novavian-map')
      if (saved) {
        const data = JSON.parse(saved)

        // Si les données sauvegardées ont des tuiles, les charger
        if (data.mapTiles && data.mapTiles.length > 0) {
          Object.assign(mapState, {
            ...initialMapState,
            ...data,
          })
          return true
        }

        // Sinon, charger les autres données mais générer une nouvelle carte
        console.log('⚠️ Saved map has no tiles, generating new map')
        Object.assign(mapState, {
          ...initialMapState,
          ...data,
          mapTiles: generateInitialMap(),
        })
        console.log('Generated tiles:', mapState.mapTiles.length)
        saveMapState()
        return true
      }
    } catch (error) {
      console.error('❌ Error loading map:', error)
    }

    // Si aucune carte sauvegardée, générer une nouvelle carte et la sauvegarder
    console.log('📂 No saved map found, generating new map')
    mapState.mapTiles = generateInitialMap()
    saveMapState()

    return false
  }

  const resetMapState = () => {
    Object.assign(mapState, {
      ...initialMapState,
      mapTiles: generateInitialMap(),
    })
    localStorage.removeItem('novavian-map')
  }

  return {
    // État
    mapState,

    // Getters
    currentPosition,
    mapTiles,
    selectedTile,
    explorationPoints,
    canExplore,

    // Actions de sélection
    selectTile,
    clearSelection,

    // Actions d'exploration
    explore,
    scout,

    // Utilitaires
    getTileById,
    getTileAt,
    getAdjacentTiles,
    getTilesInRange,
    getTileName,
    getTileIcon,
    getTileDescription,

    // Viewport et navigation
    moveViewport,
    centerViewportOn,
    setZoomLevel,
    zoomIn,
    zoomOut,

    // Points d'exploration
    regenerateExplorationPoints,

    // Déplacement de troupes
    calculateTravelTimeMs,
    dispatchTroops,
    resolveMovement,
    getArrivedMovements,
    getMovementsToTile,

    // Persistance
    saveMapState,
    loadMapState,
    resetMapState,
  }
}

export type MapStore = ReturnType<typeof useMapStore>
