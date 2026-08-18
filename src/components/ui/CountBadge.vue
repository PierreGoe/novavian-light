<template>
  <span
    v-if="count > 0"
    class="count-badge"
    :class="[`count-badge--${variant}`, `count-badge--${position}`]"
  >
    {{ count }}
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    count: number
    variant?: 'default' | 'active'
    position?: 'top-right' | 'bottom-right'
  }>(),
  {
    variant: 'default',
    position: 'top-right',
  },
)
</script>

<style scoped>
/* Se positionne par rapport à un parent en position: relative (l'icône/l'avatar qu'il annote). */
.count-badge {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  /* Ombre légère : sépare visuellement le badge de ce qu'il annote, que ce
     dernier soit clair ou sombre — le badge ne peut pas compter sur un
     contraste de fond garanti puisqu'il se pose sur des éléments variés
     (icône de nav, avatar, emoji…). */
  box-shadow: 0 1px 3px rgba(var(--color-black-rgb), 0.18);
}

.count-badge--top-right {
  top: -4px;
  right: -6px;
}

.count-badge--bottom-right {
  bottom: -4px;
  right: -6px;
}

.count-badge--default {
  background: var(--color-bg-surface);
  border: 1px solid rgba(var(--overlay-rgb), 0.2);
  color: var(--color-text-muted);
}

.count-badge--active {
  background: var(--color-danger);
  border: 1px solid rgba(var(--overlay-rgb), 0.25);
  color: #fff;
}
</style>
