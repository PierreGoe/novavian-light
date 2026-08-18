<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="open"
        class="dialog-backdrop"
        @click.self="onBackdropClick"
        @keydown.esc="close"
        @keydown.tab="trapFocus"
      >
        <div
          ref="dialogRef"
          class="dialog-panel"
          :class="`dialog-panel--${size}`"
          :role="role"
          aria-modal="true"
          :aria-labelledby="labelledby"
          tabindex="-1"
        >
          <div v-if="$slots.header" class="dialog-header">
            <slot name="header" />
          </div>
          <div class="dialog-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="dialog-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    closeOnBackdrop?: boolean
    size?: 'sm' | 'md' | 'lg'
    /** 'alertdialog' pour les confirmations/actions destructives — cf. ConfirmDialog */
    role?: 'dialog' | 'alertdialog'
    /** id de l'élément servant de titre accessible (aria-labelledby) */
    labelledby?: string
  }>(),
  {
    closeOnBackdrop: true,
    size: 'md',
    role: 'dialog',
  },
)

const emit = defineEmits<{
  'update:open': [boolean]
}>()

const dialogRef = ref<HTMLDivElement | null>(null)

function close() {
  emit('update:open', false)
}

function onBackdropClick() {
  if (props.closeOnBackdrop) close()
}

// Focus posé sur le panneau à l'ouverture, pour que la navigation clavier
// (Esc, Tab) fonctionne immédiatement — un enfant peut ensuite re-focaliser
// un élément précis (ex: le bouton de confirmation) dans son propre onMounted/watch.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      dialogRef.value?.focus()
    }
  },
)

// Piège le focus à l'intérieur du panneau : Tab/Shift+Tab boucle sur le premier
// et le dernier élément focusable au lieu de s'échapper vers le contenu couvert
// par le backdrop (obligatoire pour un dialog modal — sans ça, un clavier ou un
// lecteur d'écran peut atteindre des éléments visuellement masqués derrière).
function trapFocus(event: KeyboardEvent) {
  if (!dialogRef.value) return
  const focusables = dialogRef.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(var(--color-black-rgb), 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.dialog-panel {
  background: var(--color-bg-surface);
  border: 1px solid rgba(var(--overlay-rgb), 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  box-shadow: 0 12px 40px rgba(var(--color-black-rgb), 0.15);
}

.dialog-panel:focus {
  outline: none;
}

.dialog-panel--sm {
  max-width: 360px;
}

.dialog-panel--md {
  max-width: 420px;
}

.dialog-panel--lg {
  max-width: 560px;
}

.dialog-header {
  margin-bottom: 0.6rem;
}

.dialog-body {
  color: var(--color-text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-fade-enter-active .dialog-panel,
.dialog-fade-leave-active .dialog-panel {
  transition: transform 0.18s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog-panel,
.dialog-fade-leave-to .dialog-panel {
  transform: scale(0.97) translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .dialog-fade-enter-active .dialog-panel,
  .dialog-fade-leave-active .dialog-panel {
    transition: none;
  }

  .dialog-fade-enter-from .dialog-panel,
  .dialog-fade-leave-to .dialog-panel {
    transform: none;
  }
}
</style>
