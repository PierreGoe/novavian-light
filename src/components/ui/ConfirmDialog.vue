<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div
        v-if="open"
        class="confirm-backdrop"
        @click.self="cancel"
        @keydown.esc="cancel"
      >
        <div
          ref="dialogRef"
          class="confirm-dialog"
          :class="{ 'confirm-dialog--danger': danger }"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <h2 :id="titleId" class="confirm-title">{{ title }}</h2>
          <p class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button class="confirm-btn confirm-btn--cancel" @click="cancel">
              {{ cancelLabel }}
            </button>
            <button
              ref="confirmBtnRef"
              class="confirm-btn confirm-btn--confirm"
              @click="confirm"
            >
              {{ confirmLabel }}
            </button>
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
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    /** Style rouge/danger pour les actions destructives (vs. gold neutre par défaut) */
    danger?: boolean
  }>(),
  {
    confirmLabel: 'Confirmer',
    cancelLabel: 'Annuler',
    danger: false,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:open': [boolean]
}>()

// Identifiant stable par instance pour aria-labelledby
const titleId = `confirm-dialog-title-${Math.random().toString(36).slice(2, 9)}`
const confirmBtnRef = ref<HTMLButtonElement | null>(null)

function confirm() {
  emit('confirm')
  emit('update:open', false)
}

function cancel() {
  emit('cancel')
  emit('update:open', false)
}

// Focus posé sur le bouton de confirmation à l'ouverture, pour la navigation clavier
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      confirmBtnRef.value?.focus()
    }
  },
)
</script>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.confirm-dialog {
  background: #1e293b;
  border: 2px solid rgba(218, 165, 32, 0.5);
  border-radius: 14px;
  padding: 1.5rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
}

.confirm-dialog--danger {
  border-color: rgba(239, 68, 68, 0.5);
}

.confirm-title {
  margin: 0 0 0.6rem;
  font-size: 1.1rem;
  color: #daa520;
}

.confirm-dialog--danger .confirm-title {
  color: #f87171;
}

.confirm-message {
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
  color: #cbd5e1;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.confirm-btn {
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 0.15s,
    transform 0.1s;
}

.confirm-btn:focus-visible {
  outline: 2px solid #daa520;
  outline-offset: 2px;
}

.confirm-btn--cancel {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
  color: #e2e8f0;
}

.confirm-btn--cancel:hover {
  background: rgba(255, 255, 255, 0.13);
}

.confirm-btn--confirm {
  background: linear-gradient(135deg, #daa520, #b8860b);
  color: #1a0f08;
}

.confirm-dialog--danger .confirm-btn--confirm {
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  color: #fff;
}

.confirm-btn--confirm:hover {
  filter: brightness(1.1);
}

.confirm-btn:active {
  transform: scale(0.97);
}

.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.15s ease;
}

.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}
</style>
