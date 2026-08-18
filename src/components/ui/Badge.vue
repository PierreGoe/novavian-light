<template>
  <span class="badge" :class="`badge--${tone}`">
    <span v-if="icon" class="badge-icon">{{ icon }}</span>
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'accent' | 'success' | 'danger' | 'info' | 'warning' | 'epic' | 'neutral'
    icon?: string
  }>(),
  {
    tone: 'neutral',
  },
)
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.badge-icon {
  line-height: 1;
}

.badge--neutral {
  background: rgba(var(--overlay-rgb), 0.08);
  border-color: rgba(var(--overlay-rgb), 0.2);
  color: var(--color-text-muted);
}

.badge--accent {
  background: rgba(var(--color-accent-rgb), 0.15);
  border-color: rgba(var(--color-accent-rgb), 0.4);
  color: var(--color-accent-ink);
}

.badge--success {
  background: rgba(var(--color-success-strong-rgb), 0.15);
  border-color: rgba(var(--color-success-strong-rgb), 0.4);
  /* --color-success-strong échoue le contraste AA en texte de cette taille
     (~3.3:1 sur blanc) — on garde la teinte vive pour fond/bordure mais on
     bascule sur --color-success (plus sombre) pour le texte. */
  color: var(--color-success);
}

.badge--danger {
  background: rgba(var(--color-danger-rgb), 0.15);
  border-color: rgba(var(--color-danger-rgb), 0.4);
  color: var(--color-danger-light);
}

.badge--info {
  background: rgba(var(--color-info-rgb), 0.15);
  border-color: rgba(var(--color-info-rgb), 0.4);
  color: var(--color-info);
}

.badge--warning {
  background: rgba(var(--color-warning-rgb), 0.15);
  border-color: rgba(var(--color-warning-rgb), 0.4);
  color: var(--color-warning);
}

.badge--epic {
  background: rgba(var(--rarity-epic-rgb), 0.15);
  border-color: rgba(var(--rarity-epic-rgb), 0.4);
  color: var(--rarity-epic);
}
</style>
