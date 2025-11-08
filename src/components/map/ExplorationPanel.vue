<template>
  <div class="exploration-controls">
    <div class="exploration-header">
      <h3>🧭 Exploration</h3>
      <div class="exploration-points">
        <span class="points-label">Points d'exploration :</span>
        <div class="points-display">
          <span
            v-for="i in maxPoints"
            :key="i"
            class="point-dot"
            :class="{ 'point-active': i <= currentPoints }"
          >
            ⭐
          </span>
        </div>
      </div>
    </div>

    <div class="exploration-actions">
      <button class="btn-explore" :disabled="!canExplore" @click="handleExplore">
        🔍 Explorer une zone adjacente
      </button>

      <button
        class="btn-scout"
        :disabled="!selectedTile || !selectedTile.explored"
        @click="handleScout"
      >
        🔎 Reconnaître la zone sélectionnée
      </button>
    </div>

    <!-- Résultats de l'exploration -->
    <div
      v-if="lastResult"
      class="exploration-result"
      :class="lastResult.success ? 'result-success' : 'result-error'"
    >
      <p>{{ lastResult.message }}</p>
      <div v-if="lastResult.info && lastResult.info.enemies" class="scout-enemies">
        <h4>🗡️ Ennemis détectés :</h4>
        <ul>
          <li v-for="enemy in lastResult.info.enemies" :key="enemy.type">
            {{ enemy.type }} (Force: {{ enemy.strength }})
          </li>
        </ul>
      </div>
      <div v-if="lastResult.info && lastResult.info.resources" class="scout-resources">
        <h4>💰 Ressources disponibles :</h4>
        <ul>
          <li v-for="(amount, resource) in lastResult.info.resources" :key="resource">
            {{ resource }}: {{ amount }}
          </li>
        </ul>
      </div>
      <div v-if="lastResult.info && lastResult.info.treasures" class="scout-treasures">
        <h4>🏺 Trésors :</h4>
        <ul>
          <li v-for="treasure in lastResult.info.treasures" :key="treasure">
            {{ treasure }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMapStore, type MapTile, type ScoutInfo } from '../../stores/mapStore'

// Props
interface Props {
  selectedTile?: MapTile | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  explorationResult: [result: { success: boolean; message: string; info?: ScoutInfo }]
}>()

// Store
const mapStore = useMapStore()

// Reactive data
const lastResult = ref<{ success: boolean; message: string; info?: ScoutInfo } | null>(null)

// Computed
const canExplore = computed(() => mapStore.canExplore.value)
const currentPoints = computed(() => mapStore.explorationPoints.value)
const maxPoints = computed(() => mapStore.mapState.maxExplorationPoints)

// Methods
const handleExplore = () => {
  const result = mapStore.explore()
  lastResult.value = result
  emit('explorationResult', result)

  // Auto-clear le résultat après 5 secondes
  setTimeout(() => {
    if (lastResult.value === result) {
      lastResult.value = null
    }
  }, 5000)
}

const handleScout = () => {
  if (!props.selectedTile) return

  const result = mapStore.scout(props.selectedTile.id)
  lastResult.value = result
  emit('explorationResult', result)

  // Auto-clear le résultat après 10 secondes (plus long pour la reconnaissance)
  setTimeout(() => {
    if (lastResult.value === result) {
      lastResult.value = null
    }
  }, 10000)
}
</script>

<style scoped>
.exploration-controls {
  background: #1e1e1e;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
}

.exploration-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.exploration-header h3 {
  color: #4fc3f7;
  margin: 0;
  font-size: 1.2em;
}

.exploration-points {
  display: flex;
  align-items: center;
  gap: 10px;
}

.points-label {
  color: #ccc;
  font-size: 0.9em;
}

.points-display {
  display: flex;
  gap: 4px;
}

.point-dot {
  font-size: 16px;
  opacity: 0.3;
  transition: opacity 0.2s ease;
}

.point-active {
  opacity: 1;
}

.exploration-actions {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.btn-explore,
.btn-scout {
  background: linear-gradient(135deg, #4fc3f7, #29b6f6);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-explore:hover,
.btn-scout:hover {
  background: linear-gradient(135deg, #29b6f6, #0288d1);
  transform: translateY(-2px);
}

.btn-explore:disabled,
.btn-scout:disabled {
  background: #555;
  cursor: not-allowed;
  transform: none;
  opacity: 0.5;
}

.exploration-result {
  padding: 15px;
  border-radius: 8px;
  margin-top: 15px;
  animation: slideIn 0.3s ease;
}

.result-success {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(56, 142, 60, 0.2));
  border: 1px solid #4caf50;
}

.result-error {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.2), rgba(198, 40, 40, 0.2));
  border: 1px solid #f44336;
}

.exploration-result p {
  margin: 0 0 10px 0;
  font-weight: 500;
}

.scout-enemies,
.scout-resources,
.scout-treasures {
  margin-top: 15px;
}

.scout-enemies h4,
.scout-resources h4,
.scout-treasures h4 {
  margin: 0 0 8px 0;
  font-size: 0.9em;
  color: #81c784;
}

.scout-enemies ul,
.scout-resources ul,
.scout-treasures ul {
  margin: 0;
  padding-left: 20px;
  color: #ccc;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .exploration-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .exploration-actions {
    flex-direction: column;
  }

  .btn-explore,
  .btn-scout {
    width: 100%;
    justify-content: center;
  }
}
</style>
