import { reactive, computed } from 'vue'
import { useGameStore } from './gameStore'

// Ressources Travian pour les missions
export interface TravianResources {
  wood: number // Bois
  clay: number // Argile/Terre
  iron: number // Fer
  crop: number // Céréales
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
  type: 'barracks' | 'stable' | 'workshop' | 'farm' | 'mine' | 'quarry' | 'lumbermill'
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
  population: number
}

// État global des missions
export interface MissionState {
  isInMission: boolean
  currentMission: Mission | null
  town: MissionTown
  lastUpdateTime: number
}

// État initial
const initialState: MissionState = {
  isInMission: false,
  currentMission: null,
  town: {
    name: 'Camp de Base',
    resources: {
      wood: 500,
      clay: 500,
      iron: 300,
      crop: 400,
    },
    production: {
      wood: 50, // par minute
      clay: 40,
      iron: 30,
      crop: 60,
    },
    buildings: [
      {
        id: 'barracks-1',
        type: 'barracks',
        level: 1,
        position: { x: 2, y: 2 },
      },
      {
        id: 'farm-1',
        type: 'farm',
        level: 1,
        position: { x: 1, y: 1 },
      },
      {
        id: 'lumbermill-1',
        type: 'lumbermill',
        level: 1,
        position: { x: 3, y: 1 },
      },
    ],
    units: [],
    population: 10,
  },
  lastUpdateTime: Date.now(),
}

// Store réactif
const missionState = reactive<MissionState>({ ...initialState })

