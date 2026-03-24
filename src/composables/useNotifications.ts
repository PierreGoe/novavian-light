import { ref } from 'vue'

export function useNotifications() {
  const notification = ref<{ message: string; type: string } | null>(null)

  const showNotification = (message: string, type: string) => {
    notification.value = { message, type }
    setTimeout(() => {
      notification.value = null
    }, 3000)
  }

  return { notification, showNotification }
}
