import type { Directive } from 'vue'

/**
 * v-clickable — rend un élément avec un handler @click natif utilisable au clavier :
 * role="button", tabindex, et Entrée/Espace déclenchent le même clic natif.
 *
 * Usage : `<div class="map-node" v-clickable @click="select(node)">`
 * Passer `false` pour désactiver temporairement (retire le focus clavier sans
 * retirer le rôle) : `v-clickable="node.accessible"`.
 */

const keydownHandlers = new WeakMap<HTMLElement, (e: KeyboardEvent) => void>()

function applyState(el: HTMLElement, clickable: boolean) {
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', clickable ? '0' : '-1')
}

export const vClickable: Directive<HTMLElement, boolean> = {
  mounted(el, binding) {
    applyState(el, binding.value !== false)

    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && el.getAttribute('tabindex') === '0') {
        e.preventDefault()
        el.click()
      }
    }
    keydownHandlers.set(el, handler)
    el.addEventListener('keydown', handler)
  },

  updated(el, binding) {
    applyState(el, binding.value !== false)
  },

  unmounted(el) {
    const handler = keydownHandlers.get(el)
    if (handler) el.removeEventListener('keydown', handler)
    keydownHandlers.delete(el)
  },
}
