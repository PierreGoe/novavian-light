import { reactive, computed, watch } from 'vue'
import { createRawGrid } from '@/utils/map/TerrainGrid'
import { smoothTerrain } from '@/utils/map/CellularAutomata'
import type { TerrainType as CATerrainType } from '@/utils/map/TerrainTypes'
import { TERRAIN_CONFIG } from '@/utils/map/TerrainTypes'
import { GARRISON_REGEN_DURATION_MS, RECENT_PILLAGE_THRESHOLD_MS } from '@/config'
import { gameSettings } from '@/stores/gameSettingsStore'
import { computePillage } from '@/combat/loot'
import { getVillageDev, getHostileAttackIntervalMs, PRESSURE } from '@/game/timePressure'
import { TERRAIN_BONUS } from '@/data/resources'
import { debounce } from '@/utils/debounce'
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
  /** Timestamp de la dernière application du decay (pour calcul lazy) */
  lastDecayAt?: number
  /**
   * Fatigue militaire 0–100 : monte quand le joueur repousse (ou saigne) un raid
   * de la zone, décroît avec le temps. Au-delà de FATIGUE_EXHAUSTED_THRESHOLD la
   * zone est épuisée et ne peut plus lancer d'attaque — c'est la récompense
   * stratégique d'une défense réussie (mur + armée défensive).
   */
  fatigue?: number
  /** Timestamp de la dernière application du decay de fatigue (calcul lazy) */
  lastFatigueDecayAt?: number
}

// ====================================================================
// CONSTANTES — Hostilité
// ====================================================================

/** Rayon de Chebyshev de l’influence d’une forteresse (en cases) */
const FORTRESS_INFLUENCE_RADIUS = 4

/** Seuils de passage d’état */
const HOSTILITY_THRESHOLD_WARNED = 30
const HOSTILITY_THRESHOLD_HOSTILE = 55

/** Gain d’hostilité lors d’une attaque sur un village de la zone */
export const HOSTILITY_GAIN_VILLAGE_ATTACK = 25
/** Gain d’hostilité lors d’une attaque directe sur la forteresse */
export const HOSTILITY_GAIN_FORTRESS_ATTACK = 55

/** Intervalle entre deux attaques hostiles (en ms) */
export const HOSTILE_ATTACK_INTERVAL_MS = 10_000 // 10 secondes (ajustable)

/** Décroissance d’hostilité par tick du timer (toutes les 30s) */
const HOSTILITY_DECAY_PER_TICK = 2

/** Intervalle de decay en ms (30s par tick de decay) */
const HOSTILITY_DECAY_INTERVAL_MS = 30_000

/** Réduction d’hostilité quand le joueur repousse un raid ennemi */
export const HOSTILITY_REDUCE_RAID_REPELLED = 15

/** Ressources pillées par attaque hostile, par village contrôlé */
const HOSTILE_LOOT_PER_POWER = 4

// --- Fatigue militaire des zones (récompense de la défense réussie) ---

/** Fatigue gagnée par la zone quand le joueur repousse un raid */
export const FATIGUE_GAIN_RAID_REPELLED = 40
/** Fatigue max gagnée sur un raid réussi mais coûteux (proportionnelle aux pertes) */
export const FATIGUE_GAIN_COSTLY_VICTORY_MAX = 20
/** Au-delà de ce seuil, la zone est épuisée : incapable d'attaquer tant que la fatigue ne redescend pas */
export const FATIGUE_EXHAUSTED_THRESHOLD = 60
/** Décroissance de fatigue par tick de HOSTILITY_DECAY_INTERVAL_MS */
const FATIGUE_DECAY_PER_TICK = 4
/** Malus de puissance de raid : raidPower × (1 − fatigue / FATIGUE_POWER_MALUS_DIVISOR) — −50 % à 100 de fatigue */
export const FATIGUE_POWER_MALUS_DIVISOR = 200

