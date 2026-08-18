<!--
  Positionnement : ce composant est `position: absolute` et attend un parent
  en `position: relative` pour s'ancrer correctement (même contrat que
  CountBadge.vue).
-->
<template>
  <span class="floating-number" :class="`floating-number--${resolvedTone}`">
    {{ value > 0 ? '+' : '' }}{{ value }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number
  tone?: 'success' | 'danger' | 'accent'
}>()

const resolvedTone = computed(() => props.tone ?? (props.value < 0 ? 'danger' : 'success'))
</script>

<style scoped>
.floating-number {
  position: absolute;
  font-weight: 700;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
  animation: float-up 1.2s ease-out forwards;
}

.floating-number--success {
  /* --color-success-strong échoue le contraste AA en texte sur fond clair
     (~3.3:1) — --color-success (plus sombre) est le token à utiliser pour
     du texte, --color-success-strong reste réservé aux fonds/bordures. */
  color: var(--color-success);
}

.floating-number--danger {
  color: var(--color-danger);
}

.floating-number--accent {
  color: var(--color-accent-ink);
}

@keyframes float-up {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-24px);
    opacity: 0;
  }
}
</style>
