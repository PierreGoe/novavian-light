import { reactive, computed, watch } from 'vue'
import { createRawGrid } from '@/utils/map/TerrainGrid'
import { smoothTerrain } from '@/utils/map/CellularAutomata'
import type { TerrainType as CATerrainType } from '@/utils/map/TerrainTypes'
import { TERRAIN_CONFIG } from '@/utils/map/TerrainTypes'
import { GARRISON_REGEN_DURATION_MS, RECENT_PILLAGE_THRESHOLD_MS } from '@/config'
import { gameSettings } from '@/stores/gameSettingsStore'
import { computePillage } from '@/combat/loot'
import { TERRAIN_BONUS } from '@/data/resources'
export type { EnemyLootStock, PillageResult } from '@/combat/loot'

// ====================================================================
// TYPES — Zones d’influence & Hostilité
// ====================================================================

/** Niveau d’hostilité d’une forteresse envers le joueur */
export type HostilityState = 'neutral' | 'warned' | 'hostile'

/** Zone d’influence d’une forteresse — regroupe les villages qu’elle contrôle */
export interface FortressZone {
  /** ID de la tuile forteresse (clé dans fortressZones) */
  fortressTileId: string
  /** IDs des villages ennemis dans le rayon d’influence */
  villageIds: string[]
  /** Rayon de Chebyshev de la zone */
  influenceRadius: number
  /** Puissance calculée = nombre de villages dans la zone */
  power: number
  /** Niveau d’hostilité 0–100 */
  hostilityLevel: number
  /** Catégorie d’hostilité dérivée de hostilityLevel */
  hostilityState: HostilityState
  /** Timestamp (Date.now) de la prochaine attaque hostile (si hostile) */
  nextAttackAt?: number
}

// ====================================================================
// CONSTANTES — Hostilité
// ====================================================================

/** Rayon de Chebyshev de l’influence d’une forteresse (en cases) */
const FORTRESS_INFLUENCE_RADIUS = 4

/** Seuils de passage d’état */
const HOSTILITY_THRESHOLD_WARNED = 40
const HOSTILITY_THRESHOLD_HOSTILE = 70

/** Gain d’hostilité lors d’une attaque sur un village de la zone */
export const HOSTILITY_GAIN_VILLAGE_ATTACK = 20
/** Gain d’hostilité lors d’une attaque directe sur la forteresse */
export const HOSTILITY_GAIN_FORTRESS_ATTACK = 50

/** Intervalle entre deux attaques hostiles (en ms) */
const HOSTILE_ATTACK_INTERVAL_MS = 3 * 60 * 1000 // 3 minutes

/** Décroissance d’hostilité par tick du timer (toutes les 30s) */
const HOSTILITY_DECAY_PER_TICK = 2

/** Ressources pillées par attaque hostile, par village contrôlé */
const HOSTILE_LOOT_PER_POWER = 4

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
  infantry: 1.0, // 1 case/sec — référence
  archer: 0.8, // Moins mobile (équipement + carquois)
  cavalry: 2.5, // Très rapide
  siege: 0.3, // Engins de siège — extrêmement lent
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
  /** Garnison initiale complète — utilisée pour la régénération progressive */
  maxUnits?: GarrisonUnit[]
  /** Timestamp réel du début de régénération (undefined = pas en cours) */
  regenStartedAt?: number
}

import type { EnemyLootStock } from '@/combat/loot'

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
  /** Stock de ressources pillables (généré à la création du village) */
  lootStock?: EnemyLootStock
  /** Timestamp réel du dernier pillage (pour réduire le butin si récent) */
  lastPillagedAt?: number
  /**
   * Niveau de la forteresse (1 = forteresse simple, +1 par forteresse absorbée lors de la fusion).
   * Affecte la puissance de base dans computeFortressZones.
   */
  level?: number
}

export interface ExplorationState {
  currentPosition: { x: number; y: number }
  mapTiles: MapTile[]
  selectedTileId: string | null
  discoveredLocations: string[]
  viewportOffset: { x: number; y: number }
  zoomLevel: number
  activeMovements: TroopMovement[]
  unlockedChunks: string[]
  /** Zones d’influence des forteresses — clé = tileId de la forteresse */
  fortressZones: Record<string, FortressZone>
}

