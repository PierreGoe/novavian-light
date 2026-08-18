<template>
  <div class="range-slider" :class="{ 'range-slider--disabled': disabled }">
    <div class="range-slider-track-wrap">
      <input
        type="range"
        class="range-slider-input"
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue"
        :disabled="disabled"
        :aria-valuetext="displayValue"
        @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      />
      <span class="range-slider-value">{{ displayValue }}</span>
    </div>
    <div class="range-slider-labels">
      <span>{{ formatValue ? formatValue(min) : min }}</span>
      <span>{{ formatValue ? formatValue(max) : max }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min: number
    max: number
    step?: number
    formatValue?: (value: number) => string
    disabled?: boolean
  }>(),
  {
    step: 1,
  },
)

defineEmits<{
  'update:modelValue': [number]
}>()

// Annoncé aux lecteurs d'écran à la place de la valeur numérique brute —
// sans ça, un input formaté ("×2") serait lu "2" tout court.
const displayValue = computed(() =>
  props.formatValue ? props.formatValue(props.modelValue) : String(props.modelValue),
)
</script>

<style scoped>
.range-slider {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 160px;
}

.range-slider-track-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.range-slider-input {
  flex: 1;
  appearance: none;
  height: 4px;
  border-radius: 999px;
  /* Légèrement plus marqué qu'un simple liseré : c'est la seule indication
     visuelle de l'étendue de la piste, elle doit rester repérable sur blanc. */
  background: rgba(var(--overlay-rgb), 0.2);
  outline: none;
  cursor: pointer;
}

/* Piste explicite par moteur — évite qu'un navigateur applique son propre
   habillage par défaut (bordure/hauteur) par-dessus le fond ci-dessus. */
.range-slider-input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: transparent;
}

.range-slider-input::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: transparent;
}

.range-slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 2px solid var(--color-bg-surface);
  box-shadow: 0 1px 3px rgba(var(--color-black-rgb), 0.3);
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.range-slider-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 2px solid var(--color-bg-surface);
  box-shadow: 0 1px 3px rgba(var(--color-black-rgb), 0.3);
  cursor: pointer;
  transition: box-shadow 0.15s;
}

/* Anneau de focus posé sur le curseur lui-même plutôt qu'un contour autour
   de toute la largeur de l'input (qui dessinerait un long rectangle sans
   rapport visuel avec la poignée qu'on manipule réellement). */
.range-slider-input:focus-visible::-webkit-slider-thumb {
  box-shadow:
    0 1px 3px rgba(var(--color-black-rgb), 0.3),
    0 0 0 4px rgba(var(--color-accent-rgb), 0.35);
}

.range-slider-input:focus-visible::-moz-range-thumb {
  box-shadow:
    0 1px 3px rgba(var(--color-black-rgb), 0.3),
    0 0 0 4px rgba(var(--color-accent-rgb), 0.35);
}

.range-slider-value {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-accent-ink);
  min-width: 48px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.range-slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.62rem;
  color: var(--color-text-faint);
}

.range-slider--disabled {
  opacity: 0.5;
}

.range-slider--disabled .range-slider-input {
  cursor: not-allowed;
}

.range-slider--disabled .range-slider-input::-webkit-slider-thumb,
.range-slider--disabled .range-slider-input::-moz-range-thumb {
  cursor: not-allowed;
}
</style>
