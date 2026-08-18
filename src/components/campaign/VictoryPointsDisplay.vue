<!--
  Volontairement custom, pas de Badge : c'est un bouton cliquable (navigation vers le
  score), pas un badge d'information passif — Badge rend un <span> non interactif.
-->
<template>
  <button
    class="vp-btn"
    :class="{ 'vp-btn--victory': objectiveReached }"
    :aria-label="ariaLabel"
    @click="goToScore"
  >
    <span class="vp-row-top">
      <span aria-hidden="true">⚔️</span>
      <span class="vp-count">{{ totalCombatVP }} / {{ COMBAT_VP_GOAL }} PV</span>
      <span v-if="objectiveReached" class="vp-badge" aria-hidden="true">🏆</span>
    </span>
    <ProgressBar class="vp-progress" :value="progressPct" tone="accent" :done="objectiveReached" />
    <span class="vp-hint">{{ suggestionText }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  useGameStore,
  COMBAT_VP_GOAL,
  VILLAGE_VP_CAP,
  COMBAT_VICTORY_VP_CAP,
} from '@/stores/gameStore'
import ProgressBar from '@/components/ui/ProgressBar.vue'

const router = useRouter()
const gameStore = useGameStore()

const totalCombatVP = computed(() => gameStore.victoryPoints.value.combat)
const objectiveReached = computed(() => gameStore.campaignObjectiveReached.value)
const progressPct = computed(() => (totalCombatVP.value / COMBAT_VP_GOAL) * 100)

const suggestionText = computed(() => {
  if (objectiveReached.value) return '🏆 Objectif de campagne atteint !'
  const vp = gameStore.victoryPoints.value
  if (vp.villageVp < VILLAGE_VP_CAP) return '💡 Prochaine étape : détruire un village (+2 PV)'
  if (vp.combatVictoryVp < COMBAT_VICTORY_VP_CAP)
    return '💡 Prochaine étape : remporter un combat (+1 PV)'
  return '💡 Prochaine étape : détruire une forteresse ennemie (+4 PV)'
})

const ariaLabel = computed(
  () =>
    `Voir les points de victoire : ${totalCombatVP.value} sur ${COMBAT_VP_GOAL} PV` +
    `${objectiveReached.value ? ', objectif atteint' : ''}. ${suggestionText.value}`,
)

function goToScore() {
  router.push('/campaign-score')
}
</script>

<style scoped>
.vp-btn {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.3rem;
  min-width: 160px;
  padding: 0.5rem 0.9rem;
  background: rgba(var(--color-accent-rgb), 0.12);
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
  border-radius: 12px;
  color: var(--color-accent-ink);
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s,
    border-color 0.15s;
}
.vp-btn:hover {
  background: rgba(var(--color-accent-rgb), 0.18);
  border-color: rgba(var(--color-accent-rgb), 0.6);
}

/* Animation pulsation quand l'objectif est atteint */
.vp-btn--victory {
  border-color: rgba(var(--color-accent-rgb), 0.65);
  background: rgba(var(--color-accent-rgb), 0.1);
  animation: vp-pulse 2.2s ease-in-out infinite;
}

@keyframes vp-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(var(--color-accent-rgb), 0);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(var(--color-accent-rgb), 0.25);
  }
}

.vp-row-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.vp-count {
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
  font-weight: 700;
}
.vp-badge {
  font-size: 1rem;
}

.vp-progress {
  width: 100%;
}

.vp-hint {
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1.2;
  color: var(--color-text-muted);
  white-space: normal;
}
</style>
