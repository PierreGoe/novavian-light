import { ref, computed } from 'vue'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'warning' | 'error' | 'info'
  duration?: number
  persistent?: boolean
  onClick?: () => void
}

// État réactif des toasts
const toasts = ref<Toast[]>([])
let nextId = 1

/** Nombre max de toasts non-persistants affichés simultanément — évite l'empilement en rafale */
const MAX_ACTIVE_TOASTS = 4

export const useToastStore = () => {
  // Getters
  const allToasts = computed(() => toasts.value)
  const activeToasts = computed(() =>
    toasts.value.filter((toast) => toast.persistent || toast.duration !== 0),
  )

  // Actions
  const addToast = (
    message: string,
    type: Toast['type'] = 'info',
    options: { duration?: number; persistent?: boolean; onClick?: () => void } = {},
  ): string => {
    const id = `toast-${nextId++}`
    const duration = options.persistent ? 0 : (options.duration ?? 4000)

    const toast: Toast = {
      id,
      message,
      type,
      duration,
      persistent: options.persistent || false,
      onClick: options.onClick,
    }

    toasts.value.push(toast)

    // Plafonner les toasts non-persistants : en rafale, on retire les plus anciens
    const nonPersistentActive = () => activeToasts.value.filter((t) => !t.persistent)
    while (nonPersistentActive().length > MAX_ACTIVE_TOASTS) {
      removeToast(nonPersistentActive()[0].id)
    }

    // Auto-remove si pas persistant
    if (!options.persistent && duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  const removeToast = (id: string) => {
    const index = toasts.value.findIndex((toast) => toast.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  const clearAllToasts = () => {
    toasts.value = []
  }

  // Méthodes de convenance pour différents types
  const showSuccess = (
    message: string,
    options?: { duration?: number; persistent?: boolean; onClick?: () => void },
  ) => {
    return addToast(message, 'success', options)
  }

  const showError = (
    message: string,
    options?: { duration?: number; persistent?: boolean; onClick?: () => void },
  ) => {
    return addToast(message, 'error', options)
  }

  const showWarning = (
    message: string,
    options?: { duration?: number; persistent?: boolean; onClick?: () => void },
  ) => {
    return addToast(message, 'warning', options)
  }

  const showInfo = (
    message: string,
    options?: { duration?: number; persistent?: boolean; onClick?: () => void },
  ) => {
    return addToast(message, 'info', options)
  }

  return {
    // État
    allToasts,
    activeToasts,

    // Actions
    addToast,
    removeToast,
    clearAllToasts,

    // Méthodes de convenance
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }
}

// Export du type pour l'utilisation dans les composants
export type ToastStore = ReturnType<typeof useToastStore>
