<template>
  <div v-if="visible" class="threat-indicator" :class="`threat--${era.tone}`" :title="tooltip">
    <span class="threat-icon" aria-hidden="true">{{ era.icon }}</span>
    <span class="threat-name">{{ era.name }}</span>
  </div>
</template>

<script setup lang="ts">
// Indicateur d'ère de menace (pression du temps) : matérialise la montée en
// puissance des villages IA pour que le joueur SENTE l'urgence — voir
// src/game/timePressure.ts pour les seuils d'ères.
import { computed } from 'vue'
import { useExplorationTicker } from '@/composables/useExplorationTicker'
import { getGlobalPressure, getEra } from '@/game/timePressure'
import { gameSettings } from '@/stores/gameSettingsStore'

const { now } = useExplorationTicker()

const pressure = computed(() => {
  void now.value // dépendance au tick 1s du ticker : l'ère se met à jour en continu
  return getGlobalPressure()
})
const era = computed(() => getEra(pressure.value))
const visible = computed(() => gameSettings.timePressureEnabled)
const tooltip = computed(
  () =>
    `Menace des villages voisins : ×${pressure.value.toFixed(2)}. ` +
    `Ils se développent au fil de la mission — plus vous attendez, plus ils résistent (et attaquent).`,
)
</script>

<style scoped>
.threat-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: help;
  user-select: none;
}

.threat-icon {
  font-size: 0.95rem;
  line-height: 1;
}

.threat--calm {
  color: #7fd18a;
  border-color: rgba(127, 209, 138, 0.35);
  background: rgba(127, 209, 138, 0.1);
}

.threat--notice {
  color: #d9c76a;
  border-color: rgba(217, 199, 106, 0.35);
  background: rgba(217, 199, 106, 0.1);
}

.threat--warning {
  color: #e0a458;
  border-color: rgba(224, 164, 88, 0.4);
  background: rgba(224, 164, 88, 0.12);
}

.threat--danger {
  color: #e07858;
  border-color: rgba(224, 120, 88, 0.45);
  background: rgba(224, 120, 88, 0.14);
}

.threat--critical {
  color: #e05858;
  border-color: rgba(224, 88, 88, 0.55);
  background: rgba(224, 88, 88, 0.18);
  animation: threat-pulse 2s ease-in-out infinite;
}

@keyframes threat-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(224, 88, 88, 0.35);
  }
  50% {
    box-shadow: 0 0 8px 2px rgba(224, 88, 88, 0.25);
  }
}
</style>
