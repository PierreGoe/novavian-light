<template>
  <div class="timer-clock" :class="{ 'timer-clock--done': done }">
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      class="timer-clock-svg"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <circle
        class="timer-clock-track"
        :class="{ 'timer-clock-track--dashed': dashed || done }"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
      />
      <circle
        v-if="progress !== undefined"
        class="timer-clock-progress"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        :stroke="progressColor"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - progress)"
      />
    </svg>
    <div class="timer-clock-inner">
      <span v-if="icon" class="timer-clock-icon" :style="{ fontSize: `${size * 0.35}px` }">{{
        icon
      }}</span>
      <span
        v-if="remainingMs !== undefined"
        class="timer-clock-time"
        :style="{ fontSize: `${size * 0.16}px` }"
        >{{ formatDuration(remainingMs) }}</span
      >
      <slot />
    </div>
    <span v-if="countBadge && countBadge > 1" class="timer-clock-badge">×{{ countBadge }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDuration } from '@/utils/formatDuration'

const props = withDefaults(
  defineProps<{
    size?: number
    progress?: number
    remainingMs?: number
    icon?: string
    done?: boolean
    dashed?: boolean
    progressColor?: string
    countBadge?: number
  }>(),
  {
    size: 60,
    progressColor: 'var(--color-accent)',
  },
)

// Marge de la piste par rapport au bord du SVG — proportionnelle à la taille
// (le rendu d'origine utilisait un rayon 26 sur un viewBox 60, soit ~4.3px de marge).
const radius = computed(() => props.size / 2 - props.size * 0.0717)
const circumference = computed(() => 2 * Math.PI * radius.value)
</script>

<style scoped>
.timer-clock {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.timer-clock-svg {
  display: block;
}

.timer-clock-track {
  fill: none;
  /* Opacité un peu plus marquée que ProgressBar (0.1) : un trait de 3px est
     visuellement plus discret qu'une piste pleine de 8px de haut, il a besoin
     d'un peu plus de contraste pour rester lisible sur fond clair. */
  stroke: rgba(var(--overlay-rgb), 0.14);
  stroke-width: 3;
}

.timer-clock-track--dashed {
  stroke-dasharray: 4 4;
}

.timer-clock--done .timer-clock-track {
  stroke: rgba(var(--color-success-muted-rgb), 0.25);
}

.timer-clock-progress {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 1s linear;
}

.timer-clock-inner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  pointer-events: none;
}

.timer-clock-icon {
  font-size: 1.4rem;
  line-height: 1;
}

.timer-clock-time {
  font-size: 0.6rem;
  color: var(--color-text);
  font-weight: bold;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.timer-clock--done .timer-clock-time {
  color: var(--color-success);
}

.timer-clock-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 0.6rem;
  font-weight: bold;
  color: var(--color-accent-contrast);
  background: var(--color-accent);
  border-radius: 8px;
  padding: 0.05rem 0.3rem;
  line-height: 1.4;
  pointer-events: none;
}
</style>
