<template>
  <button
    class="nav-toggle-btn"
    :class="`nav-toggle-btn--${side}`"
    @click="$emit('toggle')"
    :title="collapsed ? expandTitle : collapseTitle"
    :aria-expanded="!collapsed"
  >
    <span class="toggle-icon">{{ icon }}</span>
    <CountBadge v-if="collapsed && badge" :count="badge" variant="active" position="bottom-right" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CountBadge from './CountBadge.vue'

const props = withDefaults(
  defineProps<{
    collapsed: boolean
    side?: 'left' | 'right'
    badge?: number
    expandTitle?: string
    collapseTitle?: string
  }>(),
  {
    side: 'left',
    expandTitle: 'Déployer le menu',
    collapseTitle: 'Réduire le menu',
  },
)

defineEmits<{ toggle: [] }>()

// Chevrons inversés selon le côté : la flèche pointe toujours vers l'extérieur du panneau
// quand replié (pour "déplier"), et vers le panneau quand déplié (pour "replier").
const icon = computed(() => {
  if (props.side === 'left') return props.collapsed ? '›' : '‹'
  return props.collapsed ? '‹' : '›'
})
</script>

<style scoped>
.nav-toggle-btn {
  position: relative;
  width: 28px;
  height: 28px;
  margin: 0.75rem 0.5rem 0.25rem;
  border: 1px solid rgba(var(--color-accent-rgb), 0.35);
  border-radius: 6px;
  background: rgba(var(--color-accent-rgb), 0.1);
  color: var(--color-accent-ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
  transition:
    background 0.25s ease,
    border-color 0.25s ease;
}

.nav-toggle-btn--left {
  align-self: flex-end;
}

.nav-toggle-btn--right {
  align-self: flex-start;
}

.nav-toggle-btn:hover {
  background: rgba(var(--color-accent-rgb), 0.25);
  border-color: var(--color-accent);
}

.nav-toggle-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.toggle-icon {
  display: block;
  transform: translateY(-1px);
}
</style>
