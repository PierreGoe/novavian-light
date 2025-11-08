import { reactive, computed } from 'vue'

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
}

export interface ExplorationState {
  currentPosition: { x: number; y: number }
  mapTiles: MapTile[]
  selectedTileId: string | null
  explorationPoints: number
  maxExplorationPoints: number
  lastExplorationTime: number
  discoveredLocations: string[]
}

// État initial de la carte
const initialMapState: ExplorationState = {
  currentPosition: { x: 5, y: 5 }, // Position de départ au centre
  mapTiles: [],
  selectedTileId: null,
  explorationPoints: 3,
  maxExplorationPoints: 3,
  lastExplorationTime: Date.now(),
  discoveredLocations: [],
}

// Générer la carte initiale
const generateInitialMap = (): MapTile[] => {
  const tiles: MapTile[] = []
  const mapSize = 11 // Grille 11x11

  for (let x = 0; x < mapSize; x++) {
    for (let y = 0; y < mapSize; y++) {
      const id = `${x}-${y}`
      const isCenter = x === 5 && y === 5

      let type: TerrainType = 'plains'

      if (isCenter) {
        type = 'village_player'
      } else {
        // Logique simple de génération de terrain
        const rand = Math.random()
        if (rand < 0.3) type = 'forest'
        else if (rand < 0.5) type = 'mountain'
        else if (rand < 0.6) type = 'water'
        else if (rand < 0.7) type = 'ruins'
        else if (rand < 0.8) type = 'village_enemy'
        else if (rand < 0.85) type = 'stronghold'
        else type = 'plains'
      }

      tiles.push({
        id,
        type,
        explored: isCenter, // Seule la position de départ est explorée
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

// État réactif
const mapState = reactive<ExplorationState>({
  ...initialMapState,
  mapTiles: generateInitialMap(),
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

  // Actions de sélection
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

  // Sauvegarde et chargement
  const saveMapState = () => {
    const data = {
      currentPosition: mapState.currentPosition,
      mapTiles: mapState.mapTiles,
      selectedTileId: mapState.selectedTileId,
      explorationPoints: mapState.explorationPoints,
      lastExplorationTime: mapState.lastExplorationTime,
      discoveredLocations: mapState.discoveredLocations,
    }
    localStorage.setItem('novavian-map', JSON.stringify(data))
  }

  const loadMapState = (): boolean => {
    try {
      const saved = localStorage.getItem('novavian-map')
      if (saved) {
        const data = JSON.parse(saved)
        Object.assign(mapState, {
          ...initialMapState,
          ...data,
          mapTiles: data.mapTiles || generateInitialMap(),
        })
        return true
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la carte:', error)
    }
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
    getTileName,
    getTileIcon,
    getTileDescription,

    // Points d'exploration
    regenerateExplorationPoints,

    // Persistance
    saveMapState,
    loadMapState,
    resetMapState,
  }
}

export type MapStore = ReturnType<typeof useMapStore>
