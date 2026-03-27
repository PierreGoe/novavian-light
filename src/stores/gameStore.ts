/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive, computed } from 'vue'
import { generateMap } from '@/utils'
import router from '@/router'
import { useMissionStore } from '@/stores/missionStore'
import { useMapStore } from '@/stores/mapStore'
import {
  STARTING_ARTIFACTS,
  SELL_PRICES,
  instantiateArtifact,
  getPoolByRarity,
} from '@/data/artifacts'

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

/** Type de durabilité d'un artefact */
export type ArtifactDurability = 'single-use' | 'uses-limited' | 'permanent'

/** Types de pouvoirs spéciaux uniques */
export type SpecialPowerType =
  | 'scout_range_bonus' // les éclaireurs voient X cases de plus
  | 'fog_reveal_on_victory' // révèle des cases autour après victoire
  | 'gold_on_victory' // bonus d'or par victoire de combat
  | 'leadership_on_victory' // bonus de leadership par victoire
  | 'first_strike' // attaque en premier au combat
  | 'siege_bonus' // bonus aux sièges de villes
  | 'healing_after_combat' // soins partiels après chaque combat
  | 'double_scout_speed' // les éclaireurs explorent 2x plus vite

export interface SpecialPower {
  type: SpecialPowerType
  value: number // ampleur du bonus (ex: 1 pour +1 case de vision)
  description: string // texte lisible affiché dans l'UI
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
  specialPower?: SpecialPower // pouvoir unique non-statistique
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  durability: ArtifactDurability // durée de vie de l'artefact
  maxUses?: number // nombre de combats max (si uses-limited)
  usesRemaining?: number // combats restants
  destructible: boolean // détruit en cas de défaite de campagne
  obtainedFrom?: string
}

/** Nombre maximum de reliques actives simultanément */
export const MAX_ACTIVE_ARTIFACTS = 4

export interface PlayerInventory {
  gold: number
  leadership: number
  artifacts: Artifact[] // tous les artefacts possédés
  activeArtifacts: string[] // IDs des artefacts actifs (max MAX_ACTIVE_ARTIFACTS)
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
  inProgress?: boolean // Mission en cours (pas encore terminée)
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

export type VictoryPointType = 'combat'

/** Objectif de PV combat pour valider une campagne */
export const COMBAT_VP_GOAL = 5

export interface VictoryPoints {
  combat: number
}

/** Un événement qui a rapporté des PV (pour l'historique) */
export interface VictoryEvent {
  id: string
  type: VictoryPointType
  amount: number
  reason: string
  date: string
}

export interface GameState {
  currentStatus: 'not-started' | 'in-progress' | 'game-over' | 'completed'
  race: Race | null

  inventory: PlayerInventory