// Configuration de la carte
export const MAP_CONFIG = {
  size: 50, // Taille de la carte (50x50)
  chunkSize: 10, // Taille d'un cadran (grille 5x5 de cadrans 10x10)
  defaultViewportSize: 15, // Nombre de tuiles visibles par défaut dans le viewport
  minViewportSize: 11, // Zoom max (11x11 tuiles minimum acceptable)
  maxViewportSize: 20, // Dézoom max (20x20 tuiles)
  tileSize: 40, // Taille d'une tuile en pixels (constante)
}

// Cadran de départ (chunk contenant le centre de la carte)
const STARTING_CHUNK_ID = `${Math.floor(Math.floor(MAP_CONFIG.size / 2) / MAP_CONFIG.chunkSize)}-${Math.floor(Math.floor(MAP_CONFIG.size / 2) / MAP_CONFIG.chunkSize)}`

// État initial de la carte
const initialMapState: ExplorationState = {
  currentPosition: { x: Math.floor(MAP_CONFIG.size / 2), y: Math.floor(MAP_CONFIG.size / 2) },
  mapTiles: [],
  selectedTileId: null,

  discoveredLocations: [],
  viewportOffset: {
    x: Math.floor(MAP_CONFIG.size / 2) - Math.floor(MAP_CONFIG.defaultViewportSize / 2),
    y: Math.floor(MAP_CONFIG.size / 2) - Math.floor(MAP_CONFIG.defaultViewportSize / 2),
  },
  zoomLevel: MAP_CONFIG.defaultViewportSize,
  activeMovements: [],
  unlockedChunks: [STARTING_CHUNK_ID], // Seul le cadran de départ est débloqué initialement
  fortressZones: {},
}

// Correspondance biome CA → terrain mapStore
const CA_TO_MAP_TERRAIN: Record<CATerrainType, TerrainType> = {
  plain: 'plains',
  forest: 'forest',
  mountain: 'mountain',
  water: 'water',
}

/** Génère un stock de ressources aléatoire pour un village ennemi ou une forteresse */
const generateLootStock = (isStronghold: boolean): EnemyLootStock => {
  const base = isStronghold ? 200 : 80
  const jitter = () => Math.floor(Math.random() * base * 0.4)
  return {
    gold: base + jitter(),
    wood: base + jitter(),
    iron: Math.floor((base + jitter()) * 0.7),
    crop: base + jitter(),
  }
}

/**
 * Post-traitement en deux passes :
 *
 * Passe 1 — Fusion par chunk :
 *   - 1 forteresse survivante par cadran (10×10), la plus proche du centre.
 *   - Les autres deviennent des plaines.
 *
 * Passe 2 — Normalisation des niveaux 1–5 :
 *   - Pour chaque survivante, on compte ses villages dans le rayon d'influence.
 *   - Min village count → niveau 1, max → niveau 5 (distribution linéaire).
 *   - Si toutes ont le même compte → niveau 3 par défaut.
 *   - Le lootStock est multiplié par le niveau final.
 */
const MAX_FORTRESS_LEVEL = 5

