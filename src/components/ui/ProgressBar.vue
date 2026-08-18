<template>
  <div
    class="progress-bar-track"
    role="progressbar"
    :aria-valuenow="clampedValue"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      class="progress-bar-fill"
      :class="`progress-bar-fill--${resolvedTone}`"
      :style="{ width: `${clampedValue}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    tone?: 'accent' | 'success' | 'danger' | 'warning'
    done?: boolean
  }>(),
  {
    tone: 'accent',
    done: false,
  },
)

const clampedValue = computed(() => Math.min(100, Math.max(0, props.value)))
const resolvedTone = computed(() => (props.done ? 'success' : props.tone))
</script>

<style scoped>
.progress-bar-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(var(--overlay-rgb), 0.1);
}

.progress-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.progress-bar-fill--accent {
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-dark));
}

.progress-bar-fill--success {
  background: var(--color-success-strong);
}

.progress-bar-fill--danger {
  background: var(--color-danger);
}

.progress-bar-fill--warning {
  background: var(--color-warning);
}
</style>
