<template>
  <div class="quantity-stepper">
    <button
      type="button"
      class="qty-btn"
      :disabled="modelValue <= min"
      @click="emit('update:modelValue', Math.max(min, modelValue - 1))"
    >
      −
    </button>
    <input
      class="qty-input"
      type="number"
      :min="min"
      :max="max"
      :value="modelValue"
      @change="onInput"
    />
    <button
      type="button"
      class="qty-btn"
      :disabled="max !== undefined && modelValue >= max"
      @click="
        emit(
          'update:modelValue',
          max !== undefined ? Math.min(max, modelValue + 1) : modelValue + 1,
        )
      "
    >
      +
    </button>
    <button
      v-if="max !== undefined"
      type="button"
      class="qty-max"
      @click="emit('update:modelValue', max)"
    >
      Max
    </button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
  }>(),
  {
    min: 0,
  },
)

const emit = defineEmits<{
  'update:modelValue': [number]
}>()

function onInput(event: Event) {
  const raw = Number((event.target as HTMLInputElement).value)
  const clamped = Math.max(props.min, props.max !== undefined ? Math.min(props.max, raw) : raw)
  emit('update:modelValue', Number.isFinite(clamped) ? clamped : props.min)
}
</script>

<style scoped>
.quantity-stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.qty-btn {
  width: 26px;
  height: 26px;
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  border-radius: 6px;
  background: rgba(var(--overlay-rgb), 0.06);
  color: var(--color-text);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.15s,
    transform 0.1s;
}

.qty-btn:hover:not(:disabled) {
  background: rgba(var(--overlay-rgb), 0.12);
}

.qty-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.qty-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-input {
  width: 3rem;
  height: 26px;
  text-align: center;
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  border-radius: 6px;
  background: var(--color-bg-surface);
  color: var(--color-text);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  transition: border-color 0.15s;
}

.qty-input:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
  border-color: var(--color-accent);
}

.qty-max {
  border: none;
  background: none;
  color: var(--color-accent-ink);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  padding: 0 0.15rem;
  transition: opacity 0.15s;
}

.qty-max:hover {
  opacity: 0.75;
}

.qty-max:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 3px;
}
</style>