const mergeFortresses = (tiles: MapTile[]): void => {
  const chunkSize = MAP_CONFIG.chunkSize

  // ── Passe 1 : 1 forteresse par chunk ──────────────────────────────
  const fortresses = tiles.filter((t) => t.type === 'stronghold')
  const byChunk = new Map<string, MapTile[]>()
  for (const f of fortresses) {
    const cx = Math.floor(f.position.x / chunkSize)
    const cy = Math.floor(f.position.y / chunkSize)
    const key = `${cx}-${cy}`
    if (!byChunk.has(key)) byChunk.set(key, [])
    byChunk.get(key)!.push(f)
  }

  const tileById = new Map(tiles.map((t) => [t.id, t]))

  byChunk.forEach((members, chunkKey) => {
    const [cxStr, cyStr] = chunkKey.split('-')
    const centerX = parseInt(cxStr) * chunkSize + chunkSize / 2
    const centerY = parseInt(cyStr) * chunkSize + chunkSize / 2

    // Survivant = forteresse la plus proche du centre du chunk
    members.sort(
      (a, b) =>
        Math.hypot(a.position.x - centerX, a.position.y - centerY) -
        Math.hypot(b.position.x - centerX, b.position.y - centerY),
    )

    // Absorber les autres → plaines (niveau 1 provisoire sur le survivant)
    members[0].level = 1
    for (let i = 1; i < members.length; i++) {
      const absorbed = tileById.get(members[i].id)!
      absorbed.type = 'plains'
      absorbed.lootStock = undefined
      absorbed.bonus = undefined
    }
  })

  // ── Passe 2 : normalisation des niveaux selon densité de villages ──
  const survivors = tiles.filter((t) => t.type === 'stronghold')
  const villages = tiles.filter((t) => t.type === 'village_enemy')

  // Compter les villages dans le rayon de chaque survivante
  const counts = survivors.map((f) => {
    const n = villages.filter((v) => {
      const dx = Math.abs(v.position.x - f.position.x)
      const dy = Math.abs(v.position.y - f.position.y)
      return Math.max(dx, dy) <= FORTRESS_INFLUENCE_RADIUS
    }).length
    return { fortress: f, count: n }
  })

  if (counts.length === 0) return

  const minCount = Math.min(...counts.map((e) => e.count))
  const maxCount = Math.max(...counts.map((e) => e.count))
  const range = maxCount - minCount

  counts.forEach(({ fortress, count }) => {
    // Normalisation linéaire min→1, max→5 ; si tout identique → niveau 3
    const level =
      range === 0
        ? 3
        : Math.max(
            1,
            Math.min(MAX_FORTRESS_LEVEL, Math.round(1 + ((count - minCount) / range) * 4)),
          )

    fortress.level = level
    // Regénérer le lootStock de base et le multiplier par le niveau final
    fortress.lootStock = {
      gold: generateLootStock(true).gold * level,
      wood: generateLootStock(true).wood * level,
      iron: generateLootStock(true).iron * level,
      crop: generateLootStock(true).crop * level,
    }
  })
}

// Générer la carte initiale via automate cellulaire (clusters naturels)
const generateInitialMap = (): MapTile[] => {
  const mapSize = MAP_CONFIG.size
  const CENTER = Math.floor(mapSize / 2)
  const revealRange = gameSettings.rankRevealRange

  // Pipeline CA — grille brute puis lissage en 5 itérations
  const rawGrid = createRawGrid(mapSize, mapSize)
  const smoothGrid = smoothTerrain(rawGrid, 5)

  const tiles: MapTile[] = []

  for (let x = 0; x < mapSize; x++) {
    for (let y = 0; y < mapSize; y++) {
      const id = `${x}-${y}`
      const isCenter = x === CENTER && y === CENTER
      // Cases révélées au départ selon le rang (distance de Chebyshev)
      const isStartingReveal = Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER)) <= revealRange
      const caTerrain = smoothGrid[y][x].terrain // [row=y][col=x]
      const passable = TERRAIN_CONFIG[caTerrain].passable

      let type: TerrainType = CA_TO_MAP_TERRAIN[caTerrain]

      // Une tuile appartenant à un cadran verrouillé reste dans le brouillard dès le début
      const chunkX = Math.floor(x / MAP_CONFIG.chunkSize)
      const chunkY = Math.floor(y / MAP_CONFIG.chunkSize)
      const isStartingChunk = `${chunkX}-${chunkY}` === STARTING_CHUNK_ID

      if (isCenter) {
        type = 'village_player'
      } else if (passable && type === 'plains') {
        const rand = Math.random()
        if (rand < 0.05) type = 'village_enemy'
        else if (rand < 0.07) type = 'stronghold'
        else if (rand < 0.09) type = 'ruins'
        // ~91% reste 'plains'
      }

      // explored : tuile visible uniquement si son cadran est débloqué (et dans la zone de révélation)
      const explored = gameSettings.disableFogOfWar || (isStartingChunk && isStartingReveal)

      tiles.push({
        id,
        type,
        explored,
        current: isCenter,
        position: { x, y },
        bonus: TERRAIN_BONUS[type],
        // Générer un stock de ressources initial pour les villages ennemis et forteresses
        lootStock:
          type === 'village_enemy' || type === 'stronghold'
            ? generateLootStock(type === 'stronghold')
            : undefined,
      })
    }
  }

  // Fusionner les forteresses trop proches et assigner les niveaux
  mergeFortresses(tiles)

  return tiles
}

