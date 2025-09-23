import { reactive, computed } from 'vue'

export interface Race {
  id: string
  name: string
  icon: string
  description: string
  bonuses: string[]
  stats: {
    economy: number
    military: number
    defense: number
  }
}

export interface Resources {
  wood: number
  stone: number
  iron: number
  food: number
}

export interface Building {
  id: string
  type: string
  level: number
  position: { x: number; y: number }
}

export interface GameState {
  isGameStarted: boolean
  race: Race | null
  resources: Resources
  buildings: Building[]
  population: number
  createdAt: string | null
  currentGameSection?: string
}

// État initial du jeu
const initialState: GameState = {
  isGameStarted: false,
  race: null,
  resources: {
    wood: 100,
    stone: 100,
    iron: 50,
    food: 100,
  },
  buildings: [],
  population: 10,
  createdAt: null,
  currentGameSection: undefined,
}

// Store réactif
const gameState = reactive<GameState>({ ...initialState })

// Actions du store
export const useGameStore = () => {
  // Getters (computed)
  const hasSavedGame = computed(() => {
    const savedGame = localStorage.getItem('minitravian-save')
    return !!savedGame
  })

  const isRaceSelected = computed(() => !!gameState.race)

  const totalResources = computed(() => {
    return (
      gameState.resources.wood +
      gameState.resources.stone +
      gameState.resources.iron +
      gameState.resources.food
    )
  })

  // Actions
  const startNewGame = (selectedRace: Race) => {
    gameState.race = selectedRace
    gameState.isGameStarted = true
    gameState.createdAt = new Date().toISOString()

    // Appliquer les bonus de race aux ressources initiales
    applyRaceBonuses()

    // Sauvegarder
    saveGame()
  }

  const loadGame = () => {
    const savedGame = localStorage.getItem('minitravian-save')
    if (savedGame) {
      const gameData = JSON.parse(savedGame)
      Object.assign(gameState, gameData)
      return true
    }
    return false
  }

  const saveGame = () => {
    const gameData = {
      isGameStarted: gameState.isGameStarted,
      race: gameState.race,
      resources: { ...gameState.resources },
      buildings: [...gameState.buildings],
      population: gameState.population,
      createdAt: gameState.createdAt,
      currentGameSection: gameState.currentGameSection,
    }
    localStorage.setItem('minitravian-save', JSON.stringify(gameData))
  }

  const resetGame = () => {
    Object.assign(gameState, initialState)
    localStorage.removeItem('minitravian-save')
  }

  const addResources = (resources: Partial<Resources>) => {
    if (resources.wood) gameState.resources.wood += resources.wood
    if (resources.stone) gameState.resources.stone += resources.stone
    if (resources.iron) gameState.resources.iron += resources.iron
    if (resources.food) gameState.resources.food += resources.food

    saveGame()
  }

  const spendResources = (resources: Partial<Resources>): boolean => {
    // Vérifier si on a assez de ressources
    if (resources.wood && gameState.resources.wood < resources.wood) return false
    if (resources.stone && gameState.resources.stone < resources.stone) return false
    if (resources.iron && gameState.resources.iron < resources.iron) return false
    if (resources.food && gameState.resources.food < resources.food) return false

    // Dépenser les ressources
    if (resources.wood) gameState.resources.wood -= resources.wood
    if (resources.stone) gameState.resources.stone -= resources.stone
    if (resources.iron) gameState.resources.iron -= resources.iron
    if (resources.food) gameState.resources.food -= resources.food

    saveGame()
    return true
  }

  const addBuilding = (building: Building) => {
    gameState.buildings.push(building)
    saveGame()
  }

  const upgradeBuilding = (buildingId: string) => {
    const building = gameState.buildings.find((b) => b.id === buildingId)
    if (building) {
      building.level += 1
      saveGame()
    }
  }

  const applyRaceBonuses = () => {
    if (!gameState.race) return

    // Appliquer les bonus de départ selon la race
    switch (gameState.race.id) {
      case 'romans':
        // +25% vitesse de construction (bonus ressources pour simuler)
        // Équilibrés avec bonus léger sur toutes les ressources
        gameState.resources.wood = Math.floor(gameState.resources.wood * 1.15)
        gameState.resources.stone = Math.floor(gameState.resources.stone * 1.2)
        gameState.resources.iron = Math.floor(gameState.resources.iron * 1.15)
        gameState.resources.food = Math.floor(gameState.resources.food * 1.1)
        break
      case 'gauls':
        // Focus défensif: plus de pierre et fer pour les fortifications
        gameState.resources.stone = Math.floor(gameState.resources.stone * 1.3)
        gameState.resources.iron = Math.floor(gameState.resources.iron * 1.2)
        gameState.resources.wood = Math.floor(gameState.resources.wood * 1.1)
        // Bonus population défensive
        gameState.population += 3
        break
      case 'germans':
        // Focus offensif: moins de ressources mais plus de population militaire
        gameState.resources.wood = Math.floor(gameState.resources.wood * 0.9)
        gameState.resources.stone = Math.floor(gameState.resources.stone * 0.8)
        gameState.resources.iron = Math.floor(gameState.resources.iron * 1.1)
        gameState.resources.food = Math.floor(gameState.resources.food * 0.9)
        // Plus de population pour les raids
        gameState.population += 7
        break
    }
  }

  // Auto-save périodique (toutes les 30 secondes)
  let autoSaveInterval: number | null = null

  const startAutoSave = () => {
    if (autoSaveInterval) return
    autoSaveInterval = window.setInterval(() => {
      if (gameState.isGameStarted) {
        saveGame()
      }
    }, 30000) // 30 secondes
  }

  const stopAutoSave = () => {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval)
      autoSaveInterval = null
    }
  }

  return {
    // État
    gameState,

    // Getters
    hasSavedGame,
    isRaceSelected,
    totalResources,

    // Actions
    startNewGame,
    loadGame,
    saveGame,
    resetGame,
    addResources,
    spendResources,
    addBuilding,
    upgradeBuilding,
    startAutoSave,
    stopAutoSave,
  }
}

// Export du type pour l'utilisation dans les composants
export type GameStore = ReturnType<typeof useGameStore>
