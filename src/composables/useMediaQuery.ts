import { ref, onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Réactivité sur une media query CSS (ex. '(max-width: 1200px)').
 * Retourne un ref booléen mis à jour quand la fenêtre traverse le seuil.
 */
export function useMediaQuery(query: string): Ref<boolean> {
  // Environnements sans matchMedia (jsdom en tests) : valeur figée à false.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return ref(false)
  }

  const mql = window.matchMedia(query)
  const matches = ref(mql.matches)
  const onChange = (e: MediaQueryListEvent) => {
    matches.value = e.matches
  }

  onMounted(() => mql.addEventListener('change', onChange))
  onUnmounted(() => mql.removeEventListener('change', onChange))

  return matches
}

/**
 * Palier "desktop étroit" (tablette paysage, petits laptops) : entre le breakpoint
 * mobile (768px, où les sidebars disparaissent au profit de la bottom nav) et 1200px.
 * Sur ce palier, SideNavBar et TimersPanel sont forcés en mode replié (64px) pour
 * laisser la place au contenu. Les offsets correspondants côté layout sont appliqués
 * en CSS pur dans App.vue (.app-content) et CampaignLayout.vue (.campaign-view).
 */
export const NARROW_DESKTOP_QUERY = '(min-width: 769px) and (max-width: 1200px)'