// État réactif (commence vide, sera chargé ou généré par loadMapState)
const mapState = reactive<ExplorationState>({
  ...initialMapState,
})

// Réapplique ou retire le brouillard de guerre selon le paramètre
watch(
  () => gameSettings.disableFogOfWar,
  (disabled) => {
    if (!mapState.mapTiles.length) return
    const CENTER = Math.floor(MAP_CONFIG.size / 2)
    const revealRange = gameSettings.rankRevealRange
    if (disabled) {
      // Tout révéler
      mapState.mapTiles.forEach((tile) => {
        tile.explored = true
      })
    } else {
      // Réappliquer le brouillard — garder uniquement les cases vraiment découvertes
      const exploredIds = new Set<string>(mapState.discoveredLocations)
      for (let dx = -revealRange; dx <= revealRange; dx++) {
        for (let dy = -revealRange; dy <= revealRange; dy++) {
          exploredIds.add(`${CENTER + dx}-${CENTER + dy}`)
        }
      }
      // Inclure toutes les tuiles des cadrans débloqués
      mapState.unlockedChunks.forEach((chunkId) => {
        const [cxStr, cyStr] = chunkId.split('-')
        const cx = parseInt(cxStr)
        const cy = parseInt(cyStr)
        const startX = cx * MAP_CONFIG.chunkSize
        const startY = cy * MAP_CONFIG.chunkSize
        mapState.mapTiles.forEach((tile) => {
          if (
            tile.position.x >= startX &&
            tile.position.x < startX + MAP_CONFIG.chunkSize &&
            tile.position.y >= startY &&
            tile.position.y < startY + MAP_CONFIG.chunkSize
          ) {
            exploredIds.add(tile.id)
          }
        })
      })
      mapState.mapTiles.forEach((tile) => {
        tile.explored = exploredIds.has(tile.id) || tile.current
      })
    }
  },
)

