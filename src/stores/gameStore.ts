/* eslint-disable @typescript-eslint/no-explicit-any */
import { reactive, computed } from 'vue'
import { generateMap } from '@/utils'
import { debounce } from '@/utils/debounce'
import router from '@/router'
import { useMissionStore } from '@/stores/missionStore'
import type { MilitaryUnit } from '@/stores/missionStore'
import { useMapStore } from '@/stores/mapStore'
import {
  HOSTILITY_REDUCE_RAID_REPELLED,
  FATIGUE_GAIN_RAID_REPELLED,
  FATIGUE_GAIN_COSTLY_VICTORY_MAX,
  FATIGUE_POWER_MALUS_DIVISOR,
} from '@/stores/mapStore'
import { getWallDefenseMultiplier } from '@/data/buildings'
import { useToastStore } from '@/stores/toastStore'
import type { CombatUnit, SavedBattleReport } from '@/combat/types'
import { resolveRaidFast, buildRaidReport } from '@/combat/raidResolver'
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
}

/** Type de durabilité d'un artefact */
export type ArtifactDurability = 'single-use' | 'uses-limited' | 'permanent'

/** Types de pouvoirs spéciaux uniques */
export type SpecialPowerType =
  | 'fog_reveal_on_victory' // révèle des cases autour après victoire
  | 'gold_on_victory' // bonus d'or par victoire de combat
  | 'leadership_on_victory' // bonus de leadership par victoire
  | 'first_strike' // attaque en premier au combat
  | 'siege_bonus' // bonus aux sièges de villes
  | 'healing_after_combat' // soins partiels après chaque combat
  | 'starting_garrison_bonus' // soldats supplémentaires dans la garnison de départ

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
      crop?: number
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
  /** Fragments de carte permettant de déverrouiller un nouveau cadran 20x20 */
  mapFragments: number
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
  /** Décalage horizontal (fraction du slot) calculé une fois à la génération — cf. mapGenerator.ts */
  jitterX?: number
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
export const COMBAT_VP_GOAL = 12

/**
 * Plafond de PV pouvant être accumulés via les destructions de villages ennemis.
 * Au-delà, le bonus +2 PV de destruction n'est plus accordé.
 */
export const VILLAGE_VP_CAP = 4

/**
 * Plafond de PV pouvant être accumulés via les victoires de combat simples (+1 PV).
 * Au-delà, les victoires ne rapportent plus de PV — le joueur doit détruire
 * des forteresses ou compléter des missions pour progresser.
 */
export const COMBAT_VICTORY_VP_CAP = 4

export interface VictoryPoints {
  combat: number
  /** PV cumulés depuis les destructions de villages (plafonné à VILLAGE_VP_CAP) */
  villageVp: number
  /** PV cumulés depuis les victoires simples (+1 PV, plafonné à COMBAT_VICTORY_VP_CAP) */
  combatVictoryVp: number
}

/** Un événement qui a rapporté des PV (pour l'historique) */
export interface VictoryEvent {
  id: string
  type: VictoryPointType
  amount: number
  reason: string
  date: string
  /** Tuile à l'origine du gain (optionnel — absent des anciens saves) */
  tileId?: string
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
    mapFragments: 50, // Le joueur commence avec 50 fragments de carte
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
    villageVp: 0,
    combatVictoryVp: 0,
  },
  victoryHistory: [],
})

