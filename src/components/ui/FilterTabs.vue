<template>
  <div class="filter-tabs" role="tablist">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="tab"
      class="filter-tab"
      :class="{ 'filter-tab--active': item.value === modelValue }"
      :aria-selected="item.value === modelValue"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
      <span v-if="item.count !== undefined" class="filter-tab-count">{{ item.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: { label: string; value: string; count?: number }[]
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
}>()
</script>

<style scoped>
.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  background: var(--color-bg-surface);
  color: var(--color-text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.filter-tab:not(.filter-tab--active):hover {
  border-color: rgba(var(--color-accent-rgb), 0.4);
  color: var(--color-text);
}

.filter-tab:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.filter-tab--active {
  background: rgba(var(--color-accent-rgb), 0.14);
  border-color: rgba(var(--color-accent-rgb), 0.6);
  color: var(--color-accent-ink);
  font-weight: 700;
}

.filter-tab-count {
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: rgba(var(--overlay-rgb), 0.1);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.filter-tab--active .filter-tab-count {
  background: rgba(var(--color-accent-rgb), 0.2);
}
</style>