  createdAt: string | null
  currentGameSection?: string
  isMissionStarted: boolean
  mapState: MapState
  gameOverReason?: string
  victoryPoints: VictoryPoints
  victoryHistory: VictoryEvent[]
}

const createInitialState = (): GameState => ({
  currentStatus: 'not-started',
  race: null,
  gameOverReason: undefined,
  inventory: {
    gold: 50,
    leadership: 100,
    artifacts: [], // ← Nouveau tableau à chaque appel
    activeArtifacts: [], // ← IDs des artefacts actifs
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
  victoryPoints: {
    combat: 0,
  },
  victoryHistory: [],
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
    // Artefact de démarrage depuis le catalogue centralisé (src/data/artifacts.ts)
    const startingArtifact = STARTING_ARTIFACTS[selectedRace.id]
    if (startingArtifact) {
      gameState.inventory.artifacts.push(startingArtifact)
      // Activer automatiquement l'artefact de démarrage
      if (gameState.inventory.activeArtifacts.length < MAX_ACTIVE_ARTIFACTS) {
        gameState.inventory.activeArtifacts.push(startingArtifact.id)
      }
    }

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
    gameState.currentStatus = 'in-progress'
    gameState.createdAt = new Date().toISOString()

    // Donner des artefacts de démarrage selon la race
    giveStartingArtifacts(selectedRace)

    // Sauvegarder
    saveGame()
  }

  const loadGame = () => {
    const savedGame = localStorage.getItem('minitravian-save')

    if (!savedGame) return router.push('/')
    if (savedGame) {
      // if game over, redirect to game over screen
      if (gameState.currentStatus === 'game-over') {
        router.push('/game-over')
      }
      try {
        const gameData = JSON.parse(savedGame)

        // Charger chaque propriété individuellement pour s'assurer de la réactivité
        gameState.currentStatus = gameData.currentStatus ?? 'not-started'
        gameState.race = gameData.race || null

        // Inventaire avec gold et leadership
        if (gameData.inventory) {
          gameState.inventory.gold = gameData.inventory.gold || 0
          gameState.inventory.leadership = gameData.inventory.leadership ?? 100
          gameState.inventory.artifacts = gameData.inventory.artifacts || []
          // Migration : si l'ancien save utilisait equippedArtifacts, on convertit
          if (gameData.inventory.activeArtifacts) {
            gameState.inventory.activeArtifacts = gameData.inventory.activeArtifacts
          } else if (gameData.inventory.equippedArtifacts) {
            gameState.inventory.activeArtifacts = Object.values(
              gameData.inventory.equippedArtifacts as Record<string, Artifact>,
            )
              .filter(Boolean)
              .map((a) => (a as Artifact).id)
              .slice(0, MAX_ACTIVE_ARTIFACTS)
          } else {
            gameState.inventory.activeArtifacts = []
          }
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

        // Points de victoire
        if (gameData.victoryPoints) {
          gameState.victoryPoints.combat = gameData.victoryPoints.combat ?? 0
        }
        if (gameData.victoryHistory) {
          gameState.victoryHistory = gameData.victoryHistory
        }

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
        currentStatus: gameState.currentStatus,
        race: gameState.race,
        inventory: {
          gold: gameState.inventory.gold,
          leadership: gameState.inventory.leadership,
          artifacts: [...gameState.inventory.artifacts],
          activeArtifacts: [...gameState.inventory.activeArtifacts],
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
        victoryPoints: { ...gameState.victoryPoints },
        victoryHistory: [...gameState.victoryHistory],
      }

      localStorage.setItem('minitravian-save', JSON.stringify(gameData))
    } catch (error) {
      console.error('Error saving game:', error)
    }
  }

  // Reset complet - le joueur doit resélectionner une race
  const resetGameCompletely = () => {
    Object.assign(gameState, createInitialState())
    localStorage.removeItem('minitravian-save')
  }

  // Reset de la progression - garde la race sélectionnée
  const resetMapOnly = () => {
    if (!gameState.race) {
      return
    }

    const currentRace = gameState.race

    // Sauvegarder la race actuelle
    const raceToKeep = { ...currentRace }

    // Réinitialiser chaque propriété individuellement pour maintenir la réactivité
    const freshState = createInitialState()

    // Réinitialiser l'inventaire
    gameState.inventory.gold = freshState.inventory.gold
    gameState.inventory.leadership = freshState.inventory.leadership
    gameState.inventory.artifacts.length = 0 // Vider le tableau existant
    gameState.inventory.activeArtifacts.length = 0 // Vider les slots actifs

    // Réinitialiser l'état de la carte
    gameState.mapState.layers.length = 0 // Vider le tableau existant
    gameState.mapState.currentPlayerRow = freshState.mapState.currentPlayerRow
    gameState.mapState.selectedNodeId = freshState.mapState.selectedNodeId
    gameState.mapState.mapGenerated = freshState.mapState.mapGenerated

    // Remettre les autres propriétés
    gameState.race = raceToKeep
    gameState.currentStatus = 'in-progress'
    gameState.createdAt = new Date().toISOString()
    gameState.currentGameSection = freshState.currentGameSection
    gameState.isMissionStarted = freshState.isMissionStarted

    // Redonner les artefacts de démarrage
    giveStartingArtifacts(raceToKeep)

    // Sauvegarder immédiatement
    saveGame()
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
      if (gameState.currentStatus === 'in-progress') {
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

  // ====== POINTS DE VICTOIRE ======

  const addVictoryPoints = (type: VictoryPointType, amount: number, reason: string) => {
    gameState.victoryPoints[type] += amount
    gameState.victoryHistory.unshift({
      id: `vp-${Date.now()}`,
      type,
      amount,
      reason,
      date: new Date().toISOString(),
    })
    // Garder seulement les 100 derniers événements
    if (gameState.victoryHistory.length > 100) {
      gameState.victoryHistory.length = 100
    }
    saveGame()
  }

  const victoryPoints = computed(() => gameState.victoryPoints)
  const victoryHistory = computed(() => gameState.victoryHistory)

  /** Récompense de fin de campagne et retour au mission-tree */
  const completeCampaign = (bonusGold = 100) => {
    // Récompense en or de base
    gameState.inventory.gold += bonusGold

    // Pouvoirs spéciaux déclenchés à chaque fin de campagne
    const equippedArtifacts = gameState.inventory.artifacts.filter((a) =>
      gameState.inventory.activeArtifacts.includes(a.id),
    )
    for (const artifact of equippedArtifacts) {
      const sp = artifact.specialPower
      if (!sp) continue
      if (sp.type === 'gold_on_victory') {
        gameState.inventory.gold += sp.value
      } else if (sp.type === 'leadership_on_victory') {
        gameState.inventory.leadership = Math.min(200, gameState.inventory.leadership + sp.value)
      }
    }

    // Marquer le node courant comme complété (si en mission)
    if (gameState.mapState.selectedNodeId) {
      completeMapNode(gameState.mapState.selectedNodeId)
    }

    // Réinitialiser l'état de mission (ressources, ville, unités, scouts)
    const missionStore = useMissionStore()
    missionStore.resetMissionState()

    // Réinitialiser la carte d'exploration
    const mapStore = useMapStore()
    mapStore.resetMapState()

    // Réinitialiser les points de victoire pour la prochaine campagne
    gameState.victoryPoints.combat = 0
    gameState.victoryHistory.length = 0

    saveGame()
    // La navigation vers '/mission-tree' est gérée par le composant appelant
  }

  /** Vrai si l'objectif de PV combat de la campagne est atteint */
  const campaignObjectiveReached = computed(() => gameState.victoryPoints.combat >= COMBAT_VP_GOAL)

  const spendGold = (amount: number): boolean => {
    if (gameState.inventory.gold < amount) return false
    gameState.inventory.gold -= amount
    saveGame()
    return true
  }

  // Fonction de leadership unifiée
  const updateLeadership = (change: number, mode: 'add' | 'lose' | 'set' = 'set') => {
    switch (mode) {
      case 'add':
        gameState.inventory.leadership += change
        // Limiter le leadership maximum à 200
        if (gameState.inventory.leadership > 200) {
          gameState.inventory.leadership = 200
        }
        break

      case 'lose':
        gameState.inventory.leadership -= change

        // Vérifier si le leadership tombe à 0 ou moins (Game Over)
        if (gameState.inventory.leadership <= 0) {
          gameState.inventory.leadership = 0
          triggerGameOver()
        }
        break

      case 'set':
      default:
        gameState.inventory.leadership = change

        // Vérifier Game Over même en mode 'set'
        if (gameState.inventory.leadership <= 0) {
          gameState.inventory.leadership = 0
          triggerGameOver()
        }
        break
    }

    saveGame()
  }

  const triggerGameOver = () => {
    // Détruire les reliques fragiles actives avant de déclencher le game over
    destroyDestructiblesOnCampaignLoss()

    gameState.currentStatus = 'game-over'
    router.push('/game-over')
    saveGame()
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

  /** Active un artefact dans un slot (max MAX_ACTIVE_ARTIFACTS) */
  const activateArtifact = (artifactId: string): boolean => {
    if (!gameState.inventory.artifacts.find((a) => a.id === artifactId)) return false
    if (gameState.inventory.activeArtifacts.includes(artifactId)) return false
    if (gameState.inventory.activeArtifacts.length >= MAX_ACTIVE_ARTIFACTS) return false

    gameState.inventory.activeArtifacts.push(artifactId)
    saveGame()
    return true
  }

  /** Désactive un artefact d'un slot */
  const deactivateArtifact = (artifactId: string): void => {
    const index = gameState.inventory.activeArtifacts.indexOf(artifactId)
    if (index !== -1) {
      gameState.inventory.activeArtifacts.splice(index, 1)
      saveGame()
    }
  }

  /** Consomme une utilisation d'un artefact à durée limitée et le retire si épuisé */
  const consumeArtifactUse = (artifactId: string): void => {
    const artifact = gameState.inventory.artifacts.find((a) => a.id === artifactId)
    if (!artifact || artifact.durability === 'permanent') return

    if (artifact.durability === 'single-use') {
      // Retirer de l'inventaire immédiatement
      deactivateArtifact(artifactId)
      gameState.inventory.artifacts = gameState.inventory.artifacts.filter(
        (a) => a.id !== artifactId,
      )
    } else if (artifact.durability === 'uses-limited' && artifact.usesRemaining !== undefined) {
      artifact.usesRemaining -= 1
      if (artifact.usesRemaining <= 0) {
        deactivateArtifact(artifactId)
        gameState.inventory.artifacts = gameState.inventory.artifacts.filter(
          (a) => a.id !== artifactId,
        )
      }
    }
    saveGame()
  }

  /** Détruit les artefacts destructibles après une défaite de campagne */
  const destroyDestructiblesOnCampaignLoss = (): Artifact[] => {
    const destroyed: Artifact[] = []
    const toDestroy = gameState.inventory.artifacts.filter(
      (a) => a.destructible && gameState.inventory.activeArtifacts.includes(a.id),
    )

    toDestroy.forEach((artifact) => {
      destroyed.push(artifact)
      deactivateArtifact(artifact.id)
      gameState.inventory.artifacts = gameState.inventory.artifacts.filter(
        (a) => a.id !== artifact.id,
      )
    })

    if (destroyed.length > 0) saveGame()
    return destroyed
  }

  /** Alias pour la compatibilité des templates existants */
  const getEquippedArtifacts = computed(() => {
    return gameState.inventory.artifacts.filter((a) =>
      gameState.inventory.activeArtifacts.includes(a.id),
    ) as Artifact[]
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

    getEquippedArtifacts.value.forEach((artifact) => {
      effects.economy += artifact.effects.economy || 0
      effects.military += artifact.effects.military || 0
      effects.defense += artifact.effects.defense || 0

      if (artifact.effects.resourceBonus) {
        effects.resourceBonus.wood += artifact.effects.resourceBonus.wood || 0
        effects.resourceBonus.stone += artifact.effects.resourceBonus.stone || 0
        effects.resourceBonus.iron += artifact.effects.resourceBonus.iron || 0
        effects.resourceBonus.food += artifact.effects.resourceBonus.food || 0
      }
    })

    return effects
  })

  // ====== FONCTIONS DE GESTION DE CARTE ======

  const initializeMapIfNeeded = () => {
    if (!gameState.mapState.mapGenerated) {
      const newMapLayers = generateMap()

      // Rendre accessible le node unique de la première ligne
      if (newMapLayers.length > 0 && newMapLayers[0].nodes.length > 0) {
        newMapLayers[0].nodes[0].accessible = true
      }

      setMapLayers(newMapLayers)
      setCurrentPlayerRow(0)
      gameState.mapState.mapGenerated = true
      saveGame()
    }
  }

  const selectMapNode = (node: MapNode) => {
    if (!node.accessible || node.completed || node.inProgress) return

    // Marquer le node comme EN COURS (pas encore completed)
    setSelectedNodeId(node.id)
    updateNodeInMap(node.id, { inProgress: true })
    setCurrentPlayerRow(node.row)

    // IMPORTANT: Rendre inaccessibles tous les autres nodes de la même ligne
    // pour empêcher le joueur de choisir un autre chemin
    const currentLayer = gameState.mapState.layers.find((layer) => layer.row === node.row)
    if (currentLayer) {
      currentLayer.nodes.forEach((layerNode) => {
        if (layerNode.id !== node.id && !layerNode.completed) {
          updateNodeInMap(layerNode.id, { accessible: false })
        }
      })
    }

    // Ne PAS rendre accessibles les nodes suivants maintenant
    // Ils le seront seulement quand la mission sera complétée

    // Déclencher l'action du node (démarrer la mission)
    handleMapNodeAction(node)

    // Pour le Bazar, naviguer directement — la complétion se fait au départ du Bazar
    if (node.type === 'shop') {
      router.push('/bazar')
    }

    saveGame()
  }

  // Nouvelle fonction à appeler quand une mission est complétée
  const completeMapNode = (nodeId: string) => {
    const allNodes: MapNode[] = []
    gameState.mapState.layers.forEach((layer) => {
      allNodes.push(...layer.nodes)
    })

    const node = allNodes.find((n) => n.id === nodeId)
    if (!node) return

    // Marquer comme complété (plus en cours)
    updateNodeInMap(nodeId, { completed: true, inProgress: false })

    // Maintenant rendre accessibles les nodes suivants
    node.connections.forEach((connectionId) => {
      const nextNode = allNodes.find((n) => n.id === connectionId)
      if (nextNode && !nextNode.completed) {
        updateNodeInMap(connectionId, { accessible: true })
      }
    })

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
    // Protection serveur : ignorer tout node déjà complété ou non accessible
    // Cette vérification est côté logique et ne peut pas être contournée par modification CSS
    if (node.completed || (!node.accessible && !node.inProgress)) return

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

        // Utiliser le missionStore
        const missionStore = useMissionStore()
        missionStore.startMission(mission)

        // Naviguer vers la vue de campagne
        if (router) {
          router.push('/campaign')
        }
        break

      case 'shop':
        // Navigation vers le Bazar gérée par selectMapNode
        // La complétion du node se fait au départ du Bazar (BazarMystiqueView)
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
        // Compléter immédiatement le node (pas de mission)
        completeMapNode(node.id)
        break

      case 'rest':
        if (toastStore) {
          toastStore.showSuccess(
            `${node.title} - Vous regagnez ${node.reward?.amount || 0} points de leadership.`,
            { duration: 4000 },
          )
        }
        if (node.reward?.type === 'leadership') {
          updateLeadership(node.reward.amount || 0, 'add')
        }
        // Compléter immédiatement le node (pas de mission)
        completeMapNode(node.id)
        break

      case 'boss':
        if (toastStore) {
          toastStore.showSuccess(`${node.title} - Bravo! Vous avez terminé cette carte!`, {
            duration: 7000,
          })
        }
        // Compléter immédiatement le node (pas de mission)
        completeMapNode(node.id)
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

  const giveRandomArtifact = (): Artifact => {
    // Mélange pondéré depuis le catalogue : common 40%, rare 40%, epic 20%
    const rand = Math.random()
    const rarity: 'common' | 'rare' | 'epic' = rand < 0.4 ? 'common' : rand < 0.8 ? 'rare' : 'epic'
    const candidates = getPoolByRarity(rarity)
    const template = candidates[Math.floor(Math.random() * candidates.length)]
    const artifact = instantiateArtifact(template, 'Victoire contre un champion élite')

    addArtifact(artifact)

    // Auto-activer dans le premier slot libre disponible
    if (gameState.inventory.activeArtifacts.length < MAX_ACTIVE_ARTIFACTS) {
      gameState.inventory.activeArtifacts.push(artifact.id)
      saveGame()
    }

    return artifact
  }

  /** Vend un artefact et retourne l'or gagné (0 si introuvable) */
  const sellArtifact = (artifactId: string): number => {
    const artifact = gameState.inventory.artifacts.find((a) => a.id === artifactId)
    if (!artifact) return 0

    const goldGained = SELL_PRICES[artifact.rarity]

    // Désactiver si actif avant de retirer
    deactivateArtifact(artifactId)

    gameState.inventory.artifacts = gameState.inventory.artifacts.filter((a) => a.id !== artifactId)
    gameState.inventory.gold += goldGained

    saveGame()
    return goldGained
  }

  /**
   * Génère 6 artefacts aléatoires pour le Bazar depuis le catalogue centralisé.
   * Distribution : 2 communs, 2 rares, 2 épiques.
   * Ces artefacts NE SONT PAS ajoutés à l'inventaire du joueur.
   */
  const generateBazarOffer = (): Artifact[] => {
    const pick = (rarity: 'common' | 'rare' | 'epic', n: number): Artifact[] => {
      const candidates = [...getPoolByRarity(rarity)].sort(() => Math.random() - 0.5)
      const result: Artifact[] = []
      const seenNames = new Set<string>()
      for (const t of candidates) {
        if (!seenNames.has(t.name) && result.length < n) {
          seenNames.add(t.name)
          result.push(instantiateArtifact(t, 'Bazar Mystique'))
        }
      }
      return result
    }

    return [...pick('common', 2), ...pick('rare', 2), ...pick('epic', 2)]
  }

  /** Forge un artefact d'une rareté précise (coût en or géré par l'appelant) */
  const giveRandomArtifactOfRarity = (rarity: 'common' | 'rare' | 'epic'): Artifact => {
    const candidates = getPoolByRarity(rarity)
    const template = candidates[Math.floor(Math.random() * candidates.length)]
    const artifact = instantiateArtifact(template, 'Forgé à la forge')

    addArtifact(artifact)

    // Auto-activer dans le premier slot libre disponible
    if (gameState.inventory.activeArtifacts.length < MAX_ACTIVE_ARTIFACTS) {
      gameState.inventory.activeArtifacts.push(artifact.id)
      saveGame()
    }

    return artifact
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
    completeMapNode,
    handleMapNodeAction,
    giveRandomArtifact,
    giveRandomArtifactOfRarity,

    // Actions d'inventaire
    addGold,
    spendGold,
    updateLeadership,
    leadershipStatus,
    addArtifact,
    activateArtifact,
    deactivateArtifact,
    consumeArtifactUse,
    destroyDestructiblesOnCampaignLoss,
    sellArtifact,
    generateBazarOffer,

    // Points de victoire
    addVictoryPoints,
    victoryPoints,
    victoryHistory,
    completeCampaign,
    campaignObjectiveReached,
  }
}

// Export du type pour l'utilisation dans les composants
export type GameStore = ReturnType<typeof useGameStore>
