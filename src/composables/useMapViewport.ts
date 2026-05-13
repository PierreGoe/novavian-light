import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMapStore, MAP_CONFIG } from '../stores/mapStore'

/** Les 3 niveaux de zoom disponibles */
export const ZOOM_PRESETS = [
  { label: 'Proche', icon: '🔍', value: 11 },
  { label: 'Normal', icon: '🗺️', value: 15 },
  { label: 'Loin', icon: '🌍', value: 20 },
] as const

export function useMapViewport() {
  const mapStore = useMapStore()

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
  const panOffset = ref({ x: 0, y: 0 })

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

  const centerOnPlayer = () => {
    const halfView = Math.floor(viewportSize.value / 2)
    viewportOffset.value = {
      x: Math.max(
        0,
        Math.min(MAP_CONFIG.size - viewportSize.value, mapStore.currentPosition.value.x - halfView),
      ),
      y: Math.max(
        0,
        Math.min(MAP_CONFIG.size - viewportSize.value, mapStore.currentPosition.value.y - halfView),
      ),
    }
    mapStore.mapState.viewportOffset = viewportOffset.value
    mapStore.saveMapState()
  }

  const startPan = (event: MouseEvent) => {
    isPanning.value = true
    panStart.value = { x: event.clientX, y: event.clientY }
    panOffset.value = { x: 0, y: 0 }
  }

  const handlePan = (event: MouseEvent) => {
    if (!isPanning.value) return
    const deltaX = event.clientX - panStart.value.x
    const deltaY = event.clientY - panStart.value.y
    const tileDeltaX = -Math.floor(deltaX / MAP_CONFIG.tileSize)
    const tileDeltaY = -Math.floor(deltaY / MAP_CONFIG.tileSize)
    if (tileDeltaX !== panOffset.value.x || tileDeltaY !== panOffset.value.y) {
      moveViewport(tileDeltaX - panOffset.value.x, tileDeltaY - panOffset.value.y)
      panOffset.value = { x: tileDeltaX, y: tileDeltaY }
    }
  }

  const endPan = () => {
    isPanning.value = false
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
    centerOnPlayer()
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyboard)
  })

  return {
    viewportOffset,
    viewportSize,
    viewportCenter,
    isPanning,
    zoomIn,
    zoomOut,
    setZoomPreset,
    currentPreset,
    moveViewport,
    centerOnPlayer,
    startPan,
    handlePan,
    endPan,
  }
}
