import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMapStore, MAP_CONFIG } from '../stores/mapStore'

/** Les 3 niveaux de zoom disponibles */
export const ZOOM_PRESETS = [
  { label: 'Proche', icon: '🔍', value: 11 },
  { label: 'Normal', icon: '🗺️', value: 15 },
  { label: 'Loin', icon: '🌍', value: 20 },
] as const

/** Vrai après le premier centrage auto de la session (état module : survit au
    démontage) — les montages suivants restaurent l'offset sauvegardé au lieu de
    re-centrer sur le joueur, pour qu'un aller-retour carte → fiche → carte ne
    perde plus la zone regardée. */
let hasAutoCenteredThisSession = false

export interface MapViewportOptions {
  /** Taille réelle d'un pas de tuile en pixels (tuile + gap), fournie par le composant
      qui connaît la taille adaptative — sinon MAP_CONFIG.tileSize (approximation). */
  tileStepPx?: () => number
}

export function useMapViewport(options: MapViewportOptions = {}) {
  const mapStore = useMapStore()
  const tileStepPx = () => options.tileStepPx?.() ?? MAP_CONFIG.tileSize

  const viewportOffset = ref({ ...mapStore.mapState.viewportOffset })
  const viewportSize = computed(() => mapStore.mapState.zoomLevel)

  const viewportCenter = computed(() => {
    const halfView = Math.floor(viewportSize.value / 2)
    return {
      x: viewportOffset.value.x + halfView,
      y: viewportOffset.value.y + halfView,
    }
  })

  const isPanning = ref(false)
  const panStart = ref({ x: 0, y: 0 })
  /** Pas entiers réellement appliqués à l'offset depuis le début du drag (clamp aux
      bords inclus) — sert à convertir le delta souris total en reliquat de translation. */
  const panOffset = ref({ x: 0, y: 0 })
  /** Déplacement (en tuiles, fractionnaire) pas encore appliqué à l'offset : translaté
      visuellement par le pan layer. Peut dépasser 1 tuile — le re-ancrage (recalcul des
      tuiles rendues) n'a lieu que lorsqu'il approche la marge tampon, pas à chaque pas. */
  const panFraction = ref({ x: 0, y: 0 })

  function zoomIn() {
    const presetValues = ZOOM_PRESETS.map((p) => p.value)
    const idx = presetValues.indexOf(viewportSize.value as (typeof presetValues)[number])
    if (idx < presetValues.length - 1) {
      mapStore.setZoomLevel(presetValues[idx + 1])
      viewportOffset.value = { ...mapStore.mapState.viewportOffset }
    }
  }

  function zoomOut() {
    const presetValues = ZOOM_PRESETS.map((p) => p.value)
    const idx = presetValues.indexOf(viewportSize.value as (typeof presetValues)[number])
    if (idx > 0) {
      mapStore.setZoomLevel(presetValues[idx - 1])
      viewportOffset.value = { ...mapStore.mapState.viewportOffset }
    }
  }

  /** Applique directement un preset de zoom par sa valeur */
  function setZoomPreset(value: number) {
    mapStore.setZoomLevel(value)
    viewportOffset.value = { ...mapStore.mapState.viewportOffset }
  }

  /** Preset actuellement actif (null si valeur intermédiaire) */
  const currentPreset = computed(
    () => ZOOM_PRESETS.find((p) => p.value === viewportSize.value) ?? null,
  )

  const moveViewport = (deltaX: number, deltaY: number) => {
    const newX = Math.max(
      0,
      Math.min(MAP_CONFIG.size - viewportSize.value, viewportOffset.value.x + deltaX),
    )
    const newY = Math.max(
      0,
      Math.min(MAP_CONFIG.size - viewportSize.value, viewportOffset.value.y + deltaY),
    )
    viewportOffset.value = { x: newX, y: newY }
    mapStore.mapState.viewportOffset = viewportOffset.value
    mapStore.saveMapState()
  }

  /** Centre le viewport sur une case arbitraire, clampé aux bords de la carte */
  const centerOnTile = (x: number, y: number) => {
    const halfView = Math.floor(viewportSize.value / 2)
    viewportOffset.value = {
      x: Math.max(0, Math.min(MAP_CONFIG.size - viewportSize.value, x - halfView)),
      y: Math.max(0, Math.min(MAP_CONFIG.size - viewportSize.value, y - halfView)),
    }
    mapStore.mapState.viewportOffset = viewportOffset.value
    mapStore.saveMapState()
  }

  const centerOnPlayer = () => {
    centerOnTile(mapStore.currentPosition.value.x, mapStore.currentPosition.value.y)
  }

  /** Seuil de re-ancrage : on ne recalcule les tuiles rendues que quand le drag a
      consommé 2 tuiles de la marge tampon (RENDER_BUFFER_TILES = 3 côté grille, il
      reste donc 1 tuile de sécurité). Entre deux re-ancrages, TOUT le déplacement
      passe par le transform du pan layer — zéro re-render pendant le geste. */
  const REANCHOR_THRESHOLD_TILES = 2

  /** Seuil (px) avant de considérer le geste comme un pan. En dessous c'est un clic :
      isPanning (donc la classe --panning et son pointer-events: none sur les tuiles)
      ne doit PAS s'activer dès le mousedown, sinon le mouseup ne cible plus la tuile
      et le navigateur ne génère jamais le click. */
  const PAN_START_THRESHOLD_PX = 4

  // Throttle rAF : la souris émet bien plus d'events que d'images affichables ;
  // une seule mutation réactive par frame suffit.
  let panRafId: number | null = null
  let lastClient = { x: 0, y: 0 }
  /** Bouton enfoncé mais pan pas encore déclenché (seuil non franchi) */
  let pointerDown = false

  const applyPan = () => {
    panRafId = null
    if (!isPanning.value) return
    const step = tileStepPx()
    const floatX = -(lastClient.x - panStart.value.x) / step
    const floatY = -(lastClient.y - panStart.value.y) / step
    let fracX = floatX - panOffset.value.x
    let fracY = floatY - panOffset.value.y
    if (
      Math.abs(fracX) >= REANCHOR_THRESHOLD_TILES ||
      Math.abs(fracY) >= REANCHOR_THRESHOLD_TILES
    ) {
      // Re-ancrage : applique les pas entiers accumulés ; le déplacement réellement
      // appliqué peut être moindre (clamp aux bords de la carte) — on ne compte que lui,
      // le pan layer (borné à la marge tampon) gèle alors visuellement le surplus.
      const before = viewportOffset.value
      moveViewport(Math.trunc(fracX), Math.trunc(fracY))
      panOffset.value = {
        x: panOffset.value.x + (viewportOffset.value.x - before.x),
        y: panOffset.value.y + (viewportOffset.value.y - before.y),
      }
      fracX = floatX - panOffset.value.x
      fracY = floatY - panOffset.value.y
    }
    panFraction.value = { x: fracX, y: fracY }
  }

  const startPan = (event: MouseEvent) => {
    pointerDown = true
    panStart.value = { x: event.clientX, y: event.clientY }
    lastClient = { x: event.clientX, y: event.clientY }
    panOffset.value = { x: 0, y: 0 }
    panFraction.value = { x: 0, y: 0 }
  }

  const handlePan = (event: MouseEvent) => {
    if (!pointerDown) return
    lastClient = { x: event.clientX, y: event.clientY }
    if (!isPanning.value) {
      const dx = event.clientX - panStart.value.x
      const dy = event.clientY - panStart.value.y
      if (Math.abs(dx) < PAN_START_THRESHOLD_PX && Math.abs(dy) < PAN_START_THRESHOLD_PX) return
      isPanning.value = true
    }
    if (panRafId === null) panRafId = requestAnimationFrame(applyPan)
  }

  const endPan = () => {
    if (!pointerDown) return
    pointerDown = false
    if (!isPanning.value) return
    if (panRafId !== null) {
      cancelAnimationFrame(panRafId)
      panRafId = null
    }
    // Applique le dernier mousemove (son rAF vient d'être annulé) avant d'arrondir
    applyPan()
    isPanning.value = false
    // Applique le reliquat au pas entier le plus proche ; le snap visuel de la
    // fraction restante est assuré par la transition CSS du pan layer.
    const roundX = Math.round(panFraction.value.x)
    const roundY = Math.round(panFraction.value.y)
    if (roundX !== 0 || roundY !== 0) moveViewport(roundX, roundY)
    panFraction.value = { x: 0, y: 0 }
  }

  const handleKeyboard = (event: KeyboardEvent) => {
    const speed = event.shiftKey ? 5 : 1
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
        event.preventDefault()
        moveViewport(0, -speed)
        break
      case 'ArrowDown':
      case 's':
        event.preventDefault()
        moveViewport(0, speed)
        break
      case 'ArrowLeft':
      case 'a':
        event.preventDefault()
        moveViewport(-speed, 0)
        break
      case 'ArrowRight':
      case 'd':
        event.preventDefault()
        moveViewport(speed, 0)
        break
      case ' ':
        event.preventDefault()
        centerOnPlayer()
        break
    }
  }

  onMounted(() => {
    viewportOffset.value = { ...mapStore.mapState.viewportOffset }
    window.addEventListener('keydown', handleKeyboard)
    // Premier montage de la session uniquement : ensuite on garde l'offset sauvegardé
    if (!hasAutoCenteredThisSession) {
      centerOnPlayer()
      hasAutoCenteredThisSession = true
    }
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyboard)
    if (panRafId !== null) cancelAnimationFrame(panRafId)
  })

  return {
    viewportOffset,
    viewportSize,
    viewportCenter,
    isPanning,
    panFraction,
    zoomIn,
    zoomOut,
    setZoomPreset,
    currentPreset,
    moveViewport,
    centerOnPlayer,
    centerOnTile,
    startPan,
    handlePan,
    endPan,
  }
}