// Actions du store
export const useMissionStore = () => {
  // Getters
  const isInMission = computed(() => missionState.isInMission)
  const currentMission = computed(() => missionState.currentMission)
  const town = computed(() => missionState.town)

  const totalResources = computed(() => {
    return (
      missionState.town.resources.wood +
      missionState.town.resources.clay +
      missionState.town.resources.iron +
      missionState.town.resources.crop
    )
  })

  // Actions pour les ressources
  const addResources = (resources: Partial<TravianResources>) => {
    if (resources.wood) missionState.town.resources.wood += resources.wood
    if (resources.clay) missionState.town.resources.clay += resources.clay
    if (resources.iron) missionState.town.resources.iron += resources.iron
    if (resources.crop) missionState.town.resources.crop += resources.crop
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

  // Production automatique de ressources
  const updateResourceProduction = () => {
    const now = Date.now()
    const lastUpdate = missionState.lastUpdateTime || now
    const timeElapsed = (now - lastUpdate) / 1000 / 60 // Minutes écoulées

    if (timeElapsed > 0) {
      const production = missionState.town.production

      missionState.town.resources.wood += Math.floor(production.wood * timeElapsed)
      missionState.town.resources.clay += Math.floor(production.clay * timeElapsed)
      missionState.town.resources.iron += Math.floor(production.iron * timeElapsed)
      missionState.town.resources.crop += Math.floor(production.crop * timeElapsed)

      missionState.lastUpdateTime = now
      saveMissionState()
    }
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
      gameStore.addLeadership(leadershipReward)

      missionState.currentMission.isCompleted = true
      missionState.currentMission.isActive = false

      //

      // Réinitialiser complètement l'état pour la prochaine partie (seulement en cas de succès)
      resetMissionState()
    } else if (missionState.currentMission && !success) {
      // En cas d'échec, appliquer les pénalités
      const gameStore = useGameStore()
      if (missionState.currentMission.losePenalty?.gold) {
        gameStore.spendGold(missionState.currentMission.losePenalty.gold)
      }
      if (missionState.currentMission.losePenalty?.leadership) {
        gameStore.addLeadership(-missionState.currentMission.losePenalty.leadership)
      }

      missionState.currentMission.isActive = false
      missionState.currentMission.isCompleted = false
    }

    // Réinitialiser complètement l'état pour la prochaine partie (seulement en cas de succès)

    missionState.isInMission = false
    missionState.currentMission = null
    saveMissionState()
  }

  const exitMission = () => {
    missionState.isInMission = false
    missionState.currentMission = null
    saveMissionState()
  }

  // Actions pour les bâtiments
  const upgradeBuilding = (buildingId: string): boolean => {
    const building = missionState.town.buildings.find((b) => b.id === buildingId)
    if (!building) return false

    // Coût d'amélioration (exemple simple)
    const upgradeCost = {
      wood: building.level * 100,
      clay: building.level * 80,
      iron: building.level * 60,
      crop: building.level * 40,
    }

    if (spendResources(upgradeCost)) {
      building.level += 1

      // Améliorer la production si c'est un bâtiment de ressource
      if (building.type === 'lumbermill') {
        missionState.town.production.wood += 10
      } else if (building.type === 'quarry') {
        missionState.town.production.clay += 8
      } else if (building.type === 'mine') {
        missionState.town.production.iron += 6
      } else if (building.type === 'farm') {
        missionState.town.production.crop += 12
      }

      saveMissionState()
      return true
    }

    return false
  }

  // Actions pour les unités
  const trainUnit = (unitType: MilitaryUnit['type'], quantity: number): boolean => {
    // Coûts de base pour l'entraînement
    const unitCosts = {
      infantry: { wood: 20, clay: 10, iron: 30, crop: 15 },
      archer: { wood: 30, clay: 15, iron: 25, crop: 20 },
      cavalry: { wood: 50, clay: 30, iron: 60, crop: 40 },
      siege: { wood: 100, clay: 80, iron: 120, crop: 60 },
    }

    const totalCost = {
      wood: unitCosts[unitType].wood * quantity,
      clay: unitCosts[unitType].clay * quantity,
      iron: unitCosts[unitType].iron * quantity,
      crop: unitCosts[unitType].crop * quantity,
    }

    if (spendResources(totalCost)) {
      // Ajouter les unités
      const existingUnit = missionState.town.units.find((u) => u.type === unitType)
      if (existingUnit) {
        existingUnit.count += quantity
      } else {
        const unitStats = {
          infantry: { attack: 40, defense: 35, health: 100 },
          archer: { attack: 25, defense: 15, health: 80 },
          cavalry: { attack: 100, defense: 50, health: 150 },
          siege: { attack: 200, defense: 20, health: 300 },
        }

        missionState.town.units.push({
          id: `${unitType}-${Date.now()}`,
          type: unitType,
          count: quantity,
          attack: unitStats[unitType].attack,
          defense: unitStats[unitType].defense,
          health: unitStats[unitType].health,
          cost: unitCosts[unitType],
          trainingTime: 60, // 1 minute par unité
        })
      }

      saveMissionState()
      return true
    }

    return false
  }

  // Sauvegarde et chargement
  const saveMissionState = () => {
    const data = {
      isInMission: missionState.isInMission,
      currentMission: missionState.currentMission,
      town: { ...missionState.town },
      lastUpdateTime: missionState.lastUpdateTime,
    }
    localStorage.setItem('minitravian-missions', JSON.stringify(data))
  }

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
        }

        return true
      } catch (error) {
        console.error('Erreur lors du chargement des missions:', error)
        return false
      }
    }
    return false
  }

  const resetMissionState = () => {
    Object.assign(missionState, { ...initialState })
    localStorage.removeItem('minitravian-missions')
  }

  // Auto-save et production automatique
  let autoSaveInterval: number | null = null
  let productionInterval: number | null = null

  const startAutoSave = () => {
    if (autoSaveInterval) return
    autoSaveInterval = window.setInterval(saveMissionState, 30000) // 30 secondes
  }

  const stopAutoSave = () => {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval)
      autoSaveInterval = null
    }
  }

  const startResourceProduction = () => {
    if (productionInterval) return
    productionInterval = window.setInterval(updateResourceProduction, 60000) // 1 minute
  }

  const stopResourceProduction = () => {
    if (productionInterval) {
      clearInterval(productionInterval)
      productionInterval = null
    }
  }

  return {
    // État
    missionState,

    // Getters
    isInMission,
    currentMission,
    town,
    totalResources,

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

    // Actions unités
    trainUnit,

    // Sauvegarde
    saveMissionState,
    loadMissionState,
    resetMissionState,

    // Auto-save et production
    startAutoSave,
    stopAutoSave,
    startResourceProduction,
    stopResourceProduction,
  }
}

export type MissionStore = ReturnType<typeof useMissionStore>