// Store principal
export const useMapStore = () => {
  // Getters
  const currentPosition = computed(() => mapState.currentPosition)
  const mapTiles = computed(() => mapState.mapTiles)
  const selectedTile = computed(() => {
    if (!mapState.selectedTileId) return null
    return mapState.mapTiles.find((tile) => tile.id === mapState.selectedTileId) || null
  })

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

    // Recentrer (arrondir pour éviter les offsets fractionnaires qui cassent CSS Grid)
    mapState.viewportOffset = {
      x: Math.round(
        Math.max(0, Math.min(MAP_CONFIG.size - newViewportSize, centerX - newViewportSize / 2)),
      ),
      y: Math.round(
        Math.max(0, Math.min(MAP_CONFIG.size - newViewportSize, centerY - newViewportSize / 2)),
      ),
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
    if (!tile) return false
    // Les plaines sont des cases neutres non sélectionnables
    if (tile.type === 'plains') return false
    if (tile.explored || gameSettings.disableFogOfWar) {
      mapState.selectedTileId = tileId
      return true
    }
    return false
  }

  const clearSelection = () => {
    mapState.selectedTileId = null
  }

  // ------------------------------------
  // Déplacement de troupes
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
    const distance = Math.max(Math.abs(dest.position.x - sx), Math.abs(dest.position.y - sy))
    if (distance === 0) return 0
    const terrainCost = TERRAIN_MOVE_COST[dest.type] ?? 1
    // Vitesse en tiles/sec de l'unité la plus lente (ou 1.0 par défaut)
    const slowestTps =
      units && units.length > 0
        ? Math.min(...units.map((u) => UNIT_MOVE_SPEED[u.type] ?? 1.0))
        : 1.0
    // Vitesse effective : terrain dur étend le trajet
    const effectiveSpeed = slowestTps / terrainCost
    return Math.round(((distance / effectiveSpeed) * 1000) / gameSettings.gameSpeedMultiplier)
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

  // ------------------------------------
  // Phase 2 — Pillage & garnison régénérable
  // ------------------------------------

  /**
   * Calcule le pillage d'un village et met à jour son stock.
   * Délègue tout le calcul à src/combat/loot.ts (poids des survivants + fraction).
   *
   * @param tileId    Identifiant de la tuile ennemie
   * @param survivors Unités survivantes de l'attaquant (snapshot post-combat)
   */
  const pillageVillage = (tileId: string, survivors: Array<{ type: string; count: number }>) => {
    const tile = getTileById(tileId)
    const empty = { gold: 0, wood: 0, iron: 0, crop: 0 }
    if (!tile?.lootStock) {
      return {
        loot: empty,
        newStock: empty,
        carryCapacity: 0,
        wasCapacityLimited: false,
        wasRecentlyPillaged: false,
      }
    }

    const result = computePillage(tile.lootStock, survivors, tile.lastPillagedAt)

    tile.lootStock = result.newStock
    tile.lastPillagedAt = Date.now()

    return result
  }

  /**
   * Régénère le stock de ressources de tous les villages ennemis encore sur la carte.
   * Appelé périodiquement par le timer ENEMY_REGEN_INTERVAL_MS.
   * Le stock remonte progressivement vers son maximum (reconstitution de 10% par tick).
   */
  const tickLootRegen = () => {
    let changed = false
    for (const tile of mapState.mapTiles) {
      if (tile.type !== 'village_enemy' && tile.type !== 'stronghold') continue
      if (!tile.lootStock) {
        tile.lootStock = generateLootStock(tile.type === 'stronghold')
        changed = true
        continue
      }
      const max = generateLootStock(tile.type === 'stronghold')
      const rate = 0.1 // 10% de régén par tick
      let tileChanged = false
      for (const key of ['gold', 'wood', 'iron', 'crop'] as const) {
        if (tile.lootStock[key] < max[key]) {
          tile.lootStock[key] = Math.min(
            max[key],
            Math.floor(tile.lootStock[key] + max[key] * rate),
          )
          tileChanged = true
        }
      }
      if (tileChanged) changed = true
    }
    if (changed) saveMapState()
  }

  /**
   * Met à jour la garnison de tous les villages ennemis en cours de régénération.
   * La garnison se reconstitue linéairement sur GARRISON_REGEN_DURATION_MS.
   * Si le village a été pillé récemment, la garnison max est réduite à 50%.
   */
  const tickGarrisonRegen = () => {
    const now = Date.now()
    let changed = false
    for (const tile of mapState.mapTiles) {
      if (tile.type !== 'village_enemy' && tile.type !== 'stronghold') continue
      if (!tile.garrison?.regenStartedAt || !tile.garrison.maxUnits) continue

      const elapsed = now - tile.garrison.regenStartedAt
      const progress = Math.min(1, elapsed / GARRISON_REGEN_DURATION_MS)

      if (progress <= 0) continue

      // Réduire la garnison max à 50% si pillé récemment
      const wasRecentlyPillaged =
        tile.lastPillagedAt !== undefined && now - tile.lastPillagedAt < RECENT_PILLAGE_THRESHOLD_MS
      const maxFactor = wasRecentlyPillaged ? 0.5 : 1.0

      // Reconstituer les unités proportionnellement à la progression
      tile.garrison.units = tile.garrison.maxUnits
        .map((u) => ({
          ...u,
          count: Math.floor(u.count * progress * maxFactor),
        }))
        .filter((u) => u.count > 0)

      if (progress >= 1) {
        // Régénération terminée
        tile.garrison.regenStartedAt = undefined
      }

      changed = true
    }
    if (changed) saveMapState()
  }

  // ------------------------------------
  // Système de cadrans (chunks 20x20)
  // ------------------------------------

  /** Retourne l'identifiant du cadran contenant la tuile (x, y) */
  const getChunkIdForTile = (x: number, y: number): string =>
    `${Math.floor(x / MAP_CONFIG.chunkSize)}-${Math.floor(y / MAP_CONFIG.chunkSize)}`

  /** Indique si un cadran est débloqué (ou si le brouillard est désactivé) */
  const isChunkUnlocked = (chunkId: string): boolean =>
    gameSettings.disableFogOfWar || mapState.unlockedChunks.includes(chunkId)

  /**
   * Débloque un cadran : révèle toutes ses tuiles et les enregistre dans discoveredLocations.
   * Sans effet si le cadran est déjà débloqué.
   */
  const unlockChunk = (chunkId: string): boolean => {
    if (mapState.unlockedChunks.includes(chunkId)) return false

    const [cxStr, cyStr] = chunkId.split('-')
    const cx = parseInt(cxStr)
    const cy = parseInt(cyStr)

    // Valider que le cadran est dans les limites de la grille (5x5)
    const maxChunk = MAP_CONFIG.size / MAP_CONFIG.chunkSize - 1
    if (cx < 0 || cx > maxChunk || cy < 0 || cy > maxChunk) return false

    mapState.unlockedChunks.push(chunkId)

    const startX = cx * MAP_CONFIG.chunkSize
    const startY = cy * MAP_CONFIG.chunkSize
    const endX = startX + MAP_CONFIG.chunkSize
    const endY = startY + MAP_CONFIG.chunkSize

    // Révéler toutes les tuiles du cadran
    const exploredSet = new Set(mapState.discoveredLocations)
    mapState.mapTiles.forEach((tile) => {
      if (
        tile.position.x >= startX &&
        tile.position.x < endX &&
        tile.position.y >= startY &&
        tile.position.y < endY
      ) {
        tile.explored = true
        exploredSet.add(tile.id)
      }
    })
    mapState.discoveredLocations = Array.from(exploredSet)

    saveMapState()
    return true
  }

  /**
   * Débloque tous les cadrans orthogonalement adjacents au cadran contenant la tuile donnée.
   * Appelé après une victoire sur une forteresse.
   */
  const unlockAdjacentChunks = (tileId: string): string[] => {
    const tile = getTileById(tileId)
    if (!tile) return []

    const cx = Math.floor(tile.position.x / MAP_CONFIG.chunkSize)
    const cy = Math.floor(tile.position.y / MAP_CONFIG.chunkSize)
    const maxChunk = MAP_CONFIG.size / MAP_CONFIG.chunkSize - 1

    const newlyUnlocked: string[] = []
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ]

    directions.forEach(({ dx, dy }) => {
      const ncx = cx + dx
      const ncy = cy + dy
      if (ncx >= 0 && ncx <= maxChunk && ncy >= 0 && ncy <= maxChunk) {
        const chunkId = `${ncx}-${ncy}`
        if (unlockChunk(chunkId)) newlyUnlocked.push(chunkId)
      }
    })

    return newlyUnlocked
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
      discoveredLocations: mapState.discoveredLocations,
      activeMovements: mapState.activeMovements,
      unlockedChunks: mapState.unlockedChunks,
      zoomLevel: mapState.zoomLevel,
    }

    localStorage.setItem('novavian-map', JSON.stringify(data))
  }

  const loadMapState = (): boolean => {
    try {
      const saved = localStorage.getItem('novavian-map')
      if (saved) {
        const data = JSON.parse(saved)

        // Si les données sauvegardées ont le bon nombre de tuiles, les charger
        const expectedTileCount = MAP_CONFIG.size * MAP_CONFIG.size
        if (data.mapTiles && data.mapTiles.length === expectedTileCount) {
          const exploredBefore = data.mapTiles.filter((t: MapTile) => t.explored).length
          void exploredBefore // utilisé uniquement en debug
          Object.assign(mapState, {
            ...initialMapState,
            ...data,
            // Migration : anciens saves sans unlockedChunks → cadran de départ uniquement
            unlockedChunks: data.unlockedChunks ?? [STARTING_CHUNK_ID],
          })

          // Réappliquer le brouillard de guerre si activé
          // (évite de restaurer une carte entièrement révélée sauvegardée avec fog désactivé)
          if (!gameSettings.disableFogOfWar) {
            const exploredIds = new Set<string>(mapState.discoveredLocations)
            const CENTER = Math.floor(MAP_CONFIG.size / 2)
            const revealRange = gameSettings.rankRevealRange
            // Révéler la zone de départ selon le rang
            for (let dx = -revealRange; dx <= revealRange; dx++) {
              for (let dy = -revealRange; dy <= revealRange; dy++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) <= revealRange) {
                  exploredIds.add(`${CENTER + dx}-${CENTER + dy}`)
                }
              }
            }
            // Révéler toutes les tuiles des cadrans débloqués (évite la désynchronisation)
            mapState.unlockedChunks.forEach((chunkId) => {
              const [cxStr, cyStr] = chunkId.split('-')
              const cx = parseInt(cxStr)
              const cy = parseInt(cyStr)
              const startX = cx * MAP_CONFIG.chunkSize
              const startY = cy * MAP_CONFIG.chunkSize
              const endX = startX + MAP_CONFIG.chunkSize
              const endY = startY + MAP_CONFIG.chunkSize
              mapState.mapTiles.forEach((tile) => {
                if (
                  tile.position.x >= startX &&
                  tile.position.x < endX &&
                  tile.position.y >= startY &&
                  tile.position.y < endY
                ) {
                  exploredIds.add(tile.id)
                }
              })
            })
            mapState.mapTiles.forEach((tile) => {
              tile.explored = exploredIds.has(tile.id) || tile.current
            })
          } else {
            // Fog désactivé — toutes les tuiles restent visibles
          }

          // Recalcule les zones après chargement (migration des anciennes saves sans fortressZones)
          computeFortressZones()

          return true
        }

        // Sinon, charger les autres données mais générer une nouvelle carte
        Object.assign(mapState, {
          ...initialMapState,
          ...data,
          mapTiles: generateInitialMap(),
        })
        computeFortressZones()
        saveMapState()
        return true
      }
    } catch (error) {
      console.error('❌ Error loading map:', error)
    }

    // Aucune carte sauvegardée — générer une nouvelle carte
    mapState.mapTiles = generateInitialMap()
    computeFortressZones()
    saveMapState()

    return false
  }

  const resetMapState = () => {
    Object.assign(mapState, {
      ...initialMapState,
      mapTiles: generateInitialMap(),
    })
    computeFortressZones()
    saveMapState()
  }

  // ====================================================================
  // ZONES D'INFLUENCE DES FORTERESSES
  // ====================================================================

  /** Dérive l'état d'hostilité à partir du niveau (0–100) */
  const getHostilityStateFromLevel = (level: number): HostilityState => {
    if (level >= HOSTILITY_THRESHOLD_HOSTILE) return 'hostile'
    if (level >= HOSTILITY_THRESHOLD_WARNED) return 'warned'
    return 'neutral'
  }

  /**
   * (Re)calcule toutes les zones d'influence depuis les tuiles actuelles.
   * Préserve les niveaux d'hostilité existants.
   * À appeler après génération/chargement de la carte.
   */
  const computeFortressZones = (): void => {
    const fortresses = mapState.mapTiles.filter((t) => t.type === 'stronghold')
    const villages = mapState.mapTiles.filter((t) => t.type === 'village_enemy')
    const newZones: Record<string, FortressZone> = {}

    for (const fortress of fortresses) {
      const { x: fx, y: fy } = fortress.position
      const villageIds = villages
        .filter((v) => {
          const dx = Math.abs(v.position.x - fx)
          const dy = Math.abs(v.position.y - fy)
          return Math.max(dx, dy) <= FORTRESS_INFLUENCE_RADIUS
        })
        .map((v) => v.id)

      // Préserver l'état d'hostilité existant si la zone était déjà connue
      const existing = mapState.fortressZones[fortress.id]
      // Puissance = villages dans la zone + bonus par niveau de forteresse (level - 1 forteresses absorbées)
      const fortressLevel = fortress.level ?? 1
      newZones[fortress.id] = {
        fortressTileId: fortress.id,
        villageIds,
        influenceRadius: FORTRESS_INFLUENCE_RADIUS,
        power: villageIds.length + (fortressLevel - 1),
        hostilityLevel: existing?.hostilityLevel ?? 0,
        hostilityState: existing?.hostilityState ?? 'neutral',
        nextAttackAt: existing?.nextAttackAt,
      }
    }

    mapState.fortressZones = newZones
  }

  /** Retourne la zone d'influence d'une forteresse */
  const getFortressZone = (fortressTileId: string): FortressZone | undefined =>
    mapState.fortressZones[fortressTileId]

  /** Retourne le tileId de la forteresse qui contrôle ce village */
  const getControllingFortress = (villageTileId: string): string | undefined =>
    Object.values(mapState.fortressZones).find((z) => z.villageIds.includes(villageTileId))
      ?.fortressTileId

  /**
   * Retourne tous les IDs de tuiles d'une zone d'influence (forteresse incluse).
   * Utile pour le rendu de l'overlay UI.
   */
  const getInfluenceZoneTileIds = (fortressTileId: string): Set<string> => {
    const zone = mapState.fortressZones[fortressTileId]
    if (!zone) return new Set()
    const set = new Set(zone.villageIds)
    set.add(fortressTileId)
    return set
  }

  /**
   * Augmente l'hostilité d'une forteresse suite à une attaque.
   * Planifie la première attaque si on franchit le seuil hostile.
   */
  const increaseHostility = (fortressTileId: string, amount: number): void => {
    const zone = mapState.fortressZones[fortressTileId]
    if (!zone) return

    const prevState = zone.hostilityState
    zone.hostilityLevel = Math.min(100, zone.hostilityLevel + amount)
    zone.hostilityState = getHostilityStateFromLevel(zone.hostilityLevel)

    if (prevState !== 'hostile' && zone.hostilityState === 'hostile') {
      zone.nextAttackAt = Date.now() + HOSTILE_ATTACK_INTERVAL_MS
    }

    saveMapState()
  }

  /**
   * À appeler quand le joueur attaque une tuile ennemie.
   * Augmente l'hostilité de la forteresse responsable.
   */
  const onEnemyTileAttacked = (tileId: string): void => {
    const tile = getTileById(tileId)
    if (!tile) return

    if (tile.type === 'stronghold') {
      increaseHostility(tileId, HOSTILITY_GAIN_FORTRESS_ATTACK)
    } else if (tile.type === 'village_enemy') {
      const fortressId = getControllingFortress(tileId)
      if (fortressId) increaseHostility(fortressId, HOSTILITY_GAIN_VILLAGE_ATTACK)
    }
  }

  /**
   * Traite toutes les attaques hostiles dont l'heure est passée.
   * Retourne la liste des zones déclenchées (pour notification UI).
   */
  const processHostileAttacks = (): FortressZone[] => {
    const now = Date.now()
    const triggered: FortressZone[] = []

    for (const zone of Object.values(mapState.fortressZones)) {
      if (zone.hostilityState !== 'hostile') continue
      if (!zone.nextAttackAt || zone.nextAttackAt > now) continue
      triggered.push(zone)
      zone.nextAttackAt = now + HOSTILE_ATTACK_INTERVAL_MS
    }

    if (triggered.length > 0) saveMapState()
    return triggered
  }

  /**
   * Décroissance naturelle de l'hostilité — appelé toutes les 30s par le timer.
   */
  const tickHostilityDecay = (): void => {
    let changed = false
    for (const zone of Object.values(mapState.fortressZones)) {
      if (zone.hostilityLevel <= 0) continue
      zone.hostilityLevel = Math.max(0, zone.hostilityLevel - HOSTILITY_DECAY_PER_TICK)
      const newState = getHostilityStateFromLevel(zone.hostilityLevel)
      if (newState !== zone.hostilityState) {
        zone.hostilityState = newState
        if (newState !== 'hostile') zone.nextAttackAt = undefined
      }
      changed = true
    }
    if (changed) saveMapState()
  }

  /**
   * Calcule le montant des ressources pillées par une attaque hostile.
   * Proportionnel au nombre de villages contrôlés.
   */
  const computeHostileRaid = (
    zone: FortressZone,
  ): { wood: number; clay: number; iron: number; crop: number } => {
    const base = Math.max(5, zone.power * HOSTILE_LOOT_PER_POWER)
    return {
      wood: base,
      clay: base,
      iron: Math.floor(base / 2),
      crop: base,
    }
  }

  return {
    // État
    mapState,
    currentPosition,
    mapTiles,
    selectedTile,

    // Actions de sélection
    selectTile,
    clearSelection,

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

    // Déplacement de troupes
    calculateTravelTimeMs,
    dispatchTroops,
    resolveMovement,
    getArrivedMovements,
    getMovementsToTile,

    // Phase 2 — Pillage & garnison régénérable
    pillageVillage,
    tickLootRegen,
    tickGarrisonRegen,

    // Cadrans
    getChunkIdForTile,
    isChunkUnlocked,
    unlockChunk,
    unlockAdjacentChunks,

    // Zones d'influence & Hostilité
    computeFortressZones,
    getFortressZone,
    getControllingFortress,
    getInfluenceZoneTileIds,
    increaseHostility,
    onEnemyTileAttacked,
    processHostileAttacks,
    tickHostilityDecay,
    computeHostileRaid,

    // Persistance
    saveMapState,
    loadMapState,
    resetMapState,
  }
}

export type MapStore = ReturnType<typeof useMapStore>
