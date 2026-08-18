<template>
  <button class="icon-action-btn" type="button" :disabled="disabled">
    <span v-if="icon" class="icon-action-icon">{{ icon }}</span>
    <span class="icon-action-title">{{ title }}</span>
    <span v-if="subtitle" class="icon-action-subtitle">{{ subtitle }}</span>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    subtitle?: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)
</script>

<style scoped>
.icon-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 1.1rem 1rem;
  border-radius: 10px;
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  background: var(--color-bg-surface);
  cursor: pointer;
  text-align: center;
  transition:
    transform 0.15s,
    border-color 0.15s;
}

.icon-action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: rgba(var(--color-accent-rgb), 0.4);
}

.icon-action-btn:active:not(:disabled) {
  transform: translateY(-1px) scale(0.98);
}

.icon-action-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.icon-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-action-icon {
  font-size: 1.8rem;
  line-height: 1;
}

.icon-action-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text);
}

.icon-action-subtitle {
  font-size: 0.78rem;
  color: var(--color-text-faint);
}
</style>
