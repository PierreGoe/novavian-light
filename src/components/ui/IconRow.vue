<template>
  <div class="icon-row">
    <span v-if="icon" class="icon-row-icon">{{ icon }}</span>
    <div class="icon-row-labels">
      <span class="icon-row-label" :title="label">{{ label }}</span>
      <span v-if="sublabel" class="icon-row-sublabel" :title="sublabel">{{ sublabel }}</span>
    </div>
    <span class="icon-row-value" :class="`icon-row-value--${tone}`">
      <slot />
    </span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    label: string
    sublabel?: string
    tone?: 'default' | 'success' | 'danger' | 'accent' | 'muted'
  }>(),
  {
    tone: 'default',
  },
)
</script>

<style scoped>
.icon-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.icon-row-icon {
  font-size: 1.3rem;
  line-height: 1;
  flex-shrink: 0;
  /* Largeur fixe (pas juste la taille de police) pour que l'icône occupe
     toujours la même colonne, quelle que soit sa largeur visuelle réelle —
     essentiel pour l'alignement quand plusieurs IconRow sont empilées. */
  width: 1.5rem;
  text-align: center;
}

.icon-row-labels {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}

.icon-row-label {
  display: block;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-row-sublabel {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-row-value {
  font-size: 0.9rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
}

.icon-row-value--default {
  color: var(--color-text);
}

.icon-row-value--success {
  /* --color-success-strong échoue le contraste AA en texte à cette taille
     (~3.3:1 sur blanc) — --color-success (plus sombre) est fait pour ce cas. */
  color: var(--color-success);
}

.icon-row-value--danger {
  color: var(--color-danger);
}

.icon-row-value--accent {
  color: var(--color-accent-ink);
}

.icon-row-value--muted {
  color: var(--color-text-faint);
}
</style>
