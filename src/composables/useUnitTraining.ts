import { computed } from 'vue'
import { useMissionStore, UNIT_DEFINITIONS, getUnitDefinitionsForRace } from '@/stores/missionStore'
import type { MilitaryUnit, TrainingQueueEntry } from '@/stores/missionStore'
import { useGameStore } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'
import { useExplorationTicker } from '@/composables/useExplorationTicker'

/**
 * Logique de recrutement de la Caserne, extraite de l'ancien
 * UnitsTrainingSection.vue pour être partagée par BarracksCard.vue sans
 * dupliquer le code (montée directement dans la grille Bento du village).
 */
export function useUnitTraining() {
  const missionStore = useMissionStore()
  const gameStore = useGameStore()
  const toastStore = useToastStore()
  // Horloge partagée du ticker : lire `now.value` (et non Date.now()) dans les helpers
  // appelés depuis les templates crée une vraie dépendance réactive — avant, les timers
  // ne se rafraîchissaient que par effet de bord du tick ressources de missionStore.
  const { now } = useExplorationTicker()

  const barrackLevel = computed(() => missionStore.barrackLevel.value)
  const trainingQueue = computed(() => missionStore.trainingQueue.value)
  const garrison = computed(() => missionStore.town.value?.units ?? [])

  /** Les 4 unités entraînables par la race du joueur (fallback générique si pas encore choisie). */
  const unitDefinitionsForRace = computed(() => {
    const raceId = gameStore.gameState.race?.id
    const raceUnits = raceId ? getUnitDefinitionsForRace(raceId) : []
    return raceUnits.length > 0
      ? raceUnits
      : [UNIT_DEFINITIONS.infantry, UNIT_DEFINITIONS.archer, UNIT_DEFINITIONS.cavalry, UNIT_DEFINITIONS.siege]
  })

  // Regroupe les entrées en attente (#2+) par type consécutif
  interface QueueGroup {
    type: MilitaryUnit['type']
    count: number
    startIndex: number // position d'affichage (#2, #3…)
    firstEntry: TrainingQueueEntry
    lastEntry: TrainingQueueEntry
  }

  const groupedWaiting = computed((): QueueGroup[] => {
    const waiting = trainingQueue.value.slice(1)
    const groups: QueueGroup[] = []
    let posInFull = 2 // position dans la file complète (#1 est l'active)

    for (let i = 0; i < waiting.length; ) {
      const type = waiting[i].type
      let j = i + 1
      while (j < waiting.length && waiting[j].type === type) j++
      groups.push({
        type,
        count: j - i,
        startIndex: posInFull,
        firstEntry: waiting[i],
        lastEntry: waiting[j - 1],
      })
      posInFull += j - i
      i = j
    }
    return groups
  })

  // Vérifie si les ressources actuelles permettent d'entraîner une unité
  const canAfford = (type: MilitaryUnit['type']): boolean => {
    const res = missionStore.displayResources.value
    const cost = UNIT_DEFINITIONS[type].cost
    return (
      res.wood >= cost.wood &&
      res.clay >= cost.clay &&
      res.iron >= cost.iron &&
      res.crop >= cost.crop
    )
  }

  /** Vérifie si les ressources actuelles permettent d'entraîner `qty` unités d'un coup */
  const canAffordBatch = (type: MilitaryUnit['type'], qty: number): boolean => {
    const res = missionStore.displayResources.value
    const cost = UNIT_DEFINITIONS[type].cost
    return (
      res.wood >= cost.wood * qty &&
      res.clay >= cost.clay * qty &&
      res.iron >= cost.iron * qty &&
      res.crop >= cost.crop * qty
    )
  }

  const handleRecruit = (type: MilitaryUnit['type'], qty = 1) => {
    let queued = 0
    for (let i = 0; i < qty; i++) {
      if (!missionStore.enqueueUnit(type)) break
      queued++
    }

    const name = UNIT_DEFINITIONS[type].name
    if (queued === qty) {
      toastStore.showSuccess(
        queued > 1 ? `${queued}x ${name} ajoutées en file !` : `${name} ajouté(e) en file !`,
        { duration: 1500 },
      )
    } else if (queued > 0) {
      toastStore.showInfo(
        `${queued}/${qty} ${name} ajoutées — ressources insuffisantes pour le reste`,
        { duration: 2500 },
      )
    } else {
      toastStore.showError('Ressources insuffisantes ou caserne trop basse', { duration: 2000 })
    }
  }

  const handleCancel = (entry: TrainingQueueEntry) => {
    const def = UNIT_DEFINITIONS[entry.type]
    if (missionStore.cancelQueueEntry(entry.id)) {
      toastStore.showSuccess(`${def.name} annulé(e) — ressources remboursées`, { duration: 2000 })
    }
  }

  // Formate une durée en secondes en "Xm Ys" ou "Xs"
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }

  // Temps restant pour une entrée de file
  const getRemainingTime = (entry: TrainingQueueEntry): string => {
    const remaining = Math.max(0, Math.ceil((entry.endsAt - now.value) / 1000))
    return formatDuration(remaining)
  }

  // Pourcentage de progression (0–100)
  const getEntryProgress = (entry: TrainingQueueEntry): number => {
    const total = entry.endsAt - entry.startedAt
    const elapsed = now.value - entry.startedAt
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
  }

  return {
    barrackLevel,
    trainingQueue,
    garrison,
    unitDefinitionsForRace,
    groupedWaiting,
    canAfford,
    canAffordBatch,
    handleRecruit,
    handleCancel,
    formatDuration,
    getRemainingTime,
    getEntryProgress,
  }
}
