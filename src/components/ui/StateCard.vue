<!--
  Conteneur purement présentationnel : StateCard ne gère ni clic ni focus.
  Si un usage la rend cliquable, le consommateur est responsable de l'accessibilité
  (role="button", tabindex, gestion clavier) — voir SelectableCard.vue pour l'équivalent
  déjà interactif, à préférer quand la carte est un vrai choix cliquable.
-->
<template>
  <div class="state-card" :class="`state-card--${state}`">
    <div v-if="$slots.icon" class="state-card-icon">
      <slot name="icon" />
    </div>
    <div class="state-card-body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="state-card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    state?: 'locked' | 'available' | 'active' | 'ready' | 'done' | 'warning' | 'neutral'
  }>(),
  {
    state: 'neutral',
  },
)
</script>

<style scoped>
.state-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem;
  border-radius: 12px;
  border: 1px solid rgba(var(--overlay-rgb), 0.12);
  background: var(--color-bg-surface);
}

.state-card-icon {
  font-size: 1.3rem;
  line-height: 1;
}

.state-card-body {
  color: var(--color-text);
  font-size: 0.9rem;
}

.state-card-footer {
  margin-top: 0.3rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.state-card--locked {
  border-color: rgba(var(--overlay-rgb), 0.08);
  opacity: 0.6;
}

.state-card--available {
  border-style: dashed;
  border-color: var(--color-info);
  background: rgba(var(--color-info-rgb), 0.04);
}

.state-card--active {
  border-color: var(--color-accent);
  background: rgba(var(--color-accent-rgb), 0.08);
}

.state-card--ready,
.state-card--done {
  border-color: var(--color-success-strong);
  background: rgba(var(--color-success-strong-rgb), 0.08);
}

.state-card--warning {
  border-color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), 0.08);
}
</style>
