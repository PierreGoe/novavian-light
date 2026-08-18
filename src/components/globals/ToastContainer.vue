<template>
  <Teleport to="body">
    <div class="toast-container" role="status" aria-live="polite">
      <!--
        Volontairement custom, pas de NoticeBox : un toast a un bouton de fermeture,
        une barre de progression animée et une transition d'empilement (TransitionGroup)
        que l'API de NoticeBox (icône + slot de message) ne couvre pas.
      -->
      <TransitionGroup name="toast" tag="div" class="toast-list">
        <div
          v-for="toast in toastStore.activeToasts.value"
          :key="toast.id"
          class="toast"
          :class="[`toast-${toast.type}`, { 'toast-clickable': !!toast.onClick }]"
          @click="handleToastClick(toast)"
        >
          <div class="toast-icon">
            <span v-if="toast.type === 'success'">✅</span>
            <span v-else-if="toast.type === 'error'">❌</span>
            <span v-else-if="toast.type === 'warning'">⚠️</span>
            <span v-else-if="toast.type === 'info'">ℹ️</span>
          </div>

          <div class="toast-content">
            <p class="toast-message">{{ toast.message }}</p>
          </div>

          <button
            class="toast-close"
            @click.stop="toastStore.removeToast(toast.id)"
            aria-label="Fermer la notification"
          >
            ✕
          </button>

          <!-- Barre de progression pour les toasts temporaires -->
          <div
            v-if="!toast.persistent && toast.duration && toast.duration > 0"
            class="toast-progress"
            :style="{ animationDuration: toast.duration + 'ms' }"
          ></div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToastStore, type Toast } from '@/stores/toastStore'

const toastStore = useToastStore()

function handleToastClick(toast: Toast) {
  if (toast.onClick) {
    toast.onClick()
    toastStore.removeToast(toast.id)
  }
}
</script>

<style scoped>
/* Ancré en bas, centré horizontalement — les nouveaux toasts s'empilent vers la droite
   depuis ce point central (voir .toast-list), plutôt que de tout re-centrer à chaque ajout. */
.toast-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  z-index: 9999;
  pointer-events: none;
  max-width: calc(100vw - 40px);
}

.toast-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap-reverse;
  align-items: flex-end;
  gap: 0.75rem;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--color-bg-surface);
  border: 1px solid rgba(var(--overlay-rgb), 0.12);
  box-shadow: 0 8px 32px rgba(var(--color-black-rgb), 0.12);
  backdrop-filter: blur(10px);
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  min-width: 300px;
  max-width: 400px;
  word-wrap: break-word;
}

.toast-success {
  border-color: rgba(var(--color-success-strong-rgb), 0.4);
  background: rgba(var(--color-success-strong-rgb), 0.08);
}

.toast-error {
  border-color: rgba(var(--color-danger-rgb), 0.4);
  background: rgba(var(--color-danger-rgb), 0.08);
}

.toast-warning {
  border-color: rgba(var(--color-warning-rgb), 0.4);
  background: rgba(var(--color-warning-rgb), 0.08);
}

.toast-info {
  border-color: rgba(var(--color-info-rgb), 0.4);
  background: rgba(var(--color-info-rgb), 0.08);
}

.toast-clickable {
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.toast-clickable:hover {
  transform: scale(1.02);
  box-shadow: 0 10px 40px rgba(var(--color-black-rgb), 0.18);
}

.toast-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-message {
  margin: 0;
  color: var(--color-text);
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: break-word;
}

.toast-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.2rem;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
  line-height: 1;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-close:hover {
  opacity: 1;
  background: rgba(var(--overlay-rgb), 0.08);
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: currentColor;
  width: 100%;
  transform-origin: left;
  animation: toast-progress linear forwards;
  opacity: 0.6;
}

.toast-success .toast-progress {
  background: var(--color-success-strong);
}

.toast-error .toast-progress {
  background: var(--color-danger);
}

.toast-warning .toast-progress {
  background: var(--color-warning);
}

.toast-info .toast-progress {
  background: var(--color-info);
}

/* Transitions */
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  transform: translateY(20px);
  opacity: 0;
}

.toast-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

.toast-move {
  transition: transform 0.3s ease;
}

/* Animation pour la barre de progression */
@keyframes toast-progress {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

/* Responsive — pleine largeur, empilement vertical (le plus récent en bas) plutôt
   qu'horizontal, pas assez de place pour grandir vers la droite sur mobile. */
@media (max-width: 768px) {
  .toast-container {
    left: 10px;
    right: 10px;
    bottom: 10px;
    max-width: none;
  }

  .toast-list {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .toast {
    min-width: auto;
    max-width: none;
    padding: 0.8rem;
  }

  .toast-message {
    font-size: 0.85rem;
  }
}

/* États focus pour l'accessibilité */
.toast-close:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
</style>
