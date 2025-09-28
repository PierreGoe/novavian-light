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

export interface Artifact {
  id: string
  name: string
  type: 'weapon' | 'armor' | 'accessory' | 'relic'
  icon: string
  description: string
  effects: {
    economy?: number
    military?: number
    defense?: number
    resourceBonus?: {
      wood?: number
      stone?: number
      iron?: number
      food?: number
    }
  }
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  obtainedFrom?: string
}

export interface PlayerInventory {
  gold: number
  leadership: number
  artifacts: Artifact[]
  equippedArtifacts: {
    weapon?: Artifact
    armor?: Artifact
    accessory?: Artifact
    relic?: Artifact
  }
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

  inventory: PlayerInventory

  createdAt: string | null
  currentGameSection?: string
  isMissionStarted: boolean
}

// État initial du jeu
const initialState: GameState = {
  isGameStarted: false,
  race: null,
  inventory: {
    gold: 50,
    leadership: 100,
    artifacts: [],
    equippedArtifacts: {},
  },
  createdAt: null,
  currentGameSection: undefined,
  isMissionStarted: false,
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

  // Fonctions utilitaires
  const giveStartingArtifacts = (selectedRace: Race) => {
    // Artefacts de démarrage selon la race
    const startingArtifacts: { [key: string]: Artifact[] } = {
      romans: [
        {
          id: 'roman-gladius',
          name: 'Glaive Romain',
          type: 'weapon',
          icon: '⚔️',
          description: 'Une épée courte efficace, symbole de la discipline romaine.',
          effects: {
            military: 5,
            economy: 2,
          },
          rarity: 'common',
          obtainedFrom: 'Équipement de démarrage Romain',
        },
      ],
      gauls: [
        {
          id: 'gallic-shield',
          name: 'Bouclier Gaulois',
          type: 'armor',
          icon: '🛡️',
          description: 'Un bouclier robuste, parfait pour la défense du territoire.',
          effects: {
            defense: 8,
            resourceBonus: {
              stone: 5,
            },
          },
          rarity: 'common',
          obtainedFrom: 'Équipement de démarrage Gaulois',
        },
      ],
      germans: [
        {
          id: 'german-axe',
          name: 'Hache Germaine',
          type: 'weapon',
          icon: '🪓',
          description: 'Une hache de guerre redoutable pour les raids rapides.',
          effects: {
            military: 7,
            resourceBonus: {
              wood: 3,
            },
          },
          rarity: 'common',
          obtainedFrom: 'Équipement de démarrage Germain',
        },
      ],
    }

    const artifacts = startingArtifacts[selectedRace.id] || []
    artifacts.forEach((artifact) => {
      gameState.inventory.artifacts.push(artifact)
      // Équiper automatiquement l'artefact de démarrage
      gameState.inventory.equippedArtifacts[artifact.type] = artifact
    })

    // Donner aussi un peu d'or supplémentaire et ajuster le leadership selon la race
    gameState.inventory.gold += 25

    // Ajuster le leadership selon la race
    switch (selectedRace.id) {
      case 'romans':
        gameState.inventory.leadership += 10 // Leadership discipliné
        break
      case 'gauls':
        gameState.inventory.leadership += 5 // Leadership défensif, plus prudent
        break
      case 'germans':
        gameState.inventory.leadership -= 5 // Leadership plus risqué, basé sur la force
        break
    }
  }

  // Actions
  const startNewGame = (selectedRace: Race) => {
    gameState.race = selectedRace
    gameState.isGameStarted = true
    gameState.createdAt = new Date().toISOString()

    // Donner des artefacts de démarrage selon la race
    giveStartingArtifacts(selectedRace)

    // Sauvegarder
    saveGame()
  }

  const loadGame = () => {
    const savedGame = localStorage.getItem('minitravian-save')
    if (savedGame) {
      try {
        const gameData = JSON.parse(savedGame)

        // Charger chaque propriété individuellement pour s'assurer de la réactivité
        gameState.isGameStarted = gameData.isGameStarted ?? false
        gameState.race = gameData.race || null

        // Inventaire avec gold et leadership
        if (gameData.inventory) {
          gameState.inventory.gold = gameData.inventory.gold ?? initialState.inventory.gold
          gameState.inventory.leadership =
            gameData.inventory.leadership ?? initialState.inventory.leadership
          gameState.inventory.artifacts = gameData.inventory.artifacts || []
          gameState.inventory.equippedArtifacts = gameData.inventory.equippedArtifacts || {}
        }

        gameState.createdAt = gameData.createdAt || null
        gameState.currentGameSection = gameData.currentGameSection

        console.log('Game loaded successfully:', {
          gold: gameState.inventory.gold,
          leadership: gameState.inventory.leadership,
          isGameStarted: gameState.isGameStarted,
        })

        return true
      } catch (error) {
        console.error('Error loading game:', error)
        return false
      }
    }
    return false
  }

  const saveGame = () => {
    const gameData = {
      isGameStarted: gameState.isGameStarted,
      race: gameState.race,
      inventory: {
        gold: gameState.inventory.gold,
        leadership: gameState.inventory.leadership,
        artifacts: [...gameState.inventory.artifacts],
        equippedArtifacts: { ...gameState.inventory.equippedArtifacts },
      },
      createdAt: gameState.createdAt,
      currentGameSection: gameState.currentGameSection,
    }

    localStorage.setItem('minitravian-save', JSON.stringify(gameData))
  }

  const resetGame = () => {
    console.debug('Resetting game state to initial state')
    Object.assign(gameState, initialState)
    localStorage.removeItem('minitravian-save')
  }

  // Auto-save périodique (toutes les 30 secondes)
  let autoSaveInterval: number | null = null

  const startAutoSave = () => {
    if (autoSaveInterval) return
    autoSaveInterval = window.setInterval(() => {
      if (gameState.isGameStarted) {
        saveGame()
      }
    }, 5000) // 5 secondes
  }

  const stopAutoSave = () => {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval)
      autoSaveInterval = null
    }
  }

  // Fonctions d'inventaire
  const addGold = (amount: number) => {
    gameState.inventory.gold += amount
    saveGame()
  }

  const spendGold = (amount: number): boolean => {
    if (gameState.inventory.gold < amount) return false
    gameState.inventory.gold -= amount
    saveGame()
    return true
  }

  // Fonctions de leadership
  const addLeadership = (amount: number) => {
    gameState.inventory.leadership += amount
    // Limiter le leadership maximum à 200
    if (gameState.inventory.leadership > 200) {
      gameState.inventory.leadership = 200
    }
    saveGame()
  }

  const loseLeadership = (amount: number) => {
    gameState.inventory.leadership -= amount
    // Vérifier si le leadership tombe à 0 ou moins (Game Over)
    if (gameState.inventory.leadership <= 0) {
      gameState.inventory.leadership = 0
      // Déclencher le Game Over
      triggerGameOver()
    }
    saveGame()
  }

  const triggerGameOver = () => {
    // Réinitialiser le jeu ou naviguer vers un écran de Game Over
    // Pour l'instant, on va juste réinitialiser
    resetGame()
  }

  // Computed pour vérifier l'état du leadership
  const leadershipStatus = computed(() => {
    const leadership = gameState.inventory.leadership
    if (leadership >= 150)
      return { level: 'excellent', color: '#22c55e', description: 'Leadership exceptionnel' }
    if (leadership >= 100) return { level: 'good', color: '#3b82f6', description: 'Bon leadership' }
    if (leadership >= 50)
      return { level: 'average', color: '#f59e0b', description: 'Leadership moyen' }
    if (leadership >= 25)
      return { level: 'low', color: '#ef4444', description: 'Leadership faible' }
    return {
      level: 'critical',
      color: '#dc2626',
      description: 'Leadership critique - Risque de révolte !',
    }
  })

  const addArtifact = (artifact: Artifact) => {
    gameState.inventory.artifacts.push(artifact)
    saveGame()
  }

  const equipArtifact = (artifact: Artifact): boolean => {
    // Vérifier si l'artefact est dans l'inventaire
    if (!gameState.inventory.artifacts.find((a) => a.id === artifact.id)) return false

    // Déséquiper l'artefact actuel du même type s'il existe
    const currentEquipped = gameState.inventory.equippedArtifacts[artifact.type]
    if (currentEquipped) {
      unequipArtifact(currentEquipped.type)
    }

    // Équiper le nouvel artefact
    gameState.inventory.equippedArtifacts[artifact.type] = artifact
    saveGame()
    return true
  }

  const unequipArtifact = (type: Artifact['type']) => {
    delete gameState.inventory.equippedArtifacts[type]
    saveGame()
  }

  const getEquippedArtifacts = computed(() => {
    return Object.values(gameState.inventory.equippedArtifacts).filter(Boolean)
  })

  const getTotalArtifactEffects = computed(() => {
    const effects = {
      economy: 0,
      military: 0,
      defense: 0,
      resourceBonus: {
        wood: 0,
        stone: 0,
        iron: 0,
        food: 0,
      },
    }

    Object.values(gameState.inventory.equippedArtifacts).forEach((artifact) => {
      if (artifact) {
        effects.economy += artifact.effects.economy || 0
        effects.military += artifact.effects.military || 0
        effects.defense += artifact.effects.defense || 0

        if (artifact.effects.resourceBonus) {
          effects.resourceBonus.wood += artifact.effects.resourceBonus.wood || 0
          effects.resourceBonus.stone += artifact.effects.resourceBonus.stone || 0
          effects.resourceBonus.iron += artifact.effects.resourceBonus.iron || 0
          effects.resourceBonus.food += artifact.effects.resourceBonus.food || 0
        }
      }
    })

    return effects
  })

  return {
    // État
    gameState,

    // Getters
    hasSavedGame,
    isRaceSelected,
    getEquippedArtifacts,
    getTotalArtifactEffects,

    // Actions
    startNewGame,
    loadGame,
    saveGame,
    resetGame,
    startAutoSave,
    stopAutoSave,

    // Actions d'inventaire
    addGold,
    spendGold,
    addLeadership,
    loseLeadership,
    leadershipStatus,
    addArtifact,
    equipArtifact,
    unequipArtifact,
  }
}

// Export du type pour l'utilisation dans les composants
export type GameStore = ReturnType<typeof useGameStore>
