<template>
  <div class="segmented-control" role="tablist">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="tab"
      class="segment"
      :class="{ 'segment--active': option.value === modelValue }"
      :aria-selected="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      <span v-if="option.icon" class="segment-icon">{{ option.icon }}</span>
      {{ option.label }}
      <span v-if="option.badge" class="segment-badge">{{ option.badge }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  options: { label: string; value: string; icon?: string; badge?: number }[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
}>()
</script>

<style scoped>
.segmented-control {
  display: inline-flex;
  gap: 0.15rem;
  background: rgba(var(--overlay-rgb), 0.05);
  border-radius: 8px;
  padding: 0.25rem;
}

.segment {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    box-shadow 0.15s;
}

.segment:hover:not(.segment--active) {
  color: var(--color-text);
}

.segment--active {
  background: var(--color-bg-surface);
  color: var(--color-text);
  box-shadow: 0 1px 3px rgba(var(--color-black-rgb), 0.1);
}

.segment:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.segment-icon {
  line-height: 1;
}

.segment-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.18);
  color: var(--color-accent-ink);
  font-size: 0.68rem;
}
</style>
