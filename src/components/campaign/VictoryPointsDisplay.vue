<template>
  <button class="vp-btn" :class="{ 'vp-btn--victory': objectiveReached }" @click="goToScore">
    <span>⚔️</span>
    <span class="vp-count">{{ totalCombatVP }} PV</span>
    <span v-if="objectiveReached" class="vp-badge">🏆</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

const router = useRouter()
const gameStore = useGameStore()

const totalCombatVP = computed(() => gameStore.victoryPoints.value.combat)
const objectiveReached = computed(() => gameStore.campaignObjectiveReached.value)

function goToScore() {
  router.push('/campaign-score')
}
</script>

<style scoped>
.vp-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(218, 165, 32, 0.25);
  border-radius: 20px;
  color: #daa520;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}
.vp-btn:hover {
  background: rgba(255, 255, 255, 0.11);
  border-color: rgba(218, 165, 32, 0.5);
}

/* Animation pulsation quand l'objectif est atteint */
.vp-btn--victory {
  border-color: rgba(218, 165, 32, 0.65);
  background: rgba(218, 165, 32, 0.1);
  animation: vp-pulse 2.2s ease-in-out infinite;
}

@keyframes vp-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(218, 165, 32, 0);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(218, 165, 32, 0.25);
  }
}

.vp-count {
  font-variant-numeric: tabular-nums;
}
.vp-badge {
  font-size: 1rem;
}
</style>
