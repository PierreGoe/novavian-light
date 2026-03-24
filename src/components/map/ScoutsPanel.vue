<template>
  <section class="scouts-panel">
    <div class="scouts-panel-header">
      <h3 class="scouts-title">🔭 Éclaireurs</h3>
      <div class="scouts-available">
        <span v-for="i in 4" :key="i" class="scout-dot" :class="{ active: i <= scoutsAvailable }"
          >🧍</span
        >
        <span class="scouts-count"
          >{{ scoutsAvailable }} / 4 disponible{{ scoutsAvailable > 1 ? 's' : '' }}</span
        >
      </div>
    </div>

    <div v-if="activeScoutMissions.length > 0" class="scouts-section">
      <div class="scouts-section-label">En mission</div>
      <div class="scouts-list">
        <div
          v-for="mission in activeScoutMissions"
          :key="mission.id"
          class="scout-mission active"
        >
          <div class="scout-mission-icon">🔭</div>
          <div class="scout-mission-info">
            <span class="scout-coords">({{ mission.target.x }}, {{ mission.target.y }})</span>
            <div class="scout-progress-bar">
              <div
                class="scout-progress-fill"
                :style="{ width: getMissionProgress(mission) + '%' }"
              ></div>
            </div>
          </div>
          <div class="scout-timer">{{ formatTimeRemaining(mission.endsAt) }}</div>
        </div>
      </div>
    </div>

    <div v-if="completedScoutMissions.length > 0" class="scouts-section">
      <div class="scouts-section-label">Terminées</div>
      <div class="scouts-list">
        <div
          v-for="mission in completedScoutMissions"
          :key="mission.id"
          class="scout-mission completed"
        >
          <div class="scout-mission-icon">✅</div>
          <div class="scout-mission-info">
            <span class="scout-coords">({{ mission.target.x }}, {{ mission.target.y }})</span>
            <span class="scout-done-label">Zone découverte</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="activeScoutMissions.length === 0 && completedScoutMissions.length === 0"
      class="scouts-empty"
    >
      Cliquez sur une case inconnue pour envoyer un éclaireur
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMissionStore } from '../../stores/missionStore'

const missionStore = useMissionStore()
const currentTime = ref(Date.now())
let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => {
    currentTime.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (timer !== null) clearInterval(timer)
})

const scoutsAvailable = computed(() => missionStore.scoutsAvailable.value)
const activeScoutMissions = computed(() =>
  missionStore.getScoutMissions.value.filter((m) => m.status === 'pending'),
)
const completedScoutMissions = computed(() =>
  missionStore.getScoutMissions.value.filter((m) => m.status === 'completed'),
)

const formatTimeRemaining = (endsAt: number): string => {
  const remaining = Math.max(0, endsAt - currentTime.value)
  const seconds = Math.ceil(remaining / 1000)
  if (seconds <= 0) return 'Arrivée...'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${seconds % 60}s`
}

const getMissionProgress = (mission: { startedAt: number; endsAt: number }): number => {
  const total = mission.endsAt - mission.startedAt
  const elapsed = currentTime.value - mission.startedAt
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}
</script>

<style scoped>
.scouts-panel {
  background: rgba(15, 25, 50, 0.7);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 16px;
}

.scouts-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}

.scouts-title {
  margin: 0;
  font-size: 1rem;
  color: #93c5fd;
  font-weight: 600;
}

.scouts-available {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scout-dot {
  font-size: 1rem;
  opacity: 0.25;
  transition: opacity 0.3s ease;
}

.scout-dot.active {
  opacity: 1;
}

.scouts-count {
  font-size: 0.8rem;
  color: #93c5fd;
  margin-left: 4px;
  white-space: nowrap;
}

.scouts-section {
  margin-bottom: 12px;
}

.scouts-section-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 6px;
}

.scouts-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scout-mission {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
}

.scout-mission.active {
  border-color: rgba(100, 149, 237, 0.3);
}

.scout-mission.completed {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.05);
}

.scout-mission-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.scout-mission-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.scout-coords {
  font-size: 0.82rem;
  color: #cbd5e1;
  font-weight: 500;
}

.scout-done-label {
  font-size: 0.75rem;
  color: #4ade80;
}

.scout-progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.scout-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #93c5fd);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.scout-timer {
  font-size: 0.8rem;
  color: #93c5fd;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.scouts-empty {
  font-size: 0.82rem;
  color: #475569;
  text-align: center;
  padding: 10px 0;
  font-style: italic;
}
</style>
