import { reactive, computed } from 'vue'
import { generateMap } from '@/utils'

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

export interface MapNode {
  id: string
  type: 'combat' | 'elite' | 'shop' | 'event' | 'rest' | 'boss'
  title: string
  description: string
  icon: string
  row: number
  col: number
  connections: string[] // IDs des nodes suivants connectés
  completed: boolean
  accessible: boolean
  reward?: {
    type: 'gold' | 'card' | 'relic' | 'leadership'
    amount?: number
    name?: string
  }
}

export interface MapLayer {
  row: number
  nodes: MapNode[]
}

export interface MapState {
  layers: MapLayer[]
  currentPlayerRow: number
  selectedNodeId: string
  mapGenerated: boolean
}

export interface GameState {
  isGameStarted: boolean
  race: Race | null

  inventory: PlayerInventory

  createdAt: string | null
  currentGameSection?: string
  isMissionStarted: boolean
  mapState: MapState
}

const createInitialState = (): GameState => ({
  isGameStarted: false,
  race: null,
  inventory: {
    gold: 50,
    leadership: 100,
    artifacts: [], // ← Nouveau tableau à chaque appel
    equippedArtifacts: {}, // ← Nouvel objet à chaque appel
  },
  createdAt: null,
  currentGameSection: undefined,
  isMissionStarted: false,
  mapState: {
    layers: [], // ← Nouveau tableau à chaque appel
    currentPlayerRow: 0,
    selectedNodeId: '',
    mapGenerated: false,
  },
})

