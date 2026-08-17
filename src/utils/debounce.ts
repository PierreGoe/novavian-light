/** Fonction debouncée, avec possibilité de forcer l'exécution immédiate (flush). */
export interface Debounced {
  (): void
  /** Exécute immédiatement l'appel en attente (s'il y en a un) et annule le timer. */
  flush: () => void
}

/**
 * Retarde l'exécution de `fn` de `waitMs` après le dernier appel.
 * Les appels rapprochés (ex : plusieurs mutations dans la même seconde)
 * sont ainsi coalescés en une seule exécution.
 */
export function debounce(fn: () => void, waitMs: number): Debounced {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = (() => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      timeoutId = null
      fn()
    }, waitMs)
  }) as Debounced

  debounced.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
      fn()
    }
  }

  return debounced
}
