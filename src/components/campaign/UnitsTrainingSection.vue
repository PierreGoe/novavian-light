<template>
  <section class="units-section">
    <div class="section-header">
      <h3>Unités Militaires</h3>
      <span class="barracks-badge">Casernes niv. {{ barrackLevel }}</span>
    </div>

    <div class="existing-units" v-if="(town?.units?.length || 0) > 0">
      <div v-for="unit in town?.units || []" :key="unit.id" class="unit-card">
        <div class="unit-icon">{{ UNIT_DEFINITIONS[unit.type].icon }}</div>
        <div class="unit-info">
          <div class="unit-name">{{ UNIT_DEFINITIONS[unit.type].name }}</div>
          <div class="unit-count">{{ unit.count }} unités</div>
          <div class="unit-stats">
            <span>⚔️ {{ unit.attack }}</span>
            <span>🛡️ {{ unit.defense }}</span>
            <span>❤️ {{ unit.health }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Cards de recrutement (1 clic = 1 unité en file) -->
    <div class="recruit-section">
      <h4>Recruter</h4>
      <div class="recruit-grid">
        <button
          v-for="def in UNIT_DEFINITIONS"
          :key="def.type"
          class="recruit-card"
          :class="{
            'recruit-card--locked': barrackLevel < def.barrackLevelRequired,
            'recruit-card--poor': !canAfford(def.type) && barrackLevel >= def.barrackLevelRequired,
          }"
          :disabled="barrackLevel < def.barrackLevelRequired || !canAfford(def.type)"
          @click="handleRecruit(def.type)"
        >
          <div class="rc-icon">{{ def.icon }}</div>
          <div class="rc-name">{{ def.name }}</div>
          <div v-if="barrackLevel < def.barrackLevelRequired" class="rc-lock">
            🔒 Casernes niv. {{ def.barrackLevelRequired }}
          </div>
          <template v-else>
            <div class="rc-costs">
              <span>🪵 {{ def.cost.wood }}</span>
              <span>🧱 {{ def.cost.clay }}</span>
              <span>⚒️ {{ def.cost.iron }}</span>
              <span>🌾 {{ def.cost.crop }}</span>
            </div>
            <div class="rc-time">⏱ {{ formatDuration(getTrainingTime(def.type, barrackLevel)) }}</div>
          </template>
        </button>
      </div>
    </div>

    <!-- File de construction -->
    <div class="queue-section">
      <h4>File de construction</h4>
      <div v-if="trainingQueue.length === 0" class="queue-empty">Aucune unité en construction</div>
      <div v-else class="queue-list">
        <!-- Entrée en cours (#1) : développée avec barre de progression -->
        <div class="queue-entry queue-entry--active">
          <span class="qe-icon">{{ UNIT_DEFINITIONS[trainingQueue[0].type].icon }}</span>
          <span class="qe-name">{{ UNIT_DEFINITIONS[trainingQueue[0].type].name }}</span>
          <div class="qe-timer">
            <div class="qe-progress-bar">
              <div class="qe-progress-fill" :style="{ width: getEntryProgress(trainingQueue[0]) + '%' }"></div>
            </div>
            <span class="qe-remaining">{{ getRemainingTime(trainingQueue[0]) }}</span>
          </div>
        </div>

        <!-- Groupes en attente (#2+) : lignes collapsées par type consécutif -->
        <div
          v-for="group in groupedWaiting"
          :key="group.firstEntry.id"
          class="queue-entry queue-entry--waiting"
        >
          <span class="qe-pos">#{{ group.startIndex }}</span>
          <span class="qe-icon">{{ UNIT_DEFINITIONS[group.type].icon }}</span>
          <span class="qe-name">{{ UNIT_DEFINITIONS[group.type].name }}</span>
          <span v-if="group.count > 1" class="qe-count">×{{ group.count }}</span>
          <span class="qe-wait">{{ getRemainingTime(group.lastEntry) }}</span>
          <button class="qe-cancel" @click="handleCancel(group.lastEntry)" title="Annuler 1 unité et récupérer les ressources">✕</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMissionStore, UNIT_DEFINITIONS, getTrainingTime } from '@/stores/missionStore'
import type { MilitaryUnit, TrainingQueueEntry } from '@/stores/missionStore'
import { useToastStore } from '@/stores/toastStore'

const missionStore = useMissionStore()
const toastStore = useToastStore()

const town = computed(() => missionStore.town.value)
const barrackLevel = computed(() => missionStore.barrackLevel.value)
const trainingQueue = computed(() => missionStore.trainingQueue.value)

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

const handleRecruit = (type: MilitaryUnit['type']) => {
  const success = missionStore.enqueueUnit(type)
  if (success) {
    toastStore.showSuccess(`${UNIT_DEFINITIONS[type].name} ajouté(e) en file !`, { duration: 1500 })
  } else {
    toastStore.showError('Ressources insuffisantes ou caserne trop basse', { duration: 2000 })
  }
}

const handleCancel = (entry: TrainingQueueEntry) => {
  const def = UNIT_DEFINITIONS[entry.type]
  if (missionStore.cancelQueueEntry(entry.id)) {
    toastStore.showSuccess(
      `${def.name} annulé(e) — ressources remboursées`,
      { duration: 2000 },
    )
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
  const remaining = Math.max(0, Math.ceil((entry.endsAt - Date.now()) / 1000))
  return formatDuration(remaining)
}

// Pourcentage de progression (0–100)
const getEntryProgress = (entry: TrainingQueueEntry): number => {
  const total = entry.endsAt - entry.startedAt
  const elapsed = Date.now() - entry.startedAt
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}
</script>

<style scoped>
.units-section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
  color: #daa520;
  font-size: 1.2rem;
}

.barracks-badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.6rem;
  background: rgba(218, 165, 32, 0.15);
  border: 1px solid rgba(218, 165, 32, 0.4);
  border-radius: 12px;
  color: #daa520;
}

