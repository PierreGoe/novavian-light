<template>
  <div class="setting-row" :class="{ 'setting-row--disabled': disabled }">
    <div class="setting-row-info">
      <div class="setting-row-label"><slot name="label" /></div>
      <div v-if="$slots.description" class="setting-row-description">
        <slot name="description" />
      </div>
    </div>
    <div class="setting-row-control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Reflète visuellement l'indisponibilité d'un réglage sur toute la ligne
// (libellé + description + contrôle), pas seulement sur le contrôle lui-même
// — cohérent avec le prop `disabled` désormais présent sur ToggleSwitch/
// RangeSlider/SearchInput, ses enfants typiques.
defineProps<{
  disabled?: boolean
}>()
</script>

<style scoped>
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid rgba(var(--overlay-rgb), 0.08);
}

.setting-row--disabled {
  opacity: 0.55;
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
  min-width: 0;
}

.setting-row-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.setting-row-description {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.setting-row-control {
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .setting-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.6rem;
  }
}
</style>