// Store réactif avec clone profond
const gameState = reactive<GameState>(createInitialState())
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

    // Partir des valeurs initiales à chaque fois
    const initial = createInitialState()
    gameState.inventory.gold = initial.inventory.gold + 25

    // Ajuster le leadership selon la race
    switch (selectedRace.id) {
      case 'romans':
        gameState.inventory.leadership = initial.inventory.leadership + 10 // Leadership discipliné
        break
      case 'gauls':
        gameState.inventory.leadership = initial.inventory.leadership + 5 // Leadership défensif, plus prudent
        break
      case 'germans':
        gameState.inventory.leadership = initial.inventory.leadership - 5 // Leadership plus risqué, basé sur la force
        break
      default:
        gameState.inventory.leadership = initial.inventory.leadership
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
          gameState.inventory.gold = gameData.inventory.gold || 0
          gameState.inventory.leadership = gameData.inventory.leadership || 100
          gameState.inventory.artifacts = gameData.inventory.artifacts || []
          gameState.inventory.equippedArtifacts = gameData.inventory.equippedArtifacts || {}
        }

        // État de la carte
        if (gameData.mapState) {
          gameState.mapState.layers = gameData.mapState.layers || []
          gameState.mapState.currentPlayerRow = gameData.mapState.currentPlayerRow ?? 0
          gameState.mapState.selectedNodeId = gameData.mapState.selectedNodeId ?? null
          gameState.mapState.mapGenerated = gameData.mapState.mapGenerated ?? false
        } else {
          // Si pas de mapState sauvegardé, utiliser l'état initial
          gameState.mapState = { ...createInitialState().mapState }
        }

        gameState.createdAt = gameData.createdAt || null
        gameState.currentGameSection = gameData.currentGameSection

        console.log('Game loaded successfully:', {
          gold: gameState.inventory.gold,
          leadership: gameState.inventory.leadership,
          isGameStarted: gameState.isGameStarted,
          mapGenerated: gameState.mapState.mapGenerated,
          layersCount: gameState.mapState.layers.length,
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
    try {
      const gameData = {
        isGameStarted: gameState.isGameStarted,
        race: gameState.race,
        inventory: {
          gold: gameState.inventory.gold,
          leadership: gameState.inventory.leadership,
          artifacts: [...gameState.inventory.artifacts],
          equippedArtifacts: { ...gameState.inventory.equippedArtifacts },
        },
        mapState: {
          layers: gameState.mapState.layers.map((layer) => ({
            ...layer,
            nodes: layer.nodes.map((node) => ({ ...node })), // Clone profond des nœuds
          })),
          currentPlayerRow: gameState.mapState.currentPlayerRow,
          selectedNodeId: gameState.mapState.selectedNodeId,
          mapGenerated: gameState.mapState.mapGenerated,
        },
        createdAt: gameState.createdAt,
        currentGameSection: gameState.currentGameSection,
      }

      localStorage.setItem('minitravian-save', JSON.stringify(gameData))
    } catch (error) {
      console.error('Error saving game:', error)
    }
  }

  // Reset complet - le joueur doit resélectionner une race
  const resetGameCompletely = () => {
    console.debug('Resetting game completely - player will select race again')
    Object.assign(gameState, createInitialState())
    localStorage.removeItem('minitravian-save')
  }

  // Reset de la progression - garde la race sélectionnée
  const resetMapOnly = () => {
    console.debug('Resetting map progress - keeping selected race')
    if (!gameState.race) {
      console.warn('No race selected, cannot reset map only')
      return
    }

    const currentRace = gameState.race

    // Sauvegarder la race actuelle
    const raceToKeep = { ...currentRace }

    console.log('Resetting with race:', raceToKeep.name)

    // Réinitialiser chaque propriété individuellement pour maintenir la réactivité
    const freshState = createInitialState()

    // Réinitialiser l'inventaire
    gameState.inventory.gold = freshState.inventory.gold
    gameState.inventory.leadership = freshState.inventory.leadership
    gameState.inventory.artifacts.length = 0 // Vider le tableau existant
    Object.keys(gameState.inventory.equippedArtifacts).forEach((key) => {
      delete gameState.inventory.equippedArtifacts[
        key as keyof typeof gameState.inventory.equippedArtifacts
      ]
    })

    // Réinitialiser l'état de la carte
    gameState.mapState.layers.length = 0 // Vider le tableau existant
    gameState.mapState.currentPlayerRow = freshState.mapState.currentPlayerRow
    gameState.mapState.selectedNodeId = freshState.mapState.selectedNodeId
    gameState.mapState.mapGenerated = freshState.mapState.mapGenerated

    console.log(JSON.stringify(gameState.mapState))

    // Remettre les autres propriétés
    gameState.race = raceToKeep
    gameState.isGameStarted = true
    gameState.createdAt = new Date().toISOString()
    gameState.currentGameSection = freshState.currentGameSection
    gameState.isMissionStarted = freshState.isMissionStarted

    // Redonner les artefacts de démarrage
    giveStartingArtifacts(raceToKeep)

    // Force une mise à jour de l'interface
    console.log('New gold value:', gameState.inventory.gold)
    console.log('New leadership value:', gameState.inventory.leadership)

    // Sauvegarder immédiatement
    saveGame()

    console.log('Map reset completed, race preserved:', raceToKeep.name)
  }

  // Fonctions pour la gestion de la carte
  const setMapLayers = (layers: MapLayer[]) => {
    gameState.mapState.layers = layers
    gameState.mapState.mapGenerated = true
    saveGame()
  }

  const setCurrentPlayerRow = (row: number) => {
    gameState.mapState.currentPlayerRow = row
    saveGame()
  }

  const setSelectedNodeId = (nodeId: string) => {
    gameState.mapState.selectedNodeId = nodeId
    saveGame()
  }

  const resetMapState = () => {
    gameState.mapState = { ...createInitialState().mapState }
    saveGame()
  }

  const updateNodeInMap = (nodeId: string, updates: Partial<MapNode>) => {
    const allNodes = gameState.mapState.layers.flatMap((layer) => layer.nodes)
    const node = allNodes.find((n) => n.id === nodeId)
    if (node) {
      Object.assign(node, updates)
      saveGame()
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
    // Pour l'instant, on va juste réinitialiser complètement
    resetGameCompletely()
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

  // ====== FONCTIONS DE GESTION DE CARTE ======

  const initializeMapIfNeeded = () => {
    console.log('initializeMapIfNeeded called, mapGenerated:', gameState.mapState.mapGenerated)

    if (!gameState.mapState.mapGenerated) {
      console.log('Generating new map...')
      const newMapLayers = generateMap()

      // Rendre accessible le node unique de la première ligne
      if (newMapLayers.length > 0 && newMapLayers[0].nodes.length > 0) {
        const firstLayer = newMapLayers[0]
        // Il n'y a qu'un seul node dans la première ligne (index 0)
        firstLayer.nodes[0].accessible = true
        console.log('First node made accessible')
      }

      setMapLayers(newMapLayers)
      setCurrentPlayerRow(0)
      gameState.mapState.mapGenerated = true

      console.log('Map initialized with', newMapLayers.length, 'layers')
      saveGame()
    } else {
      console.log('Map already generated, skipping initialization')
    }
  }

  const selectMapNode = (node: MapNode) => {
    if (!node.accessible || node.completed) return

    // Marquer le node comme complété et sélectionné
    setSelectedNodeId(node.id)
    updateNodeInMap(node.id, { completed: true })
    setCurrentPlayerRow(node.row)

    // IMPORTANT: Rendre inaccessibles tous les autres nodes de la même ligne
    // pour empêcher le joueur de revenir en arrière
    const currentLayer = gameState.mapState.layers.find((layer) => layer.row === node.row)
    if (currentLayer) {
      currentLayer.nodes.forEach((layerNode) => {
        if (layerNode.id !== node.id && !layerNode.completed) {
          updateNodeInMap(layerNode.id, { accessible: false })
        }
      })
    }

    // Rendre accessibles UNIQUEMENT les nodes directement connectés à ce node
    const allNodes: MapNode[] = []
    gameState.mapState.layers.forEach((layer) => {
      allNodes.push(...layer.nodes)
    })

    node.connections.forEach((connectionId) => {
      const nextNode = allNodes.find((n) => n.id === connectionId)
      if (nextNode && !nextNode.completed) {
        updateNodeInMap(connectionId, { accessible: true })
      }
    })

    // Déclencher l'action du node
    handleMapNodeAction(node)
    saveGame()
  }

  const handleMapNodeAction = async (
    node: MapNode,
    router?: { push: (path: string) => void },
    toastStore?: {
      showInfo: (msg: string, opts?: any) => void
      showSuccess: (msg: string, opts?: any) => void
    },
  ) => {
    switch (node.type) {
      case 'combat':
      case 'elite':
        // Naviguer vers la vue de missions/combat
        if (toastStore) {
          toastStore.showInfo(`Préparation du combat contre ${node.title}...`, { duration: 2000 })
        }

        // Créer une mission basée sur le node
        const mission = {
          id: `mission-${node.id}`,
          name: node.title,
          type: 'combat' as const,
          difficulty: node.type === 'elite' ? ('elite' as const) : ('medium' as const),
          enemy: {
            name: node.title,
            units: [], // TODO: Définir les unités ennemies
          },
          rewards: {
            gold: node.reward?.type === 'gold' ? node.reward.amount : undefined,
            resources:
              node.type === 'elite'
                ? { wood: 100, clay: 80, iron: 120, crop: 60 }
                : { wood: 50, clay: 40, iron: 60, crop: 30 },
          },
          losePenalty: {
            gold: 0,
            leadership: randomLeadershipLoss(node.type),
          },
          isActive: false,
          isCompleted: false,
        }

        // Importer le missionStore dynamiquement
        try {
          const { useMissionStore } = await import('@/stores/missionStore')
          const missionStore = useMissionStore()
          missionStore.startMission(mission)

          // Naviguer vers la vue de campagne
          if (router) {
            router.push('/campaign')
          }
        } catch (error) {
          console.error('Error loading mission store:', error)
        }
        break

      case 'shop':
        if (toastStore) {
          toastStore.showInfo(
            `${node.title} - Magasin ouvert! Vous pouvez acheter des améliorations.`,
            { duration: 4000 },
          )
        }
        break

      case 'event':
        if (toastStore) {
          toastStore.showInfo(
            `${node.title} - ${node.description} Récompense: ${node.reward?.type} ${node.reward?.name || node.reward?.amount || ''}`,
            { duration: 6000 },
          )
        }
        if (node.reward) {
          if (node.reward.type === 'gold') {
            addGold(node.reward.amount || 0)
          } else if (node.reward.type === 'relic') {
            const artifact = giveRandomArtifact()
            if (toastStore) {
              toastStore.showSuccess(
                `Nouvel artefact obtenu: ${artifact.name}! Consultez votre inventaire pour l'équiper.`,
                { duration: 6000 },
              )
            }
          }
        }
        break

      case 'rest':
        if (toastStore) {
          toastStore.showSuccess(
            `${node.title} - Vous regagnez ${node.reward?.amount || 0} points de leadership.`,
            { duration: 4000 },
          )
        }
        if (node.reward?.type === 'leadership') {
          addLeadership(node.reward.amount || 0)
        }
        break

      case 'boss':
        if (toastStore) {
          toastStore.showSuccess(`${node.title} - Bravo! Vous avez terminé cette carte!`, {
            duration: 7000,
          })
        }
        // Naviguer vers le jeu principal
        gameState.currentGameSection = 'completed-map'
        saveGame()
        if (router) {
          setTimeout(() => {
            router.push('/game/victory')
          }, 1000) // Petit délai pour laisser le temps de voir le toast
        }
        break
    }
  }

  const giveRandomArtifact = () => {
    const randomArtifacts = [
      {
        id: `artifact-${Date.now()}`,
        name: 'Amulette de Fortune',
        type: 'accessory' as const,
        icon: '🧿',
        description: 'Une amulette qui améliore les gains économiques.',
        effects: {
          economy: 5,
        },
        rarity: 'rare' as const,
        obtainedFrom: 'Victoire contre un champion élite',
      },
      {
        id: `artifact-${Date.now()}-2`,
        name: 'Anneau de Commandement',
        type: 'accessory' as const,
        icon: '💍',
        description: 'Un anneau qui renforce le leadership militaire.',
        effects: {
          military: 4,
          defense: 2,
        },
        rarity: 'rare' as const,
        obtainedFrom: 'Victoire contre un champion élite',
      },
      {
        id: `artifact-${Date.now()}-3`,
        name: 'Relique Ancienne',
        type: 'relic' as const,
        icon: '🏺',
        description: 'Un artefact mystérieux aux pouvoirs inconnus.',
        effects: {
          economy: 2,
          military: 2,
          defense: 2,
        },
        rarity: 'epic' as const,
        obtainedFrom: 'Victoire contre un champion élite',
      },
    ]

    const randomArtifact = randomArtifacts[Math.floor(Math.random() * randomArtifacts.length)]
    addArtifact(randomArtifact)

    return randomArtifact
  }

  function randomLeadershipLoss(type: string) {
    // Loss is higher for elite, lower for combat
    if (type === 'elite') {
      // Elite nodes: lose between 150 and 250 leadership
      return Math.floor(Math.random() * 101) + 150
    }
    // Regular combat: lose between 50 and 120 leadership
    return Math.floor(Math.random() * 71) + 50
  }

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
    resetGameCompletely,
    resetMapOnly,
    startAutoSave,
    stopAutoSave,

    // Actions de carte
    setMapLayers,
    setCurrentPlayerRow,
    setSelectedNodeId,
    resetMapState,
    updateNodeInMap,
    initializeMapIfNeeded,
    selectMapNode,
    handleMapNodeAction,
    giveRandomArtifact,

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
