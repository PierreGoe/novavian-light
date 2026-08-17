<template>
  <button
    class="nav-toggle-btn"
    :class="`nav-toggle-btn--${side}`"
    @click="$emit('toggle')"
    :title="collapsed ? expandTitle : collapseTitle"
    :aria-expanded="!collapsed"
  >
    <span class="toggle-icon">{{ icon }}</span>
    <span v-if="collapsed && badge" class="toggle-badge">{{ badge }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
  border: 1px solid rgba(218, 165, 32, 0.35);
  border-radius: 6px;
  background: rgba(218, 165, 32, 0.1);
  color: #daa520;
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
  background: rgba(218, 165, 32, 0.25);
  border-color: #daa520;
}

.toggle-icon {
  display: block;
  transform: translateY(-1px);
}

.toggle-badge {
  position: absolute;
  bottom: -6px;
  right: -6px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: #ef4444;
  color: white;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>
