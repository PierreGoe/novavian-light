import { ref } from 'vue'

const STORAGE_KEY = 'novavian-onboarding-seen'

// État réactif partagé — module-level singleton, pas de factory qui réinitialise l'état
const hasSeenOnboarding = ref(localStorage.getItem(STORAGE_KEY) === 'true')

export const useOnboarding = () => {
  const markOnboardingSeen = () => {
    hasSeenOnboarding.value = true
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  return {
    hasSeenOnboarding,
    markOnboardingSeen,
  }
}
