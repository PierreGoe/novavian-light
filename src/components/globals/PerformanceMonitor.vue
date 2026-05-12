<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// --- FPS ---
const fps = ref(0)
const frameTimes = ref<number[]>([])
// --- Mémoire JS (disponible uniquement sur Chromium) ---
const memUsedMb = ref<number | null>(null)
// --- Long frames (> 50ms = moins de 20 FPS) ---
const longFrameCount = ref(0)
// --- Affichage / masquage ---
const visible = ref(false)

let rafId = 0
let lastTs = 0

function loop(ts: number) {
  if (lastTs > 0) {
    const delta = ts - lastTs

    // Historique glissant des 60 dernières frames
    frameTimes.value.push(delta)
    if (frameTimes.value.length > 60) frameTimes.value.shift()

    // FPS moyen sur la fenêtre glissante
    const avg = frameTimes.value.reduce((a, b) => a + b, 0) / frameTimes.value.length
    fps.value = Math.round(1000 / avg)

    // Compteur de frames lentes (> 50 ms)
    if (delta > 50) longFrameCount.value++

    // Mémoire (API Chrome uniquement)
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } }
    if (perf.memory) {
      memUsedMb.value = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024)
    }
  }

  lastTs = ts
  rafId = requestAnimationFrame(loop)
}

function reset() {
  longFrameCount.value = 0
  frameTimes.value = []
}

// Raccourci clavier : Shift+P pour afficher/masquer
function onKeyDown(e: KeyboardEvent) {
  if (e.shiftKey && e.key === 'P') visible.value = !visible.value
}

onMounted(() => {
  rafId = requestAnimationFrame(loop)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', onKeyDown)
})

// Couleur FPS : vert > 50, orange > 30, rouge sinon
function fpsColor(v: number) {
  if (v >= 50) return '#4ade80'
  if (v >= 30) return '#facc15'
  return '#f87171'
}
</script>

<template>
  <!-- Bouton d'accès rapide, toujours visible -->
  <button class="perf-toggle" @click="visible = !visible" title="Shift+P pour afficher/masquer">
    <span :style="{ color: fpsColor(fps) }">{{ fps }}</span> FPS
  </button>

  <Transition name="perf-slide">
    <div v-if="visible" class="perf-panel">
      <header class="perf-header">
        <span>Performance</span>
        <button class="perf-close" @click="visible = false">✕</button>
      </header>

      <div class="perf-row">
        <span class="perf-label">FPS (moy. 60f)</span>
        <span class="perf-value" :style="{ color: fpsColor(fps) }">{{ fps }}</span>
      </div>

      <div class="perf-row">
        <span class="perf-label">Frame max</span>
        <span class="perf-value">
          {{ frameTimes.length ? Math.round(Math.max(...frameTimes)) : '–' }} ms
        </span>
      </div>

      <div class="perf-row">
        <span class="perf-label">Frames lentes (&gt;50ms)</span>
        <span class="perf-value" :style="{ color: longFrameCount > 0 ? '#f87171' : '#4ade80' }">
          {{ longFrameCount }}
          <button class="perf-reset" @click="reset">reset</button>
        </span>
      </div>

      <div v-if="memUsedMb !== null" class="perf-row">
        <span class="perf-label">Mémoire JS heap</span>
        <span class="perf-value">{{ memUsedMb }} Mo</span>
      </div>
      <div v-else class="perf-row perf-dim">
        <span class="perf-label">Mémoire</span>
        <span class="perf-value">non dispo (Firefox/Safari)</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Bouton FPS toujours visible en bas à droite */
.perf-toggle {
  position: fixed;
  bottom: 12px;
  right: 12px;
  z-index: 9999;
  background: rgba(10, 10, 20, 0.85);
  border: 1px solid #333;
  color: #aaa;
  font-size: 11px;
  font-family: monospace;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: opacity 0.2s;
}
.perf-toggle:hover {
  opacity: 1;
  border-color: #666;
}

/* Panneau détaillé */
.perf-panel {
  position: fixed;
  bottom: 44px;
  right: 12px;
  z-index: 9998;
  background: rgba(10, 10, 20, 0.92);
  border: 1px solid #333;
  border-radius: 10px;
  padding: 10px 14px;
  min-width: 240px;
  font-family: monospace;
  font-size: 12px;
  color: #ccc;
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
}

.perf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8px;
  font-size: 13px;
}

.perf-close {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}
.perf-close:hover {
  color: #fff;
}

.perf-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  border-bottom: 1px solid #1a1a2e;
}
.perf-row:last-child {
  border-bottom: none;
}

.perf-label {
  color: #888;
}
.perf-value {
  font-weight: bold;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 8px;
}
.perf-dim .perf-label,
.perf-dim .perf-value {
  color: #555;
  font-weight: normal;
}

.perf-reset {
  background: none;
  border: 1px solid #444;
  color: #888;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  cursor: pointer;
}
.perf-reset:hover {
  border-color: #888;
  color: #ccc;
}

/* Transition d'apparition */
.perf-slide-enter-active,
.perf-slide-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.perf-slide-enter-from,
.perf-slide-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
