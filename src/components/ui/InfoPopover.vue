<template>
  <div class="info-popover" @focusout="onFocusOut" @keydown.esc="close">
    <button
      class="info-popover-trigger"
      type="button"
      :aria-expanded="open"
      :aria-label="label"
      @click="open = !open"
    >
      {{ icon }}
    </button>
    <Transition name="popover-fade">
      <div v-if="open" class="info-popover-content" role="tooltip">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    icon?: string
    label?: string
  }>(),
  {
    icon: 'ℹ️',
    label: "Plus d'informations",
  },
)

const open = ref(false)

function close() {
  open.value = false
}

// Ferme si le focus quitte entièrement le composant (clic/tab en dehors)
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !(event.currentTarget as HTMLElement).contains(next)) {
    close()
  }
}
</script>

<style scoped>
.info-popover {
  position: relative;
  display: inline-block;
}

.info-popover-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  border: 1px solid rgba(var(--overlay-rgb), 0.2);
  background: rgba(var(--overlay-rgb), 0.05);
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
}

.info-popover-trigger:hover {
  background: rgba(var(--overlay-rgb), 0.1);
}

.info-popover-trigger:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.info-popover-content {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 10;
  min-width: 220px;
  background: var(--color-bg-surface);
  border: 1px solid rgba(var(--overlay-rgb), 0.15);
  border-radius: 8px;
  /* Pas de scrim derrière ce popover (contrairement à BaseDialog) — l'ombre
     porte seule la séparation avec le contenu de la page, donc plus marquée. */
  box-shadow: 0 10px 28px rgba(var(--color-black-rgb), 0.16);
  padding: 0.75rem 0.9rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .popover-fade-enter-active,
  .popover-fade-leave-active {
    transition: none;
  }
  .popover-fade-enter-from,
  .popover-fade-leave-to {
    transform: none;
  }
}
</style>
