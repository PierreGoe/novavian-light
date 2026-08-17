import { reactive, computed, ref } from 'vue'
import { debounce } from '@/utils/debounce'
import { useGameStore } from './gameStore'
import { useMapStore, TERRAIN_MOVE_COST } from './mapStore'
import type { SavedBattleReport } from '../combat/types'
import { BUILDING_DEFINITIONS, getBuildingUpgrade, getHQLevel } from '../data/buildings'
import type { BuildingType } from '../data/buildings'
import {
  MAX_OFFLINE_MS,
  AUTOSAVE_INTERVAL_MS,
  BASE_RESOURCE_CAPACITY,
  CAPACITY_PER_HQ_LEVEL,
} from '../config'
import { gameSettings } from './gameSettingsStore'
import { useToastStore } from './toastStore'

/**
 * Capacité de stockage par ressource selon le niveau du Bâtiment Principal.
 * Voir config.ts pour le choix des constantes (BASE_RESOURCE_CAPACITY / CAPACITY_PER_HQ_LEVEL).
 */
export const getResourceCapacity = (hqLevel: number): number =>
  BASE_RESOURCE_CAPACITY + hqLevel * CAPACITY_PER_HQ_LEVEL

// Ré-export pour compatibilité avec les imports existants
export { MAX_OFFLINE_MS }

// Ressources Travian pour les missions (avec précision décimale)
export interface TravianResources {
  wood: number // Bois (peut être décimal)
  clay: number // Argile/Terre (peut être décimal)
  iron: number // Fer (peut être décimal)
  crop: number // Céréales (peut être décimal)
}

// Production par minute
export interface ResourceProduction {
  wood: number
  clay: number
  iron: number
  crop: number
}

// Bâtiments de la ville de mission
export interface MissionBuilding {
  id: string
  type: BuildingType
  level: number
  position: { x: number; y: number }
  isUnderConstruction?: boolean
  constructionEndTime?: number
}

// Unités militaires
export interface MilitaryUnit {
  id: string
  type: 'infantry' | 'archer' | 'cavalry' | 'siege'
  count: number
  attack: number
  defense: number
  health: number
  cost: TravianResources
  trainingTime: number // secondes
}

// Définition statique d'une unité (source unique de vérité)
export interface UnitDefinition {
  type: MilitaryUnit['type']
  name: string
  icon: string
  cost: TravianResources
  stats: { attack: number; defense: number; health: number }
  baseTrainingTime: number // secondes pour 1 unité, caserne niveau 1
  barrackLevelRequired: number
}

// Source unique de vérité — toute la config des unités est ici
export const UNIT_DEFINITIONS: Record<MilitaryUnit['type'], UnitDefinition> = {
  infantry: {
    type: 'infantry',
    name: 'Infanterie',
    icon: '🛡️',
    cost: { wood: 20, clay: 10, iron: 30, crop: 15 },
    stats: { attack: 40, defense: 35, health: 100 },
    baseTrainingTime: 10, // secondes
    barrackLevelRequired: 1,
  },
  archer: {
    type: 'archer',
    name: 'Archers',
    icon: '🏹',
    cost: { wood: 30, clay: 15, iron: 25, crop: 20 },
    stats: { attack: 25, defense: 15, health: 80 },
    baseTrainingTime: 15,
    barrackLevelRequired: 2,
  },
  cavalry: {
    type: 'cavalry',
    name: 'Cavalerie',
    icon: '🐎',
    cost: { wood: 50, clay: 30, iron: 60, crop: 40 },
    stats: { attack: 100, defense: 50, health: 150 },
    baseTrainingTime: 30,
    barrackLevelRequired: 3,
  },
  siege: {
    type: 'siege',
    name: 'Machines de Siège',
    icon: '🏰',
    cost: { wood: 100, clay: 80, iron: 120, crop: 60 },
    stats: { attack: 200, defense: 20, health: 300 },
    baseTrainingTime: 90,
    barrackLevelRequired: 5,
  },
}

/**
 * Calcule le temps de construction d'une unité selon le niveau de la caserne.
 * Chaque niveau de caserne réduit le temps de 8% (min 10 secondes).
 */
export const getTrainingTime = (unitType: MilitaryUnit['type'], barrackLevel: number): number => {
  const base = UNIT_DEFINITIONS[unitType].baseTrainingTime
  const reduction = 1 - Math.min(0.8, (barrackLevel - 1) * 0.08)
  return Math.max(10, Math.round(base * reduction))
}

// Entrée dans la file de construction
export interface TrainingQueueEntry {
  id: string
  type: MilitaryUnit['type']
  startedAt: number
  endsAt: number
}