/**
 * Fourchette du trésor caché dans les ruines générées à la création de la carte.
 * Récompense d'exploration unique (une fouille par ruine et par partie) pensée
 * pour booster l'économie de début de partie sans risque de farm répété.
 * Les villages rasés en cours de partie deviennent des ruines SANS trésor.
 */
export const RUIN_TREASURE_RANGE = {
  gold: { min: 30, max: 80 },
  wood: { min: 50, max: 120 },
  iron: { min: 50, max: 120 },
  crop: { min: 50, max: 120 },
} as const

/** Butin tiré d'un trésor de ruines (dans la fourchette RUIN_TREASURE_RANGE) */
export interface RuinTreasureLoot {
  gold: number
  wood: number
  iron: number
  crop: number
}

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
  /** Vrai si les troupes sont en train de rentrer (après le combat) */
  isReturning?: boolean
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
 * Référence : infanterie = 0.1 case/sec = 1 case toutes les 10 secondes.
 */
export const UNIT_MOVE_SPEED: Record<string, number> = {
  infantry: 0.1, // 1 case / 10 sec — référence
  archer: 0.08, // Moins mobile (équipement + carquois)
  cavalry: 0.25, // Très rapide
  siege: 0.03, // Engins de siège — extrêmement lent

  // Gaulois — mobilité supérieure sur chaque rôle (identité de race)
  gaul_phalange: 0.11,
  gaul_franc_archer: 0.13,
  gaul_foudre: 0.3, // l'unité la plus rapide du jeu
  gaul_belier: 0.05,

  // Romains — lourds et lents, contrepartie de leur puissance brute
  roman_legionnaire: 0.09,
  roman_sagittaire: 0.09,
  roman_cavalier_lourd: 0.2,
  roman_onagre: 0.025,

  // Germains — rapides à produire, vitesse dans la moyenne haute
  german_guerrier: 0.11,
  german_chasseur: 0.12,
  german_cavalier_hache: 0.27,
  german_belier: 0.04,
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
  /**
   * Développement D_v du village au dernier (re)dimensionnement de la garnison
   * (pression du temps). Absent = 1. Ne redescend jamais : une garnison déjà
   * grossie reste grossie même si l'horloge de mission repart de zéro.
   */
  lastGrowthDev?: number
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
  /**
   * Niveau de destruction infligé par les machines de siège (0–100).
   * 100 = le village bascule automatiquement en ruines.
   * Non défini = intact (équivalent à 0).
   */
  destructionLevel?: number
  /**
   * Vrai tant que le trésor des ruines n'a pas été fouillé.
   * Posé uniquement sur les ruines générées à la création de la carte —
   * les villages/forteresses rasés en cours de partie n'en portent pas.
   */
  hasTreasure?: boolean
  /** Timestamp réel de la fouille du trésor (absent = jamais fouillé ou ruine sans trésor) */
  treasureLootedAt?: number
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

// ====================================================================
// ESTIMATION DE GARNISON (aide à la décision avant attaque)
// ====================================================================
//
// La vraie garnison (src/components/map/LargeMapExplorationView.vue,
// fonction locale `generateEnemyGarrison`) n'est générée qu'au tout premier
// combat sur une tuile — tant qu'elle n'a pas été attaquée, `tile.garrison`
// est `undefined` et on ne doit surtout pas la faire générer juste pour
// l'afficher (ça romprait le côté "lazy" et pourrait désynchroniser une
// génération en cours de modification ailleurs).
//
// Les constantes ci-dessous ne font que MIROITER la forme du générateur réel
// (mêmes bases `enemyBaseInfantry` / `enemyStrongholdInfantry`, même ordre de
// grandeur de variation) pour produire une fourchette honnête, PAS une copie
// exacte de son aléatoire (archer conditionnel à 50%, cavalerie fixe, etc.).
//
// ⚠️ À REVOIR si `generateEnemyGarrison` change de formule — ajuster les
// constantes ci-dessous en conséquence, elles sont volontairement isolées et
// nommées pour rester faciles à recaler. Les deux appliquent le même
// multiplicateur de pression du temps `getVillageDev(tile)` (src/game/
// timePressure.ts) : si l'un des deux change, recaler l'autre.

/** Variation aléatoire max reproduite de `generateEnemyGarrison` (Math.floor(Math.random() * 3) → 0..2) */
const GARRISON_ESTIMATE_INFANTRY_VARIATION_MAX = 2
/** Archers d'un village : présents ~50% du temps, 1 à 3 unités (1 + variation 0..2) */
const GARRISON_ESTIMATE_VILLAGE_ARCHER_MAX = 3
/** Archers d'une forteresse : toujours présents, 3 à 5 unités (3 + variation 0..2) */
const GARRISON_ESTIMATE_STRONGHOLD_ARCHER_MAX = 5
/** Cavalerie d'une forteresse : toujours 2 unités fixes dans le générateur réel */
const GARRISON_ESTIMATE_STRONGHOLD_CAVALRY = 2

/** Seuils (nombre d'unités) séparant les tiers de force affichés au joueur */
const GARRISON_STRENGTH_TIER_LOW_MAX = 5
const GARRISON_STRENGTH_TIER_MID_MAX = 10

/** Tier de force lisible pour un joueur, dérivé d'un nombre d'unités */
export type GarrisonStrengthLabel = 'Faible' | 'Modérée' | 'Forte'

const garrisonStrengthLabel = (units: number): GarrisonStrengthLabel => {
  if (units <= GARRISON_STRENGTH_TIER_LOW_MAX) return 'Faible'
  if (units <= GARRISON_STRENGTH_TIER_MID_MAX) return 'Modérée'
  return 'Forte'
}

/** Résultat de `estimateGarrisonStrength`, prêt à afficher dans TileDetails */
export interface GarrisonStrengthEstimate {
  /** true si la garnison a déjà été générée (tuile déjà attaquée) → donnée exacte, pas une estimation */
  isExact: boolean
  /** Nombre d'unités approximatif (ou exact si isExact) — utile pour un tri/affichage compact */
  approxUnits: number
  /** Borne haute de la fourchette estimée (= approxUnits si isExact) */
  approxUnitsMax: number
  /** Tier de force lisible (Faible / Modérée / Forte) */
  label: GarrisonStrengthLabel
  /** Texte prêt à afficher, ex. "~3-8 unités" ou "12 unités (garnison connue)" */
  text: string
}

/**
 * Estime la force de la garnison ennemie d'une tuile, SANS jamais générer ni
 * lire/écrire `tile.garrison` de façon destructive — lecture seule, appelable
 * à tout moment (y compris avant le premier combat) pour aider le joueur à
 * décider s'il attaque ou non.
 *
 * - Si `tile.garrison` existe déjà (post-1er-combat), on résume les vraies
 *   unités actuelles (somme des `count`) — donnée exacte.
 * - Sinon, on approxime à partir des réglages `gameSettings.enemyBaseInfantry`
 *   / `enemyStrongholdInfantry` (voir note plus haut sur les limites de cette
 *   estimation).
 */
export const estimateGarrisonStrength = (tile: MapTile): GarrisonStrengthEstimate => {
  const dev = getVillageDev(tile)

  // Cas 1 — garnison réelle déjà connue (tuile déjà attaquée au moins une fois)
  if (tile.garrison) {
    const total = tile.garrison.units.reduce((sum, u) => sum + u.count, 0)
    // Croissance en attente : la garnison ne sera re-grossie qu'au prochain combat
    // (applyVillageGrowth), on reflète ici ce qui attendra réellement l'attaquant.
    // max(1, …) : une garnison déjà grossie ne redescend jamais.
    const growthPending = Math.max(1, dev / (tile.garrison.lastGrowthDev ?? 1))
    const effective = Math.round(total * growthPending)
    const isGrowing = effective > total
    return {
      isExact: !isGrowing,
      approxUnits: effective,
      approxUnitsMax: effective,
      label: garrisonStrengthLabel(effective),
      text: isGrowing
        ? `~${effective} unités (garnison en expansion)`
        : `${total} unité${total > 1 ? 's' : ''} (garnison connue)`,
    }
  }

  // Cas 2 — jamais attaquée : approximation à partir de la même base que generateEnemyGarrison
  const isStronghold = tile.type === 'stronghold'
  const baseInfantry = isStronghold
    ? gameSettings.enemyStrongholdInfantry
    : gameSettings.enemyBaseInfantry

  const minUnits = Math.round(baseInfantry * dev)
  let maxUnits = Math.round((baseInfantry + GARRISON_ESTIMATE_INFANTRY_VARIATION_MAX) * dev)

  if (isStronghold) {
    // Forteresse : archers + cavalerie systématiquement présents dans le générateur réel
    maxUnits += Math.round(
      (GARRISON_ESTIMATE_STRONGHOLD_ARCHER_MAX + GARRISON_ESTIMATE_STRONGHOLD_CAVALRY) * dev,
    )
  } else {
    // Village : archers présents environ 1 fois sur 2 → seulement inclus dans la borne haute
    maxUnits += Math.round(GARRISON_ESTIMATE_VILLAGE_ARCHER_MAX * dev)
  }

  const approxUnits = Math.round((minUnits + maxUnits) / 2)

  return {
    isExact: false,
    approxUnits,
    approxUnitsMax: maxUnits,
    label: garrisonStrengthLabel(approxUnits),
    text: isStronghold
      ? `~${minUnits}-${maxUnits} unités + soutien (archers, cavalerie)`
      : `~${minUnits}-${maxUnits} unités`,
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
        // Les ruines d'origine cachent un trésor fouillable une fois par partie
        hasTreasure: type === 'ruins' ? true : undefined,
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

  /**
   * Crée un mouvement de retour après le combat.
   * La durée du retour est identique à celle de l'aller (symétrique).
   * @param movement - Le mouvement d'origine
   * @param survivors - Les unités survivantes après le combat (si omis, utilise le snapshot du départ)
   */
  const createReturnMovement = (
    movement: TroopMovement,
    survivors?: MovementUnit[],
  ): TroopMovement => {
    const travelDuration = movement.arrivalTime - movement.departureTime
    const now = Date.now()
    const returnMovement: TroopMovement = {
      id: `mov-ret-${now}`,
      sourceTileId: movement.targetTileId,
      targetTileId: movement.sourceTileId,
      departureTime: now,
      arrivalTime: now + travelDuration,
      units: survivors ?? movement.units,
      isReturning: true,
    }
    mapState.activeMovements.push(returnMovement)
    saveMapState()
    return returnMovement
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
   * Fouille le trésor d'une ruine : tire un butin dans RUIN_TREASURE_RANGE et
   * marque la ruine comme fouillée (une seule fouille par ruine et par partie).
   * Retourne null si la tuile n'est pas une ruine au trésor intact.
   */
  const lootRuinTreasure = (tileId: string): RuinTreasureLoot | null => {
    const tile = getTileById(tileId)
    if (!tile || tile.type !== 'ruins' || !tile.hasTreasure) return null

    const roll = (range: { min: number; max: number }) =>
      range.min + Math.floor(Math.random() * (range.max - range.min + 1))

    const loot: RuinTreasureLoot = {
      gold: roll(RUIN_TREASURE_RANGE.gold),
      wood: roll(RUIN_TREASURE_RANGE.wood),
      iron: roll(RUIN_TREASURE_RANGE.iron),
      crop: roll(RUIN_TREASURE_RANGE.crop),
    }

    tile.hasTreasure = undefined
    tile.treasureLootedAt = Date.now()
    saveMapState()
    return loot
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
      // Plafond déterministe (plus de re-tirage aléatoire à chaque tick) qui
      // grossit avec le développement du village : un village qui a prospéré
      // est aussi plus rentable à piller.
      const isStronghold = tile.type === 'stronghold'
      const base = Math.round(
        (isStronghold ? 200 * (tile.level ?? 1) : 80) * getVillageDev(tile),
      )
      const max: EnemyLootStock = {
        gold: base,
        wood: base,
        iron: Math.floor(base * 0.7),
        crop: base,
      }
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

  /**
   * Pression du temps — re-dimensionne une garnison existante si le développement
   * du village a suffisamment monté depuis le dernier ajustement (GARRISON_GROWTH_STEP).
   * Appelée paresseusement juste avant un combat : pas de boucle périodique.
   * Ne réduit jamais une garnison (ratio plancher à 1) — une garnison grossie le reste,
   * même quand l'horloge de mission repart de zéro.
   */
  const applyVillageGrowth = (tile: MapTile): void => {
    if (!tile.garrison) return
    if (tile.type !== 'village_enemy' && tile.type !== 'stronghold') return

    const dev = getVillageDev(tile)
    const lastDev = tile.garrison.lastGrowthDev ?? 1
    if (dev < lastDev * PRESSURE.GARRISON_GROWTH_STEP) return

    const ratio = dev / lastDev
    const grow = (units: GarrisonUnit[]) =>
      units.map((u) => ({ ...u, count: Math.max(1, Math.round(u.count * ratio)) }))

    // Une garnison vide (vaincue, pas encore régénérée) ne renaît pas par la
    // croissance — seuls les effectifs existants et le plafond de régén grossissent.
    if (tile.garrison.units.length > 0) tile.garrison.units = grow(tile.garrison.units)
    if (tile.garrison.maxUnits) tile.garrison.maxUnits = grow(tile.garrison.maxUnits)
    tile.garrison.lastGrowthDev = dev
    saveMapState()
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
  //
  // La sérialisation ci-dessous porte sur la grille complète (jusqu'à 2500 tuiles) et peut
  // être déclenchée très souvent (déplacement de la vue, combats, raids...). On la debounce
  // pour éviter d'empiler des JSON.stringify synchrones coûteux sur le thread principal.
  const writeMapState = () => {
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
      fortressZones: mapState.fortressZones,
    }

    localStorage.setItem('novavian-map', JSON.stringify(data))
  }

  const debouncedWriteMapState = debounce(writeMapState, 400)

  const saveMapState = () => debouncedWriteMapState()

  /** Force l'écriture immédiate d'une sauvegarde en attente (fermeture/masquage de l'onglet). */
  const flushMapState = () => debouncedWriteMapState.flush()

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
        fatigue: existing?.fatigue,
        lastFatigueDecayAt: existing?.lastFatigueDecayAt,
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
    zone.lastDecayAt = Date.now()
    zone.hostilityState = getHostilityStateFromLevel(zone.hostilityLevel)

    if (prevState !== 'hostile' && zone.hostilityState === 'hostile') {
      zone.nextAttackAt = Date.now() + getHostileAttackIntervalMs(HOSTILE_ATTACK_INTERVAL_MS)
    }

    saveMapState()
  }

  /**
   * Réduit l'hostilité d'une forteresse quand le joueur repousse un raid.
   * Passe l'état à 'warned' si on descend sous le seuil hostile,
   * ou à 'neutral' si on descend sous le seuil warned.
   */
  const reduceHostility = (fortressTileId: string, amount: number): void => {
    const zone = mapState.fortressZones[fortressTileId]
    if (!zone) return

    zone.hostilityLevel = Math.max(0, zone.hostilityLevel - amount)
    const newState = getHostilityStateFromLevel(zone.hostilityLevel)
    if (newState !== zone.hostilityState) {
      zone.hostilityState = newState
      if (newState !== 'hostile') zone.nextAttackAt = undefined
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

      // Garde brouillard : une forteresse jamais explorée ne raide JAMAIS le
      // joueur, quel que soit son état d'hostilité — un raid surgi du brouillard
      // total serait à la fois injuste et une fuite d'information sur la carte.
      const fortressTile = getTileById(zone.fortressTileId)
      if (!fortressTile?.explored) {
        zone.nextAttackAt = now + getHostileAttackIntervalMs(HOSTILE_ATTACK_INTERVAL_MS)
        continue
      }

      // Zone épuisée (défenses du joueur repoussées) : incapable d'attaquer.
      // On repousse nextAttackAt du temps de récupération réel pour que les
      // countdowns UI (bannière, timers) restent honnêtes.
      const fatigue = getEffectiveFatigue(zone.fortressTileId)
      if (fatigue >= FATIGUE_EXHAUSTED_THRESHOLD) {
        const ticksToRecover = Math.ceil(
          (fatigue - FATIGUE_EXHAUSTED_THRESHOLD + 1) / FATIGUE_DECAY_PER_TICK,
        )
        zone.nextAttackAt =
          now +
          Math.max(
            ticksToRecover * HOSTILITY_DECAY_INTERVAL_MS,
            getHostileAttackIntervalMs(HOSTILE_ATTACK_INTERVAL_MS),
          )
        continue
      }

      triggered.push(zone)
      // Planifier la prochaine attaque sans déclencher de sauvegarde immédiate
      // (intervalle resserré par la pression du temps)
      zone.nextAttackAt = now + getHostileAttackIntervalMs(HOSTILE_ATTACK_INTERVAL_MS)
    }

    return triggered
  }

  /**
   * Applique le lazy decay : calcule combien de ticks de decay se sont écoulés
   * depuis lastDecayAt et les applique d'un coup. Aucun timer périodique nécessaire.
   * Retourne true si au moins une zone a changé d'état.
   */
  const applyLazyDecay = (): boolean => {
    const now = Date.now()
    let stateChanged = false

    for (const zone of Object.values(mapState.fortressZones)) {
      // Decay de la fatigue militaire (même mécanique lazy, compteur séparé)
      if (zone.fatigue && zone.fatigue > 0) {
        const lastFatigueDecay = zone.lastFatigueDecayAt ?? now
        const fatigueTicks = Math.floor((now - lastFatigueDecay) / HOSTILITY_DECAY_INTERVAL_MS)
        if (fatigueTicks > 0) {
          zone.lastFatigueDecayAt = now
          zone.fatigue = Math.max(0, zone.fatigue - fatigueTicks * FATIGUE_DECAY_PER_TICK)
        }
      }

      if (zone.hostilityLevel <= 0) continue
      const lastDecay = zone.lastDecayAt ?? now
      const elapsed = now - lastDecay
      const ticks = Math.floor(elapsed / HOSTILITY_DECAY_INTERVAL_MS)
      if (ticks <= 0) continue

      zone.lastDecayAt = now
      const reduction = ticks * HOSTILITY_DECAY_PER_TICK
      zone.hostilityLevel = Math.max(0, zone.hostilityLevel - reduction)
      const newState = getHostilityStateFromLevel(zone.hostilityLevel)
      if (newState !== zone.hostilityState) {
        zone.hostilityState = newState
        if (newState !== 'hostile') zone.nextAttackAt = undefined
        stateChanged = true
      }
    }

    if (stateChanged) saveMapState()
    return stateChanged
  }

  /**
   * Retourne le niveau d'hostilité effectif d'une zone (avec lazy decay appliqué).
   * Utile pour l'affichage UI sans effet de bord lourd.
   */
  const getEffectiveHostility = (fortressTileId: string): number => {
    const zone = mapState.fortressZones[fortressTileId]
    if (!zone || zone.hostilityLevel <= 0) return zone?.hostilityLevel ?? 0
    const lastDecay = zone.lastDecayAt ?? Date.now()
    const elapsed = Date.now() - lastDecay
    const ticks = Math.floor(elapsed / HOSTILITY_DECAY_INTERVAL_MS)
    return Math.max(0, zone.hostilityLevel - ticks * HOSTILITY_DECAY_PER_TICK)
  }

  /**
   * Fatigue militaire effective d'une zone (decay lazy appliqué en lecture seule).
   * Utilisable à tout moment pour l'affichage ou les décisions de raid.
   */
  const getEffectiveFatigue = (fortressTileId: string): number => {
    const zone = mapState.fortressZones[fortressTileId]
    if (!zone?.fatigue || zone.fatigue <= 0) return 0
    const lastDecay = zone.lastFatigueDecayAt ?? Date.now()
    const ticks = Math.floor((Date.now() - lastDecay) / HOSTILITY_DECAY_INTERVAL_MS)
    return Math.max(0, zone.fatigue - ticks * FATIGUE_DECAY_PER_TICK)
  }

  /**
   * Ajoute de la fatigue militaire à une zone (défense réussie du joueur, ou raid
   * victorieux mais coûteux). Matérialise d'abord le decay en cours pour repartir
   * d'une valeur juste, plafonne à 100.
   */
  const addZoneFatigue = (fortressTileId: string, amount: number): void => {
    const zone = mapState.fortressZones[fortressTileId]
    if (!zone || amount <= 0) return

    zone.fatigue = Math.min(100, getEffectiveFatigue(fortressTileId) + amount)
    zone.lastFatigueDecayAt = Date.now()
    saveMapState()
  }

  /** true si la zone est trop épuisée pour lancer une attaque */
  const isZoneExhausted = (fortressTileId: string): boolean =>
    getEffectiveFatigue(fortressTileId) >= FATIGUE_EXHAUSTED_THRESHOLD

  /**
   * Retourne le timestamp de la prochaine attaque hostile (min de toutes les zones).
   * Retourne undefined si aucune zone n'est hostile.
   */
  const getNextRaidTimestamp = (): number | undefined => {
    let earliest: number | undefined
    for (const zone of Object.values(mapState.fortressZones)) {
      if (zone.hostilityState !== 'hostile' || !zone.nextAttackAt) continue
      if (earliest === undefined || zone.nextAttackAt < earliest) {
        earliest = zone.nextAttackAt
      }
    }
    return earliest
  }

  /** @deprecated Conservé pour rétrocompatibilité, appelle applyLazyDecay */
  const tickHostilityDecay = (): void => {
    applyLazyDecay()
  }

  /**
   * Développement total d'une zone : somme des D_v de ses villages encore debout
   * + bonus de niveau de forteresse. Vaut `zone.power` quand la pression est neutre
   * (G = 1) ; chute quand le joueur rase des villages de la zone (contre-jeu).
   */
  const getZoneDevelopment = (zone: FortressZone): number => {
    let dev = 0
    for (const villageId of zone.villageIds) {
      const village = getTileById(villageId)
      if (!village || village.type !== 'village_enemy') continue
      dev += getVillageDev(village)
    }
    const fortress = getTileById(zone.fortressTileId)
    return dev + ((fortress?.level ?? 1) - 1)
  }

  /**
   * Phase « conquérante » de la pression du temps : les zones dont un village
   * s'est assez développé deviennent menaçantes d'elles-mêmes, sans provocation.
   * On pose un PLANCHER d'hostilité (le decay ne peut plus pacifier la zone tant
   * que ses villages ne sont pas rasés). Limité aux zones dont la forteresse est
   * explorée — un raid surgi du brouillard total serait injuste.
   * Retourne true si une zone a changé d'état.
   */
  const applyConquerorPressure = (): boolean => {
    let stateChanged = false

    for (const zone of Object.values(mapState.fortressZones)) {
      const fortress = getTileById(zone.fortressTileId)
      if (!fortress || fortress.type !== 'stronghold' || !fortress.explored) continue

      let maxDev = 0
      for (const villageId of zone.villageIds) {
        const village = getTileById(villageId)
        if (!village || village.type !== 'village_enemy') continue
        maxDev = Math.max(maxDev, getVillageDev(village))
      }

      let floor = 0
      if (maxDev >= PRESSURE.CONQUEROR_HOSTILE_DEV) floor = HOSTILITY_THRESHOLD_HOSTILE
      else if (maxDev >= PRESSURE.CONQUEROR_WARNED_DEV) floor = HOSTILITY_THRESHOLD_WARNED
      if (floor === 0 || zone.hostilityLevel >= floor) continue

      const prevState = zone.hostilityState
      zone.hostilityLevel = floor
      // Le plancher vient d'être posé : repartir le decay d'ici (sinon un vieux
      // lastDecayAt le rognerait immédiatement au prochain applyLazyDecay)
      zone.lastDecayAt = Date.now()
      zone.hostilityState = getHostilityStateFromLevel(zone.hostilityLevel)

      if (prevState !== 'hostile' && zone.hostilityState === 'hostile') {
        zone.nextAttackAt = Date.now() + getHostileAttackIntervalMs(HOSTILE_ATTACK_INTERVAL_MS)
      }
      if (prevState !== zone.hostilityState) stateChanged = true
    }

    if (stateChanged) saveMapState()
    return stateChanged
  }

  /**
   * Calcule le montant des ressources pillées par une attaque hostile.
   * Proportionnel au développement réel des villages de la zone (pression du temps).
   */
  const computeHostileRaid = (
    zone: FortressZone,
  ): { wood: number; clay: number; iron: number; crop: number } => {
    const base = Math.max(5, Math.round(getZoneDevelopment(zone) * HOSTILE_LOOT_PER_POWER))
    return {
      wood: base,
      clay: base,
      iron: Math.floor(base / 2),
      crop: base,
    }
  }

  // ====================================================================
  // DESTRUCTION DE VILLAGE PAR LES MACHINES DE SIÈGE
  // ====================================================================

  /**
   * Applique un niveau de destruction à un village ennemi.
   * Accumule les destructions successives ; convertit en ruines quand le total >= 100.
   *
   * @param tileId   Identifiant du village cible (doit être de type 'village_enemy')
   * @param amount   Points de destruction à ajouter (0–100)
   * @returns        Le nouveau niveau (0–100) et un booléen indiquant si le village est rasé
   */
  const applyVillageDestruction = (
    tileId: string,
    amount: number,
  ): { newLevel: number; isRuined: boolean } => {
    const tile = getTileById(tileId)
    if (!tile || tile.type !== 'village_enemy') return { newLevel: 0, isRuined: false }

    const previous = tile.destructionLevel ?? 0
    const newLevel = Math.min(100, previous + amount)
    tile.destructionLevel = newLevel

    const isRuined = newLevel >= 100
    if (isRuined) {
      // Conversion en ruines : nettoyer les données de combat
      tile.type = 'ruins'
      tile.garrison = undefined
      tile.lootStock = undefined
      tile.destructionLevel = undefined
      // Mettre à jour les zones de forteresse (le village n'est plus dans la zone)
      computeFortressZones()
    }

    saveMapState()
    return { newLevel, isRuined }
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
    createReturnMovement,
    getArrivedMovements,
    getMovementsToTile,

    // Phase 2 — Pillage & garnison régénérable
    pillageVillage,
    lootRuinTreasure,
    tickLootRegen,
    tickGarrisonRegen,
    applyVillageGrowth,

    // Destruction de village
    applyVillageDestruction,

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
    reduceHostility,
    onEnemyTileAttacked,
    processHostileAttacks,
    tickHostilityDecay,
    applyLazyDecay,
    getEffectiveHostility,
    getNextRaidTimestamp,
    computeHostileRaid,
    getZoneDevelopment,
    applyConquerorPressure,
    getEffectiveFatigue,
    addZoneFatigue,
    isZoneExhausted,

    // Persistance
    saveMapState,
    flushMapState,
    loadMapState,
    resetMapState,
  }
}

export type MapStore = ReturnType<typeof useMapStore>
