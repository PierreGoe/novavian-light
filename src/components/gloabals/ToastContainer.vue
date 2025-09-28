<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast" tag="div">
        <div
          v-for="toast in toastStore.activeToasts.value"
          :key="toast.id"
          class="toast"
          :class="[`toast-${toast.type}`]"
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
            @click="toastStore.removeToast(toast.id)"
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
import { useToastStore } from '@/stores/toastStore'

const toastStore = useToastStore()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 100px;
  right: 20px;
  z-index: 9999;
  pointer-events: none;
  max-width: 400px;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  margin-bottom: 0.75rem;
  border-radius: 12px;
  background: rgba(26, 15, 8, 0.95);
  border: 1px solid;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  min-width: 300px;
  max-width: 400px;
  word-wrap: break-word;
}

.toast-success {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.toast-error {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.toast-warning {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.toast-info {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
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
  color: #f4e4bc;
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: break-word;
}

.toast-close {
  background: none;
  border: none;
  color: #f4e4bc;
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
  background: rgba(255, 255, 255, 0.1);
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
  background: #22c55e;
}

.toast-error .toast-progress {
  background: #ef4444;
}

.toast-warning .toast-progress {
  background: #f59e0b;
}

.toast-info .toast-progress {
  background: #3b82f6;
}

/* Transitions */
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
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

/* Responsive */
@media (max-width: 768px) {
  .toast-container {
    right: 10px;
    left: 10px;
    max-width: none;
    top: 80px;
  }

  .toast {
    min-width: auto;
    max-width: none;
    margin-bottom: 0.5rem;
    padding: 0.8rem;
  }

  .toast-message {
    font-size: 0.85rem;
  }
}

/* États focus pour l'accessibilité */
.toast-close:focus {
  outline: 2px solid #daa520;
  outline-offset: 2px;
}
</style>