// État d'un combat/mission
export interface Mission {
  id: string
  name: string
  type: 'combat' | 'exploration' | 'raid'
  difficulty: 'easy' | 'medium' | 'hard' | 'elite'
  enemy: {
    name: string
    units: MilitaryUnit[]
  }
  rewards: {
    resources?: TravianResources
    gold?: number
    experience?: number
  }
  losePenalty: {
    gold?: number
    leadership?: number
  }
  narrative?: string // Texte narratif pour la mission
  isActive: boolean
  isCompleted: boolean
}

// État de la ville de mission
export interface MissionTown {
  name: string
  resources: TravianResources
  production: ResourceProduction
  buildings: MissionBuilding[]
  units: MilitaryUnit[]
  trainingQueue: TrainingQueueEntry[]
}

// État global des missions
export interface MissionState {
  isInMission: boolean
  currentMission: Mission | null
  town: MissionTown
  lastUpdateTime: number
  /** Temps in-game cumulé en ms (plafonne le temps offline) */
  gameElapsedMs: number

  isTransitioning: boolean
  battleReports: SavedBattleReport[]
}

/**
 * Calcule la production de base (par minute) à partir de la liste de bâtiments réellement
 * présents, en sommant `productionPerLevel.amount * level` pour chaque bâtiment producteur.
 *
 * IMPORTANT : c'est la SEULE source de vérité pour `town.production`. Ne jamais seeder ou
 * incrémenter `production` avec des valeurs codées en dur ailleurs — cela casse l'invariant
 * "somme des productions par bâtiment == total affiché" (voir TownView.vue, onglet Ressources).
 */
const computeBaseProduction = (
  buildings: { type: BuildingType; level: number }[],
): ResourceProduction => {
  const production: ResourceProduction = { wood: 0, clay: 0, iron: 0, crop: 0 }
  for (const b of buildings) {
    const def = BUILDING_DEFINITIONS[b.type]
    if (def?.productionPerLevel) {
      const { resource, amount } = def.productionPerLevel
      production[resource] += amount * b.level
    }
  }
  return production
}

/**
 * Nombre d'infanterie de départ. 100 en mode triche debug (pratique pour tester le combat
 * sans attendre), sinon une petite garnison de départ raisonnable — voir gameSettingsStore.ts.
 */
const getStartingInfantryCount = (): number => (gameSettings.cheatStartingGarrison ? 100 : 10)

const createStartingUnits = (): MilitaryUnit[] => [
  {
    id: 'infantry-start',
    type: 'infantry',
    count: getStartingInfantryCount(),
    attack: UNIT_DEFINITIONS.infantry.stats.attack,
    defense: UNIT_DEFINITIONS.infantry.stats.defense,
    health: UNIT_DEFINITIONS.infantry.stats.health,
    cost: UNIT_DEFINITIONS.infantry.cost,
    trainingTime: UNIT_DEFINITIONS.infantry.baseTrainingTime,
  },
]

/**
 * Bâtiments de départ d'une ville fraîche (nouvelle partie ou mission suivante).
 * Fonction (et non tableau constant) pour retourner une copie fraîche à chaque appel,
 * sans référence partagée entre l'état initial du module et les resets ultérieurs.
 *
 * NOTE : carrière et mine sont incluses dès le départ (leur hqLevelRequired est 1, donc
 * déjà "débloquées" au niveau 1 du QG) — les deux instances de ville de mission (première
 * partie et resets après mission) doivent utiliser la même liste pour que la production
 * de départ (calculée depuis ces bâtiments, voir computeBaseProduction) soit cohérente et
 * que le joueur ne se retrouve pas avec une production d'argile/fer bloquée à zéro.
 */
const createStartingBuildings = (): MissionBuilding[] => [
  {
    id: 'headquarters-1',
    type: 'headquarters' as BuildingType,
    level: 1,
    position: { x: 0, y: 0 },
  },
  {
    id: 'barracks-1',
    type: 'barracks' as BuildingType,
    level: 1,
    position: { x: 2, y: 2 },
  },
  {
    id: 'farm-1',
    type: 'farm' as BuildingType,
    level: 1,
    position: { x: 1, y: 1 },
  },
  {
    id: 'lumbermill-1',
    type: 'lumbermill' as BuildingType,
    level: 1,
    position: { x: 3, y: 1 },
  },
  {
    id: 'quarry-1',
    type: 'quarry' as BuildingType,
    level: 1,
    position: { x: 4, y: 2 },
  },
  {
    id: 'mine-1',
    type: 'mine' as BuildingType,
    level: 1,
    position: { x: 4, y: 3 },
  },
]