// Store réactif avec clone profond
const gameState = reactive<GameState>(createInitialState())
// Actions du store
export const useGameStore = () => {
  // Getters (computed)
  const hasSavedGame = computed(() => {
    const savedGame = localStorage.getItem('novavian-save')
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

    // Réinitialiser l'état de mission (ville, unités) maintenant que la race est connue,
    // pour que l'unité d'infanterie de départ soit bien celle de la race choisie
    // (voir createStartingUnits dans missionStore.ts) plutôt que l'infanterie générique.
    useMissionStore().resetMissionState()

    // Sauvegarder immédiatement (pas de debounce) : la navigation qui suit
    // déclenche un loadGame() synchrone (ex: MissionTree.onMounted) qui doit
    // retrouver la race tout juste sélectionnée en localStorage.
    writeGame()
  }

  const loadGame = () => {
    const savedGame = localStorage.getItem('novavian-save')

    if (!savedGame) return router.push('/')
    if (savedGame) {
      // Si game over, afficher une notification au lieu de rediriger directement
      if (gameState.currentStatus === 'game-over') {
        const toastStore = useToastStore()
        toastStore.showError('💀 Game Over — Votre leadership est tombé à zéro.', {
          persistent: true,
          onClick: () => {
            router.push('/game-over')
          },
        })
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
          gameState.inventory.mapFragments = gameData.inventory.mapFragments ?? 0 // Migration anciens saves
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
          // Migration : champs absents des anciens saves
          gameState.victoryPoints.villageVp = gameData.victoryPoints.villageVp ?? 0
          gameState.victoryPoints.combatVictoryVp = gameData.victoryPoints.combatVictoryVp ?? 0
        }
        if (gameData.victoryHistory) {
          gameState.victoryHistory = gameData.victoryHistory
        }

        // Calculer les zones d'influence des forteresses après chargement de la carte
        const mapStore = useMapStore()
        if (mapStore.mapState.mapTiles.length > 0) {
          mapStore.computeFortressZones()
        }

        return true
      } catch (error) {
        console.error('Error loading game:', error)
        return false
      }
    }
    return false
  }

  // saveGame() est appelée depuis une trentaine de points du store (chaque gain d'or,
  // de PV, de leadership...) ; on debounce l'écriture réelle pour éviter d'empiler des
  // JSON.stringify synchrones quand plusieurs mutations arrivent coup sur coup.
  const writeGame = () => {
    try {
      const gameData = {
        currentStatus: gameState.currentStatus,
        race: gameState.race,
        inventory: {
          gold: gameState.inventory.gold,
          leadership: gameState.inventory.leadership,
          artifacts: [...gameState.inventory.artifacts],
          activeArtifacts: [...gameState.inventory.activeArtifacts],
          mapFragments: gameState.inventory.mapFragments,
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

      localStorage.setItem('novavian-save', JSON.stringify(gameData))
    } catch (error) {
      console.error('Error saving game:', error)
    }
  }

  const debouncedWriteGame = debounce(writeGame, 400)

  const saveGame = () => debouncedWriteGame()

  /** Force l'écriture immédiate d'une sauvegarde en attente (fermeture/masquage de l'onglet). */
  const flushGame = () => debouncedWriteGame.flush()

  // Reset complet - le joueur doit resélectionner une race
  const resetGameCompletely = () => {
    Object.assign(gameState, createInitialState())
    localStorage.removeItem('novavian-save')
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

    // Réinitialiser les stores de mission et de carte d'exploration
    const missionStore = useMissionStore()
    missionStore.resetMissionState()

    const mapStore = useMapStore()
    mapStore.resetMapState()

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

  // ====================================================================
  // RAIDS EVENT-DRIVEN — setTimeout unique au lieu d'un setInterval
  // Le decay d'hostilité est calculé en lazy (pas de timer).
  // Un unique setTimeout est calé sur la prochaine attaque hostile.
  // Auto-save toutes les 60s via un setInterval léger séparé.
  // ====================================================================

  let raidTimeout: number | null = null
  let autoSaveInterval: number | null = null
  const AUTO_SAVE_INTERVAL_MS = 60_000 // Auto-save toutes les 60s

  const startAutoSave = () => {
    startGameTick()
  }

  const stopAutoSave = () => {
    stopGameTick()
  }

  /** Planifie le prochain raid via un unique setTimeout. */
  const scheduleNextRaid = (): void => {
    if (raidTimeout) {
      clearTimeout(raidTimeout)
      raidTimeout = null
    }
    if (gameState.currentStatus !== 'in-progress') return

    const mapStore = useMapStore()
    // Appliquer le lazy decay avant de calculer le prochain raid
    mapStore.applyLazyDecay()
    // Pression du temps : les zones trop développées deviennent hostiles d'elles-mêmes
    mapStore.applyConquerorPressure()

    const nextTs = mapStore.getNextRaidTimestamp()
    if (!nextTs) return // Aucune zone hostile

    const delay = Math.max(100, nextTs - Date.now())
    raidTimeout = window.setTimeout(() => {
      raidTimeout = null
      executeRaids()
      // Replanifier pour la prochaine attaque
      scheduleNextRaid()
    }, delay)
  }

  /**
   * Ouvre un rapport de combat depuis un toast, quelle que soit la page courante.
   * L'overlay de rapport n'est monté que sous /campaign/* (watcher de
   * pendingReportToOpen enregistré par useExplorationTicker.start) : hors de ces
   * pages, on bascule vers l'historique des rapports pour ne pas laisser un clic mort.
   */
  const openReportFromToast = (savedReport: SavedBattleReport): void => {
    if (router.currentRoute.value.path.startsWith('/campaign')) {
      useMissionStore().requestOpenReport(savedReport)
    } else {
      router.push({ name: 'reports' })
    }
  }

  /** Exécute tous les raids dont l'heure est passée. */
  const executeRaids = (): void => {
    if (gameState.currentStatus !== 'in-progress') return
    const mapStore = useMapStore()
    const missionStore = useMissionStore()
    const toastStore = useToastStore()

    // Appliquer le lazy decay
    mapStore.applyLazyDecay()

    const triggered = mapStore.processHostileAttacks()
    for (const zone of triggered) {
      const fortress = mapStore.getTileById(zone.fortressTileId)
      const loc = fortress ? `(${fortress.position.x},${fortress.position.y})` : ''

      // Puissance du raid proportionnelle au développement réel de la zone
      // (pression du temps) — équivaut à l'ancien zone.power*4 à pression neutre.
      // Une zone fatiguée (raids repoussés récemment) frappe moins fort (−50 % max).
      const fatigueMalus =
        1 - mapStore.getEffectiveFatigue(zone.fortressTileId) / FATIGUE_POWER_MALUS_DIVISOR
      const raidPower = Math.max(
        3,
        Math.round(mapStore.getZoneDevelopment(zone) * 4 * fatigueMalus),
      )
      const raidUnits: CombatUnit[] = [
        { type: 'infantry', count: raidPower, attack: 35, defense: 30, health: 90 },
        { type: 'cavalry', count: Math.floor(raidPower / 3), attack: 80, defense: 40, health: 120 },
      ]
      // Troupes disponibles en ville (pas en mission)
      const townUnits = missionStore.missionState.town.units
      const activeMovements = mapStore.mapState.activeMovements
      const unitsOnMission: Record<string, number> = {}
      for (const movement of activeMovements) {
        for (const u of movement.units) {
          unitsOnMission[u.type] = (unitsOnMission[u.type] ?? 0) + u.count
        }
      }

      // Bonus de défense du mur d'enceinte, appliqué aux stats des défenseurs
      const wallMultiplier = getWallDefenseMultiplier(missionStore.missionState.town.buildings)

      const availableUnits: CombatUnit[] = townUnits
        .map((u) => ({
          type: u.type,
          count: Math.max(0, u.count - (unitsOnMission[u.type] ?? 0)),
          attack: u.attack,
          defense: Math.round(u.defense * wallMultiplier),
          health: u.health,
        }))
        .filter((u) => u.count > 0)

      const totalDefenders = availableUnits.reduce((s, u) => s + u.count, 0)

      if (totalDefenders === 0) {
        // Aucune troupe — pillage direct
        const loot = mapStore.computeHostileRaid(zone)
        missionStore.spendResources(loot)
        const total = loot.wood + loot.clay + loot.iron + loot.crop
        // Rapport minimal « pillage sans défense » : sans lui, le détail du
        // pillage était perdu dès la disparition du toast (aucune trace en historique).
        const undefendedReport: SavedBattleReport = {
          attackerVictory: true,
          attacker: {
            army: { label: `Raid — Forteresse ${loc}`, units: raidUnits, modifiers: [] },
            losses: { killed: {}, survivors: raidUnits },
            totalPowerUsed: raidUnits.reduce((s, u) => s + u.attack * u.count, 0),
          },
          defender: {
            army: { label: 'Défense de la ville', units: [], modifiers: [] },
            losses: { killed: {}, survivors: [] },
            totalPowerUsed: 0,
          },
          summary: `Pillage sans défense. La forteresse ${loc} a pillé ${total} ressources (🪵${loot.wood} 🧱${loot.clay} ⚒️${loot.iron} 🌾${loot.crop}) — aucune troupe ne défendait la ville.`,
          extra: { loot },
          id: `raid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          gameTimestamp: Date.now(),
          tileId: zone.fortressTileId,
          tileName: `Forteresse ${loc}`,
          date: new Date().toISOString(),
          read: false,
          playerIsDefender: true,
        }
        missionStore.addBattleReport(undefendedReport)

        toastStore.showError(
          `⚔️ Raid ennemi ! La forteresse ${loc} a pillé ${total} ressources — aucune troupe pour défendre ! Cliquez pour voir le rapport.`,
          {
            duration: 12000,
            onClick: () => {
              openReportFromToast(undefendedReport)
            },
          },
        )
        // L'hostilité retombe après le raid, qu'il ait été défendu ou non
        mapStore.reduceHostility(zone.fortressTileId, HOSTILITY_REDUCE_RAID_REPELLED)
        continue
      }

      // Résolution rapide via raidResolver
      const result = resolveRaidFast(raidUnits, availableUnits)

      // Construire le rapport (une seule allocation, seulement au moment du raid)
      const report = buildRaidReport(
        result,
        `Raid — Forteresse ${loc}`,
        raidUnits,
        availableUnits,
      )

      // Appliquer les pertes aux troupes en ville
      for (const [unitType, killed] of Object.entries(report.defender.losses.killed)) {
        missionStore.removeUnits(unitType as MilitaryUnit['type'], killed)
      }

      // Sauvegarder le rapport
      const savedReport: SavedBattleReport = {
        ...report,
        id: `raid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gameTimestamp: Date.now(),
        tileId: zone.fortressTileId,
        tileName: `Forteresse ${loc}`,
        date: new Date().toISOString(),
        read: false,
        playerIsDefender: true,
      }
      missionStore.addBattleReport(savedReport)

      if (report.attackerVictory) {
        // Défense échouée — mais une victoire coûteuse fatigue quand même la zone
        mapStore.addZoneFatigue(
          zone.fortressTileId,
          Math.round(result.attackerLossRatio * FATIGUE_GAIN_COSTLY_VICTORY_MAX),
        )
        const loot = mapStore.computeHostileRaid(zone)
        missionStore.spendResources(loot)
        const total = loot.wood + loot.clay + loot.iron + loot.crop
        const defLost = Object.values(report.defender.losses.killed).reduce((s, v) => s + v, 0)
        toastStore.showError(
          `⚔️ Défense échouée ! La forteresse ${loc} a pillé ${total} ressources (−${defLost} troupes perdues). Cliquez pour voir le rapport.`,
          {
            duration: 12000,
            onClick: () => {
              openReportFromToast(savedReport)
            },
          },
        )
        // L'hostilité retombe après le raid, qu'il ait été défendu ou non
        mapStore.reduceHostility(zone.fortressTileId, HOSTILITY_REDUCE_RAID_REPELLED)
      } else {
        // Défense réussie — réduction de l'hostilité + fatigue militaire de la zone :
        // repousser les raids épuise l'assaillant, qui devient incapable d'attaquer sans cesse
        mapStore.reduceHostility(zone.fortressTileId, HOSTILITY_REDUCE_RAID_REPELLED)
        mapStore.addZoneFatigue(zone.fortressTileId, FATIGUE_GAIN_RAID_REPELLED)
        const exhausted = mapStore.isZoneExhausted(zone.fortressTileId)
        const atkLost = Object.values(report.attacker.losses.killed).reduce((s, v) => s + v, 0)
        const defLost = Object.values(report.defender.losses.killed).reduce((s, v) => s + v, 0)
        toastStore.showSuccess(
          `🛡️ Raid repoussé ! La forteresse ${loc} a été repoussée (${atkLost} ennemis tués, −${defLost} défenseurs perdus).` +
            (exhausted ? ' 😮‍💨 La zone est épuisée et doit reprendre son souffle.' : '') +
            ' Cliquez pour voir le rapport.',
          {
            duration: 10000,
            onClick: () => {
              openReportFromToast(savedReport)
            },
          },
        )
      }
    }

    // Sauvegarder après tous les raids
    if (triggered.length > 0) {
      saveGame()
      mapStore.saveMapState()
      missionStore.saveMissionState()
    }
  }

  /** Démarre les timers (auto-save + planification raids). */
  const startGameTick = () => {
    // Auto-save léger toutes les 60s + réévaluation de la pression du temps
    // (une zone peut franchir un seuil de développement sans aucune action du
    // joueur — sans cette replanification périodique, aucun raid ne partirait)
    if (!autoSaveInterval) {
      autoSaveInterval = window.setInterval(() => {
        if (gameState.currentStatus !== 'in-progress') return
        saveGame()
        scheduleNextRaid()
      }, AUTO_SAVE_INTERVAL_MS)
    }
    // Planifier le prochain raid
    scheduleNextRaid()
  }

  /** Arrête tous les timers. */
  const stopGameTick = () => {
    if (raidTimeout) {
      clearTimeout(raidTimeout)
      raidTimeout = null
    }
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval)
      autoSaveInterval = null
    }
  }

  /** @deprecated Alias pour rétrocompatibilité */
  const startHostilityTimer = () => startGameTick()
  /** @deprecated Alias pour rétrocompatibilité */
  const stopHostilityTimer = () => stopGameTick()

  // Fonctions d'inventaire
  const addGold = (amount: number) => {
    gameState.inventory.gold += amount
    saveGame()
  }

  // ====== FRAGMENTS DE CARTE ======

  /** Consomme 1 fragment pour déverrouiller le cadran donné. Retourne false si aucun fragment disponible. */
  const useMapFragment = (chunkId: string): boolean => {
    if (gameState.inventory.mapFragments <= 0) return false
    const mapStore = useMapStore()
    const unlocked = mapStore.unlockChunk(chunkId)
    if (unlocked) {
      gameState.inventory.mapFragments--
      saveGame()
    }
    return unlocked
  }

  /** Ajoute des fragments de carte à l’inventaire du joueur. */
  const addMapFragment = (count: number = 1) => {
    gameState.inventory.mapFragments += count
    saveGame()
  }

  // ====== POINTS DE VICTOIRE ======

  const addVictoryPoints = (
    type: VictoryPointType,
    amount: number,
    reason: string,
    tileId?: string,
  ) => {
    const wasReached = gameState.victoryPoints[type] >= COMBAT_VP_GOAL
    gameState.victoryPoints[type] += amount
    gameState.victoryHistory.unshift({
      id: `vp-${Date.now()}`,
      type,
      amount,
      reason,
      date: new Date().toISOString(),
      tileId,
    })
    // Garder seulement les 100 derniers événements
    if (gameState.victoryHistory.length > 100) {
      gameState.victoryHistory.length = 100
    }
    saveGame()

    // Notification au moment où l'objectif de campagne est atteint
    if (!wasReached && gameState.victoryPoints[type] >= COMBAT_VP_GOAL) {
      const toastStore = useToastStore()
      toastStore.showSuccess(
        '🏆 Objectif de campagne atteint ! Cliquez pour valider la victoire.',
        {
          persistent: true,
          onClick: () => {
            router.push('/campaign-score')
          },
        },
      )
    }
  }

  const victoryPoints = computed(() => gameState.victoryPoints)
  const victoryHistory = computed(() => gameState.victoryHistory)

  /**
   * Ajoute des PV issus d'une victoire de combat simple (+1 PV), dans la limite
   * de COMBAT_VICTORY_VP_CAP. Au-delà du cap, la victoire ne rapporte plus de PV.
   */
  const addCombatVictoryVp = (reason: string, tileId?: string) => {
    const spaceLeft = Math.max(0, COMBAT_VICTORY_VP_CAP - gameState.victoryPoints.combatVictoryVp)
    if (spaceLeft <= 0) return
    gameState.victoryPoints.combatVictoryVp += 1
    addVictoryPoints('combat', 1, reason, tileId)
  }

  /**
   * Ajoute des PV issus d'une destruction de village, dans la limite de VILLAGE_VP_CAP.
   * Une fois le plafond atteint, les destructions de villages ne rapportent plus de PV.
   */
  const addVillageVp = (amount: number, reason: string, tileId?: string) => {
    const spaceLeft = Math.max(0, VILLAGE_VP_CAP - gameState.victoryPoints.villageVp)
    const actual = Math.min(amount, spaceLeft)
    if (actual <= 0) return
    gameState.victoryPoints.villageVp += actual
    addVictoryPoints('combat', actual, reason, tileId)
  }

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

    // Distribuer la récompense spécifique au node (or pour combat, relique pour élite)
    let nodeRewardArtifact: Artifact | null = null
    let nodeRewardGold = 0
    if (gameState.mapState.selectedNodeId) {
      const allNodes: MapNode[] = []
      gameState.mapState.layers.forEach((layer) => allNodes.push(...layer.nodes))
      const currentNode = allNodes.find((n) => n.id === gameState.mapState.selectedNodeId)

      if (currentNode?.reward) {
        if (currentNode.reward.type === 'gold' && currentNode.reward.amount) {
          nodeRewardGold = currentNode.reward.amount
          addGold(nodeRewardGold)
        } else if (currentNode.reward.type === 'relic') {
          const rarity = currentNode.type === 'elite' ? 'rare' : 'common'
          const artifact = giveRandomArtifactOfRarity(rarity)
          artifact.obtainedFrom =
            currentNode.type === 'elite'
              ? 'Victoire contre un champion élite'
              : 'Victoire au combat'
          nodeRewardArtifact = artifact
          saveGame()
        }
      }
    }

    // Marquer le node courant comme complété (si en mission)
    if (gameState.mapState.selectedNodeId) {
      completeMapNode(gameState.mapState.selectedNodeId)
    }

    // Réinitialiser l'état de mission (ressources, ville, unités)
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
    return { nodeRewardArtifact, nodeRewardGold }
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
    gameState.gameOverReason = 'Votre leadership est tombé à zéro'
    saveGame()

    // Afficher une notification persistante — redirection seulement au clic
    const toastStore = useToastStore()
    toastStore.showError('💀 Game Over — Votre leadership est tombé à zéro.', {
      persistent: true,
      onClick: () => {
        router.push('/game-over')
      },
    })
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
        crop: 0,
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
        effects.resourceBonus.crop += artifact.effects.resourceBonus.crop || 0
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
          toastStore.showSuccess(
            `${node.title} - Bravo! Vous avez terminé cette carte! Générez-en une nouvelle pour continuer.`,
            { duration: 7000 },
          )
        }
        // Compléter immédiatement le node (pas de mission)
        completeMapNode(node.id)
        gameState.currentGameSection = 'completed-map'
        saveGame()
        // Reste sur l'arbre de mission — plus de route "/game/victory" (inexistante, menait
        // à une impasse). Le joueur relance une carte via le bouton "New Map" déjà en place.
        if (router) {
          setTimeout(() => {
            router.push('/mission-tree')
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

  /**
   * Génère un artefact de remplacement de même rareté pour le Bazar, après l'achat
   * d'une des 6 offres — évite de reproposer un nom déjà présent dans l'offre courante.
   * Retourne null si le pool de cette rareté est épuisé (aucun nom disponible restant).
   */
  const generateBazarReplacement = (
    rarity: 'common' | 'rare' | 'epic',
    excludeNames: string[],
  ): Artifact | null => {
    const candidates = getPoolByRarity(rarity).filter((t) => !excludeNames.includes(t.name))
    if (candidates.length === 0) return null
    const template = candidates[Math.floor(Math.random() * candidates.length)]
    return instantiateArtifact(template, 'Bazar Mystique')
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
    flushGame,
    resetGameCompletely,
    resetMapOnly,
    startAutoSave,
    stopAutoSave,
    startHostilityTimer,
    stopHostilityTimer,
    scheduleNextRaid,

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

    // Fragments de carte
    useMapFragment,
    addMapFragment,

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
    generateBazarReplacement,

    // Points de victoire
    addVictoryPoints,
    addCombatVictoryVp,
    addVillageVp,
    victoryPoints,
    victoryHistory,
    completeCampaign,
    campaignObjectiveReached,
  }
}

// Export du type pour l'utilisation dans les composants
export type GameStore = ReturnType<typeof useGameStore>