/* ── Unités disponibles ── */
.existing-units {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.unit-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(220, 20, 60, 0.1);
  border: 1px solid rgba(220, 20, 60, 0.3);
  border-radius: 8px;
}

.unit-icon {
  font-size: 1.4rem;
}

.unit-info {
  flex: 1;
}

.unit-name {
  font-weight: bold;
  color: #f4e4bc;
  font-size: 0.9rem;
}

.unit-count {
  font-size: 0.85rem;
  color: #daa520;
}

.unit-stats {
  display: flex;
  gap: 0.4rem;
  font-size: 0.7rem;
  margin-top: 0.2rem;
}

/* ── Cards de recrutement ── */
.recruit-section h4,
.queue-section h4 {
  margin: 0 0 0.75rem 0;
  color: #daa520;
  font-size: 1rem;
}

.recruit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.recruit-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.85rem 0.5rem;
  background: rgba(139, 69, 19, 0.12);
  border: 1px solid rgba(218, 165, 32, 0.35);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  text-align: center;
  color: #f4e4bc;
}

.recruit-card:hover:not(:disabled) {
  background: rgba(218, 165, 32, 0.18);
  border-color: rgba(218, 165, 32, 0.7);
  transform: translateY(-2px);
}

.recruit-card:active:not(:disabled) {
  transform: translateY(0);
}

.recruit-card--locked {
  opacity: 0.45;
  cursor: not-allowed;
  border-style: dashed;
}

.recruit-card--poor {
  opacity: 0.55;
  cursor: not-allowed;
  border-color: rgba(220, 20, 60, 0.35);
}

.rc-icon {
  font-size: 1.6rem;
}

.rc-name {
  font-weight: bold;
  font-size: 0.85rem;
}

.rc-costs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
  font-size: 0.72rem;
}

.rc-costs span {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}

.rc-time {
  font-size: 0.75rem;
  color: #aaa;
}

.rc-lock {
  font-size: 0.72rem;
  color: #aaa;
}

/* ── File de construction ── */
.queue-empty {
  font-size: 0.85rem;
  color: #888;
  font-style: italic;
  padding: 0.5rem 0;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

/* Entrée en cours (#1) */
.queue-entry--active {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 0.75rem;
  background: rgba(218, 165, 32, 0.08);
  border: 1px solid rgba(218, 165, 32, 0.4);
  border-radius: 8px;
}

.queue-entry--active .qe-icon {
  font-size: 1.2rem;
}

.queue-entry--active .qe-name {
  font-size: 0.88rem;
  color: #f4e4bc;
  min-width: 110px;
}

/* Entrées en attente (#2+) : compactes */
.queue-entry--waiting {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 6px;
  font-size: 0.8rem;
  color: #aaa;
}

.qe-pos {
  font-size: 0.68rem;
  color: #666;
  min-width: 22px;
}

.queue-entry--waiting .qe-icon {
  font-size: 0.95rem;
}

.queue-entry--waiting .qe-name {
  flex: 1;
  color: #c8b89a;
}

.qe-count {
  font-size: 0.75rem;
  font-weight: bold;
  color: #daa520;
  background: rgba(218, 165, 32, 0.12);
  border: 1px solid rgba(218, 165, 32, 0.3);
  border-radius: 10px;
  padding: 0.05rem 0.4rem;
}

.qe-wait {
  color: #888;
  font-size: 0.75rem;
}

.qe-cancel {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s, background 0.15s;
}

.qe-cancel:hover {
  color: #dc143c;
  background: rgba(220, 20, 60, 0.12);
}

/* Barre de progression partagée */
.qe-timer {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.qe-progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.qe-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #daa520, #f4e4bc);
  border-radius: 3px;
  transition: width 1s linear;
}

.qe-remaining {
  font-size: 0.75rem;
  color: #aaa;
  min-width: 50px;
  text-align: right;
}
</style>
