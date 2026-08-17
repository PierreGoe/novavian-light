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

    <!-- Casernes absentes : section verrouillée -->
    <div v-if="barrackLevel === 0" class="barracks-locked">
      <span class="barracks-locked__icon">🔒</span>
      <p class="barracks-locked__title">Casernes requises</p>
      <p class="barracks-locked__hint">
        Construisez des Casernes dans l'onglet Village pour débloquer le recrutement.
      </p>
    </div>

    <template v-else>
      <!-- Cards de recrutement (1 clic = 1 unité en file) -->
      <div class="recruit-section">
        <h4>Recruter</h4>
        <div class="recruit-grid">
          <div
            v-for="def in UNIT_DEFINITIONS"
            :key="def.type"
            class="recruit-card"
            :class="{
              'recruit-card--locked': barrackLevel < def.barrackLevelRequired,
              'recruit-card--poor':
                !canAfford(def.type) && barrackLevel >= def.barrackLevelRequired,
            }"
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
              <div class="rc-time">
                ⏱ {{ formatDuration(getTrainingTime(def.type, barrackLevel)) }}
              </div>
              <div class="rc-qty-actions">
                <button
                  v-for="qty in [1, 5, 10]"
                  :key="qty"
                  class="rc-qty-btn"
                  :disabled="!canAffordBatch(def.type, qty)"
                  @click="handleRecruit(def.type, qty)"
                >
                  +{{ qty }}
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- File de construction -->
      <div class="queue-section">
        <h4>File de construction</h4>
        <div v-if="trainingQueue.length === 0" class="queue-empty">
          Aucune unité en construction
        </div>
        <div v-else class="queue-clocks">
          <!-- Entrée en cours (#1) : grand chronomètre circulaire -->
          <div class="clock-item clock-item--active">
            <TimerClock
              :size="64"
              :progress="getEntryProgress(trainingQueue[0]) / 100"
              :icon="UNIT_DEFINITIONS[trainingQueue[0].type].icon"
            >
              <span class="clock-time">{{ getRemainingTime(trainingQueue[0]) }}</span>
            </TimerClock>
            <div class="clock-name">{{ UNIT_DEFINITIONS[trainingQueue[0].type].name }}</div>
            <button
              class="clock-cancel"
              @click="handleCancel(trainingQueue[0])"
              title="Annuler 1 unité et récupérer les ressources"
            >
              ✕
            </button>
          </div>

          <!-- Groupes en attente (#2+) : petits chronos -->
          <div
            v-for="group in groupedWaiting"
            :key="group.firstEntry.id"
            class="clock-item clock-item--waiting"
          >
            <TimerClock
              :size="46"
              dashed
              :icon="UNIT_DEFINITIONS[group.type].icon"
              :count-badge="group.count"
            />
            <div class="clock-name">{{ getRemainingTime(group.lastEntry) }}</div>
            <button
              class="clock-cancel"
              @click="handleCancel(group.lastEntry)"
              title="Annuler 1 unité et récupérer les ressources"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMissionStore, UNIT_DEFINITIONS, getTrainingTime } from '@/stores/missionStore'
import type { MilitaryUnit, TrainingQueueEntry } from '@/stores/missionStore'
import { useToastStore } from '@/stores/toastStore'
import TimerClock from '@/components/ui/TimerClock.vue'

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
    res.wood >= cost.wood && res.clay >= cost.clay && res.iron >= cost.iron && res.crop >= cost.crop
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
    toastStore.showInfo(`${queued}/${qty} ${name} ajoutées — ressources insuffisantes pour le reste`, {
      duration: 2500,
    })
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
.barracks-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  text-align: center;
  border: 1px dashed rgba(218, 165, 32, 0.3);
  border-radius: 8px;
  color: #888;
}

.barracks-locked__icon {
  font-size: 2rem;
}

.barracks-locked__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #aaa;
}

.barracks-locked__hint {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
}

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
  transition: border-color 0.15s;
  text-align: center;
  color: #f4e4bc;
}

.rc-qty-actions {
  display: flex;
  gap: 0.3rem;
  margin-top: 0.3rem;
}

.rc-qty-btn {
  flex: 1;
  padding: 0.3rem 0;
  background: rgba(218, 165, 32, 0.12);
  border: 1px solid rgba(218, 165, 32, 0.4);
  border-radius: 6px;
  color: #f4e4bc;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    transform 0.1s;
}

.rc-qty-btn:hover:not(:disabled) {
  background: rgba(218, 165, 32, 0.25);
  border-color: rgba(218, 165, 32, 0.8);
  transform: translateY(-1px);
}

.rc-qty-btn:active:not(:disabled) {
  transform: translateY(0);
}

.rc-qty-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
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

/* Rangée horizontale de chronomètres */
.queue-clocks {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem;
}

/* Conteneur d'un chronomètre (actif ou en attente) */
.clock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  position: relative;
}

.clock-item--active .clock-time {
  font-size: 0.62rem;
  color: #f4e4bc;
  font-weight: bold;
  white-space: nowrap;
}

.clock-item--active .clock-name {
  font-size: 0.72rem;
  color: #daa520;
  text-align: center;
  max-width: 70px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clock-item--waiting .clock-name {
  font-size: 0.65rem;
  color: #888;
  text-align: center;
  white-space: nowrap;
}

/* Bouton d'annulation flottant */
.clock-cancel {
  position: absolute;
  top: -5px;
  left: -5px;
  background: rgba(30, 15, 5, 0.85);
  border: 1px solid rgba(220, 20, 60, 0.35);
  color: #666;
  cursor: pointer;
  font-size: 0.6rem;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
}

.clock-cancel:hover {
  color: #dc143c;
  border-color: #dc143c;
  background: rgba(220, 20, 60, 0.15);
}
</style>
