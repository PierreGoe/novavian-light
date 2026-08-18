<template>
  <div class="notice-box" :class="`notice-box--${variant}`" role="note">
    <span v-if="resolvedIcon" class="notice-box-icon">{{ resolvedIcon }}</span>
    <div class="notice-box-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
    icon?: string
  }>(),
  {
    variant: 'neutral',
  },
)

const defaultIcons: Record<string, string> = {
  success: '✓',
  warning: '⚠️',
  danger: '⛔',
  info: 'ℹ️',
  neutral: '',
}

const resolvedIcon = computed(() => props.icon ?? defaultIcons[props.variant])
</script>

<style scoped>
.notice-box {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid transparent;
  /* Liseré gauche plus marqué que le reste du contour — permet d'identifier
     le ton (succès/alerte/danger…) d'un coup d'œil, avant même de lire l'icône. */
  border-left-width: 3px;
}

.notice-box-icon {
  flex-shrink: 0;
  line-height: 1.4;
}

.notice-box-content {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.notice-box--success {
  background: rgba(var(--color-success-strong-rgb), 0.1);
  border-color: rgba(var(--color-success-strong-rgb), 0.35);
}

.notice-box--warning {
  background: rgba(var(--color-warning-rgb), 0.1);
  border-color: rgba(var(--color-warning-rgb), 0.35);
}

.notice-box--danger {
  background: rgba(var(--color-danger-rgb), 0.1);
  border-color: rgba(var(--color-danger-rgb), 0.35);
}

.notice-box--info {
  background: rgba(var(--color-info-rgb), 0.1);
  border-color: rgba(var(--color-info-rgb), 0.35);
}

.notice-box--neutral {
  background: rgba(var(--overlay-rgb), 0.08);
  border-color: rgba(var(--overlay-rgb), 0.15);
}
</style>