// État initial
const initialState: MissionState = {
  isInMission: false,
  currentMission: null,
  town: {
    name: 'Camp de Base',
    resources: {
      wood: 0,
      clay: 0,
      iron: 0,
      crop: 0,
    },
    // Dérivée des bâtiments ci-dessous — ne jamais coder cette valeur en dur (voir
    // computeBaseProduction plus haut : c'était la cause du bug "les chiffres ne
    // s'additionnent jamais" dans l'onglet Ressources).
    production: computeBaseProduction(createStartingBuildings()),
    buildings: createStartingBuildings(),
    units: createStartingUnits(),
    trainingQueue: [],
  },
  lastUpdateTime: Date.now(),
  gameElapsedMs: 0,
  isTransitioning: false,
  battleReports: [],
}

// Store réactif
const missionState = reactive<MissionState>({ ...initialState })

// Variable pour déclencher les recalculs d'affichage
const displayTrigger = reactive({ timestamp: Date.now() })

// Actions du store
export const useMissionStore = () => {
  // Getters
  const isInMission = computed(() => missionState.isInMission)
  const currentMission = computed(() => missionState.currentMission)
  const town = computed(() => missionState.town)
  const isTransitioning = computed(() => missionState.isTransitioning)

  // Ressources affichées en temps réel (computed réactif) - arrondies pour l'UI
  const displayResources = computed(() => {
    // Cette dépendance force le recalcul quand displayTrigger change
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = displayTrigger.timestamp

    const now = Date.now()
    const lastUpdate = missionState.lastUpdateTime || now
    const timeElapsed = (now - lastUpdate) / 1000 / 60 // Minutes écoulées

    // Le compteur affiché en direct ne doit jamais dépasser la capacité de stockage,
    // même entre deux ticks de production (voir getResourceCapacity).
    const cap = getResourceCapacity(getHQLevel(missionState.town.buildings))

    if (timeElapsed <= 0) {
      return {
        wood: Math.min(cap, Math.floor(missionState.town.resources.wood)),
        clay: Math.min(cap, Math.floor(missionState.town.resources.clay)),
        iron: Math.min(cap, Math.floor(missionState.town.resources.iron)),
        crop: Math.min(cap, Math.floor(missionState.town.resources.crop)),
      }
    }

    const production = missionState.town.production
    return {
      wood: Math.min(cap, Math.floor(missionState.town.resources.wood + production.wood * timeElapsed)),
      clay: Math.min(cap, Math.floor(missionState.town.resources.clay + production.clay * timeElapsed)),
      iron: Math.min(cap, Math.floor(missionState.town.resources.iron + production.iron * timeElapsed)),
      crop: Math.min(cap, Math.floor(missionState.town.resources.crop + production.crop * timeElapsed)),
    }
  })

  const totalResources = computed(() => {
    return (
      missionState.town.resources.wood +
      missionState.town.resources.clay +
      missionState.town.resources.iron +
      missionState.town.resources.crop
    )
  })

  // Actions pour les ressources

  /** Throttle du toast d'avertissement de plafond de stockage (évite le spam à chaque tick) */
  let lastCapacityToastAt = 0
  const CAPACITY_TOAST_THROTTLE_MS = 30_000

  /**
   * Applique un delta de ressources en le plafonnant à la capacité de stockage courante
   * (voir getResourceCapacity). Ne sauvegarde PAS — utilisé par le tick de production
   * (appelé chaque seconde) pour éviter un JSON.stringify + localStorage.setItem à chaque
   * tick ; addResources() (ci-dessous) ajoute la sauvegarde pour les appels ponctuels
   * (récompenses de mission, etc.).
   * Retourne true si le plafond a effectivement tronqué une partie du delta.
   */
  const applyResourceDelta = (resources: Partial<TravianResources>): boolean => {
    const cap = getResourceCapacity(getHQLevel(missionState.town.buildings))
    let clamped = false

    const applyOne = (key: keyof TravianResources, delta: number | undefined) => {
      if (!delta) return
      const current = missionState.town.resources[key]
      const desired = current + delta
      const next = Math.min(cap, desired)
      if (next < desired) clamped = true
      missionState.town.resources[key] = next
    }

    applyOne('wood', resources.wood)
    applyOne('clay', resources.clay)
    applyOne('iron', resources.iron)
    applyOne('crop', resources.crop)

    return clamped
  }

  const addResources = (resources: Partial<TravianResources>) => {
    applyResourceDelta(resources)
    saveMissionState()
  }

  const spendResources = (resources: Partial<TravianResources>): boolean => {
    // Vérifier si on a assez de ressources
    if (resources.wood && missionState.town.resources.wood < resources.wood) return false
    if (resources.clay && missionState.town.resources.clay < resources.clay) return false
    if (resources.iron && missionState.town.resources.iron < resources.iron) return false
    if (resources.crop && missionState.town.resources.crop < resources.crop) return false

    // Dépenser les ressources
    if (resources.wood) missionState.town.resources.wood -= resources.wood
    if (resources.clay) missionState.town.resources.clay -= resources.clay
    if (resources.iron) missionState.town.resources.iron -= resources.iron
    if (resources.crop) missionState.town.resources.crop -= resources.crop

    saveMissionState()
    return true
  }

  // Production automatique de ressources (synchronisation réelle)
  const updateResourceProduction = () => {
    const now = Date.now()
    const lastUpdate = missionState.lastUpdateTime || now
    const realDeltaMs = now - lastUpdate

    // Plafonner le temps offline pour éviter l'accumulation excessive
    const cappedDeltaMs = Math.min(realDeltaMs, MAX_OFFLINE_MS)
    const timeElapsed = cappedDeltaMs / 1000 / 60 // Minutes écoulées (plafondées)

    if (timeElapsed > 0) {
      const production = missionState.town.production

      // applyResourceDelta() plafonne à la capacité de stockage (getResourceCapacity) et
      // ne sauvegarde pas à chaque tick — voir sa doc plus haut.
      const clamped = applyResourceDelta({
        wood: production.wood * timeElapsed,
        clay: production.clay * timeElapsed,
        iron: production.iron * timeElapsed,
        crop: production.crop * timeElapsed,
      })

      if (clamped && now - lastCapacityToastAt > CAPACITY_TOAST_THROTTLE_MS) {
        lastCapacityToastAt = now
        useToastStore().showInfo(
          '⚠️ Stockage plein — améliorez votre Bâtiment Principal pour augmenter la capacité !',
          { duration: 3000 },
        )
      }

      // Avancer le temps in-game (plafondé)
      missionState.gameElapsedMs += cappedDeltaMs
      missionState.lastUpdateTime = now

      displayTrigger.timestamp = now
      // Note : pas de saveMissionState() ici — la sauvegarde est gérée par
      // l'auto-save (30s) + beforeunload/visibilitychange pour éviter
      // un JSON.stringify + localStorage.setItem à chaque seconde.
    }
  }

  /** Retourne le timestamp in-game courant (gameElapsed + temps depuis dernier update, plafondé) */
  const getGameTimestamp = (): number => {
    const realDelta = Date.now() - (missionState.lastUpdateTime || Date.now())
    return missionState.gameElapsedMs + Math.min(realDelta, MAX_OFFLINE_MS)
  }

  // --- Rapports de bataille ---

  const addBattleReport = (report: SavedBattleReport) => {
    missionState.battleReports.unshift(report)
    if (missionState.battleReports.length > 50) {
      missionState.battleReports.length = 50
    }
    saveMissionState()
  }

  const markReportRead = (reportId: string) => {
    const report = missionState.battleReports.find((r) => r.id === reportId)
    if (report && !report.read) {
      report.read = true
      saveMissionState()
    }
  }

  const deleteBattleReport = (reportId: string) => {
    missionState.battleReports = missionState.battleReports.filter((r) => r.id !== reportId)
    saveMissionState()
  }

  const unreadReportsCount = computed(
    () => missionState.battleReports.filter((r) => !r.read).length,
  )

  const battleReports = computed(() => missionState.battleReports)

  // Rapport en attente d'ouverture (déclenché par un clic sur toast)
  const pendingReportToOpen = ref<SavedBattleReport | null>(null)
  const requestOpenReport = (report: SavedBattleReport) => {
    pendingReportToOpen.value = report
  }
  const consumePendingReport = (): SavedBattleReport | null => {
    const r = pendingReportToOpen.value
    pendingReportToOpen.value = null
    return r
  }

  /** Marque tous les rapports comme lus (action groupée depuis la page Rapports) */
  const markAllReportsRead = () => {
    let changed = false
    for (const report of missionState.battleReports) {
      if (!report.read) {
        report.read = true
        changed = true
      }
    }
    if (changed) saveMissionState()
  }

  /** Supprime tous les rapports de bataille (action groupée depuis la page Rapports) */
  const deleteAllBattleReports = () => {
    if (missionState.battleReports.length === 0) return
    missionState.battleReports = []
    saveMissionState()
  }

  // Fonctions auxiliaires
  const getLeadershipReward = (difficulty: 'easy' | 'medium' | 'hard' | 'elite'): number => {
    switch (difficulty) {
      case 'easy':
        return 5
      case 'medium':
        return 10
      case 'hard':
        return 15
      case 'elite':
        return 25
      default:
        return 5
    }
  }

  // Actions pour les missions
  const startMission = (mission: Mission) => {
    missionState.currentMission = mission
    missionState.isInMission = true
    mission.isActive = true

    // Appliquer les ressources initiales définies dans les paramètres
    missionState.town.resources.wood = gameSettings.initialResources.wood
    missionState.town.resources.clay = gameSettings.initialResources.clay
    missionState.town.resources.iron = gameSettings.initialResources.iron
    missionState.town.resources.crop = gameSettings.initialResources.crop

    // Triche debug : ressources et points de victoire offerts au démarrage
    if (gameSettings.cheatResources) {
      missionState.town.resources.wood = 10_000
      missionState.town.resources.clay = 10_000
      missionState.town.resources.iron = 10_000
      missionState.town.resources.crop = 10_000
    }
    if (gameSettings.cheatVictoryPoints) {
      const gameStore = useGameStore()
      gameStore.addVictoryPoints('combat', 1_000, '[CHEAT] Points de victoire de débogage')
    }

    saveMissionState()
  }

  const completeMission = (success: boolean) => {
    if (missionState.currentMission && success) {
      // Obtenir le gameStore pour les récompenses principales
      const gameStore = useGameStore()

      // Ajouter les récompenses Travian (ressources mission)
      if (missionState.currentMission.rewards.resources) {
        addResources(missionState.currentMission.rewards.resources)
      }

      // Ajouter les récompenses principales (or et leadership)
      if (missionState.currentMission.rewards.gold) {
        gameStore.addGold(missionState.currentMission.rewards.gold)
      }

      // Ajouter du leadership basé sur la difficulté
      const leadershipReward = getLeadershipReward(missionState.currentMission.difficulty)
      gameStore.updateLeadership(leadershipReward, 'add')

      // Points de victoire au combat pour la complétion de mission
      const vpByDifficulty: Record<string, number> = {
        easy: 2,
        medium: 4,
        hard: 7,
        elite: 12,
      }
      const vpAmount = vpByDifficulty[missionState.currentMission.difficulty] ?? 2
      gameStore.addVictoryPoints(
        'combat',
        vpAmount,
        `Mission complétée : ${missionState.currentMission.name}`,
      )

      // IMPORTANT: Marquer le node de carte comme complété
      if (gameStore.gameState.mapState.selectedNodeId) {
        gameStore.completeMapNode(gameStore.gameState.mapState.selectedNodeId)
      }

      missionState.currentMission.isCompleted = true
      missionState.currentMission.isActive = false

      // Activer l'écran de transition
      missionState.isTransitioning = true

      // Attendre un peu pour afficher l'écran de chargement
      setTimeout(() => {
        // Réinitialiser complètement l'état pour préparer la prochaine mission
        resetMissionState()

        // Réinitialiser également la carte de campagne (exploration)
        const mapStore = useMapStore()
        mapStore.resetMapState()

        // Désactiver l'écran de transition après le reset
        setTimeout(() => {
          missionState.isTransitioning = false
        }, 500)
      }, 1500) // Afficher l'écran pendant 1.5 secondes
    } else if (missionState.currentMission && !success) {
      // En cas d'échec, appliquer les pénalités
      const gameStore = useGameStore()
      if (missionState.currentMission.losePenalty?.gold) {
        gameStore.spendGold(missionState.currentMission.losePenalty.gold)
      }
      if (missionState.currentMission.losePenalty?.leadership) {
        gameStore.updateLeadership(missionState.currentMission.losePenalty.leadership, 'lose')
      }

      missionState.currentMission.isActive = false
      missionState.currentMission.isCompleted = false

      // En cas d'échec, on sort juste de la mission sans reset complet
      missionState.isInMission = false
      missionState.currentMission = null
      saveMissionState()
    }
  }

  const exitMission = () => {
    missionState.isInMission = false
    missionState.currentMission = null
    saveMissionState()
  }

  // Actions pour les bâtiments
  /**
   * Lance l'amélioration d'un bâtiment existant. Ne bascule PLUS le niveau instantanément :
   * les ressources sont déduites immédiatement, puis le bâtiment passe en
   * `isUnderConstruction` jusqu'à `constructionEndTime` (voir processConstructionQueue).
   * Un seul chantier à la fois par bâtiment (pas de file empilable comme pour les unités).
   */
  const upgradeBuilding = (buildingId: string): boolean => {
    const building = missionState.town.buildings.find((b) => b.id === buildingId)
    if (!building) return false

    // Un chantier est déjà en cours sur ce bâtiment
    if (building.isUnderConstruction) return false

    const def = BUILDING_DEFINITIONS[building.type as BuildingType]
    if (!def) return false

    // Vérification niveau max
    if (building.level >= def.maxLevel) return false

    // Vérification prérequis HQ
    const hqLevel = getHQLevel(missionState.town.buildings)
    if (hqLevel < def.hqLevelRequired) return false

    const upgradeCost = getBuildingUpgrade(building.type as BuildingType, building.level)

    if (spendResources(upgradeCost)) {
      building.isUnderConstruction = true
      building.constructionEndTime = Date.now() + upgradeCost.buildTime * 1000

      saveMissionState()
      return true
    }

    return false
  }

  // Construire un nouveau bâtiment (niveau 0 → 1, via chantier temporisé)
  const constructBuilding = (type: BuildingType): boolean => {
    const def = BUILDING_DEFINITIONS[type]
    if (!def) return false

    // Vérifier que le bâtiment n'existe pas déjà (ou n'est pas déjà en chantier)
    const exists = missionState.town.buildings.some((b) => b.type === type)
    if (exists) return false

    // Vérifier le prérequis HQ
    const hqLevel = getHQLevel(missionState.town.buildings)
    if (hqLevel < def.hqLevelRequired) return false

    // Coût de construction (niveau 0 → 1)
    const buildCost = getBuildingUpgrade(type, 0)

    if (spendResources(buildCost)) {
      // Le bâtiment existe en base de données dès l'achat (niveau 0, en chantier) —
      // il devient niveau 1 (avec sa production) quand processConstructionQueue le finalise.
      missionState.town.buildings.push({
        id: `${type}-${Date.now()}`,
        type,
        level: 0,
        position: { x: 0, y: 0 },
        isUnderConstruction: true,
        constructionEndTime: Date.now() + buildCost.buildTime * 1000,
      })

      saveMissionState()
      return true
    }

    return false
  }

  /**
   * Traite le chantier de tous les bâtiments : finalise ceux dont le timer est écoulé
   * (bump de niveau + application de la production), symétrique à processTrainingQueue().
   * Appelée à chaque tick de l'intervalle d'affichage (voir startDisplayUpdates).
   */
  const processConstructionQueue = (): void => {
    const now = Date.now()
    let changed = false

    for (const building of missionState.town.buildings) {
      if (!building.isUnderConstruction) continue
      if (!building.constructionEndTime || building.constructionEndTime > now) continue

      const def = BUILDING_DEFINITIONS[building.type as BuildingType]

      building.level += 1
      building.isUnderConstruction = false
      building.constructionEndTime = undefined
      changed = true

      // Mise à jour de la production si applicable
      if (def?.productionPerLevel) {
        const { resource, amount } = def.productionPerLevel
        missionState.town.production[resource] += amount
      }

      // Déblocage automatique de la mine et de la carrière au niveau 4 du HQ — cadeau
      // gratuit et instantané, ne passe pas par le chantier temporisé (voir plan Chantier C).
      if (building.type === 'headquarters' && building.level === 4) {
        const hasQuarry = missionState.town.buildings.some((b) => b.type === 'quarry')
        const hasMine = missionState.town.buildings.some((b) => b.type === 'mine')

        if (!hasQuarry) {
          missionState.town.buildings.push({
            id: `quarry-${Date.now()}`,
            type: 'quarry',
            level: 1,
            position: { x: 4, y: 2 },
          })
          // Production initiale du niveau 1
          missionState.town.production.clay +=
            BUILDING_DEFINITIONS.quarry.productionPerLevel!.amount
        }

        if (!hasMine) {
          missionState.town.buildings.push({
            id: `mine-${Date.now()}`,
            type: 'mine',
            level: 1,
            position: { x: 4, y: 3 },
          })
          missionState.town.production.iron += BUILDING_DEFINITIONS.mine.productionPerLevel!.amount
        }
      }
    }

    if (changed) saveMissionState()
  }

  // Actions pour les unités
  const barrackLevel = computed((): number => {
    const barracks = missionState.town.buildings.find((b) => b.type === 'barracks')
    return barracks?.level ?? 0
  })

  const trainingQueue = computed(() => missionState.town.trainingQueue)

  /**
   * Ajoute une unité en file de construction.
   * Les ressources sont déduites immédiatement.
   * Retourne false si caserne trop basse ou ressources insuffisantes.
   */
  const enqueueUnit = (unitType: MilitaryUnit['type']): boolean => {
    const def = UNIT_DEFINITIONS[unitType]

    // Vérification niveau caserne
    if (barrackLevel.value < def.barrackLevelRequired) return false

    // Vérification ressources
    if (!spendResources(def.cost)) return false

    const now = Date.now()
    const duration = getTrainingTime(unitType, barrackLevel.value) * 1000 // ms

    // La prochaine unité commence après la fin de la dernière en file
    const queue = missionState.town.trainingQueue
    const lastEndsAt = queue.length > 0 ? queue[queue.length - 1].endsAt : now
    const startedAt = Math.max(now, lastEndsAt)

    const entry: TrainingQueueEntry = {
      id: `${unitType}-${now}-${Math.random().toString(36).slice(2, 7)}`,
      type: unitType,
      startedAt,
      endsAt: startedAt + duration,
    }

    missionState.town.trainingQueue.push(entry)
    saveMissionState()
    return true
  }

  /**
   * Traite la file de construction : complète les entrées dont le timer est écoulé.
   * Appelée à chaque tick de l'intervalle d'affichage.
   */
  const processTrainingQueue = (): void => {
    const now = Date.now()
    const completed = missionState.town.trainingQueue.filter((e) => e.endsAt <= now)
    if (completed.length === 0) return

    missionState.town.trainingQueue = missionState.town.trainingQueue.filter((e) => e.endsAt > now)

    for (const entry of completed) {
      const def = UNIT_DEFINITIONS[entry.type]
      const existing = missionState.town.units.find((u) => u.type === entry.type)
      if (existing) {
        existing.count++
      } else {
        missionState.town.units.push({
          id: `${entry.type}-${Date.now()}`,
          type: entry.type,
          count: 1,
          attack: def.stats.attack,
          defense: def.stats.defense,
          health: def.stats.health,
          cost: def.cost,
          trainingTime: def.baseTrainingTime,
        })
      }
    }

    saveMissionState()
  }

  /**
   * Annule une entrée en attente dans la file et rembourse les ressources.
   * Seules les entrées qui n'ont pas encore débuté (index > 0) peuvent être annulées.
   * L'entrée en cours de construction (#1) ne peut pas être annulée.
   */
  const cancelQueueEntry = (entryId: string): boolean => {
    const queue = missionState.town.trainingQueue
    const index = queue.findIndex((e) => e.id === entryId)
    if (index === -1) return false

    const entry = queue[index]
    const def = UNIT_DEFINITIONS[entry.type]

    // Rembourser les ressources
    missionState.town.resources.wood += def.cost.wood
    missionState.town.resources.clay += def.cost.clay
    missionState.town.resources.iron += def.cost.iron
    missionState.town.resources.crop += def.cost.crop

    // Retirer de la file
    queue.splice(index, 1)

    // Recalculer les startedAt/endsAt des entrées suivantes pour combler le trou
    for (let i = index; i < queue.length; i++) {
      const prev = i > 0 ? queue[i - 1] : null
      const baseStart = prev ? prev.endsAt : Date.now()
      const duration = queue[i].endsAt - queue[i].startedAt
      queue[i].startedAt = baseStart
      queue[i].endsAt = baseStart + duration
    }

    saveMissionState()
    return true
  }

  // Actions pour les unités (legacy — conservation pour compatibilité éventuelle)
  const trainUnit = (unitType: MilitaryUnit['type'], quantity: number): boolean => {
    for (let i = 0; i < quantity; i++) {
      if (!enqueueUnit(unitType)) return i > 0 // true si au moins 1 unité enfilée
    }
    return true
  }

  // Sauvegarde et chargement
  //
  // saveMissionState() est appelée à chaque gain/dépense de ressource, changement de file
  // de construction/entraînement, etc. On debounce l'écriture réelle pour éviter d'empiler
  // des JSON.stringify synchrones quand plusieurs mutations arrivent coup sur coup.
  const writeMissionState = () => {
    const data = {
      isInMission: missionState.isInMission,
      currentMission: missionState.currentMission,
      town: {
        ...missionState.town,
        trainingQueue: missionState.town.trainingQueue,
      },
      lastUpdateTime: missionState.lastUpdateTime,
      gameElapsedMs: missionState.gameElapsedMs,
      battleReports: missionState.battleReports,
    }
    localStorage.setItem('minitravian-missions', JSON.stringify(data))
  }

  const debouncedWriteMissionState = debounce(writeMissionState, 400)

  const saveMissionState = () => debouncedWriteMissionState()

  /** Force l'écriture immédiate d'une sauvegarde en attente (fermeture/masquage de l'onglet). */
  const flushMissionState = () => debouncedWriteMissionState.flush()

  const loadMissionState = () => {
    const saved = localStorage.getItem('minitravian-missions')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        missionState.isInMission = data.isInMission ?? false
        missionState.currentMission = data.currentMission || null
        missionState.lastUpdateTime = data.lastUpdateTime || Date.now()

        if (data.town) {
          Object.assign(missionState.town, data.town)
          // Garantir la présence de trainingQueue pour les sauvegardes anciennes
          if (!missionState.town.trainingQueue) {
            missionState.town.trainingQueue = []
          }
          // Migration : s'assurer que l'infanterie de départ est présente
          if (!missionState.town.units || missionState.town.units.length === 0) {
            missionState.town.units = createStartingUnits()
          }
        }

        if (data.gameElapsedMs !== undefined) {
          missionState.gameElapsedMs = data.gameElapsedMs
        }
        if (data.battleReports) {
          missionState.battleReports = data.battleReports
        }

        // Sauvegarder si nécessaire (missions terminées hors-ligne)
        return true
      } catch (error) {
        console.error('Erreur lors du chargement des missions:', error)
        return false
      }
    }
    return false
  }

  const resetMissionState = () => {
    // Création d'une copie profonde de l'état initial pour éviter les références partagées
    const freshBuildings = createStartingBuildings()

    const freshInitialState: MissionState = {
      isInMission: false,
      currentMission: null,
      town: {
        name: 'Camp de Base',
        resources: {
          wood: 0,
          clay: 0,
          iron: 0,
          crop: 0,
        },
        // Dérivée des bâtiments ci-dessus — voir computeBaseProduction
        production: computeBaseProduction(freshBuildings),
        buildings: freshBuildings,
        units: createStartingUnits(),
        trainingQueue: [],
      },
      lastUpdateTime: Date.now(),
      gameElapsedMs: 0,
      isTransitioning: false,
      battleReports: [],
    }

    Object.assign(missionState, freshInitialState)
    localStorage.removeItem('minitravian-missions')
  }

  // Auto-save et affichage temps réel
  let autoSaveInterval: number | null = null
  let displayUpdateInterval: number | null = null

  const startAutoSave = () => {
    if (autoSaveInterval) return
    autoSaveInterval = window.setInterval(saveMissionState, AUTOSAVE_INTERVAL_MS)
  }

  const stopAutoSave = () => {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval)
      autoSaveInterval = null
    }
  }

  // Timer pour l'affichage en temps réel — inclut la production pour un compteur fluide.
  // NOTE : c'est l'UNIQUE tick qui appelle updateResourceProduction() — un second
  // setInterval(updateResourceProduction, PRODUCTION_INTERVAL_MS) existait ici auparavant
  // et doublait l'application de la production (bug de duplication de tick), il a été retiré.
  const startDisplayUpdates = () => {
    if (displayUpdateInterval) return
    displayUpdateInterval = window.setInterval(() => {
      updateResourceProduction()
      processTrainingQueue()
      processConstructionQueue()
    }, 1000)
  }

  const stopDisplayUpdates = () => {
    if (displayUpdateInterval) {
      clearInterval(displayUpdateInterval)
      displayUpdateInterval = null
    }
  }

  // Fonctions utilitaires pour gérer tous les services
  const startAllServices = () => {
    startAutoSave()
    startDisplayUpdates()
  }

  const stopAllServices = () => {
    stopAutoSave()
    stopDisplayUpdates()
  }

  return {
    // État
    missionState,

    // Getters
    isInMission,
    currentMission,
    town,
    totalResources,
    isTransitioning,

    // Ressources temps réel pour l'affichage
    displayResources,

    // Actions ressources
    addResources,
    spendResources,
    updateResourceProduction,

    // Actions missions
    startMission,
    completeMission,
    exitMission,

    // Actions bâtiments
    upgradeBuilding,
    constructBuilding,
    processConstructionQueue,

    // Actions unités
    trainUnit,
    enqueueUnit,
    cancelQueueEntry,
    processTrainingQueue,
    barrackLevel,
    trainingQueue,

    // Temps in-game
    getGameTimestamp,

    // Rapports de bataille
    addBattleReport,
    markReportRead,
    deleteBattleReport,
    unreadReportsCount,
    battleReports,
    pendingReportToOpen,
    requestOpenReport,
    consumePendingReport,
    markAllReportsRead,
    deleteAllBattleReports,

    // Sauvegarde
    saveMissionState,
    flushMissionState,
    loadMissionState,
    resetMissionState,

    // Auto-save et affichage
    startAutoSave,
    stopAutoSave,
    startDisplayUpdates,
    stopDisplayUpdates,
    startAllServices,
    stopAllServices,
  }
}

export type MissionStore = ReturnType<typeof useMissionStore>
