// Composants de carte et exploration - Module isolé
export { default as MapExplorationView } from './MapExplorationView.vue'
export { default as MapGrid } from './MapGrid.vue'
export { default as ExplorationPanel } from './ExplorationPanel.vue'
export { default as TileDetails } from './TileDetails.vue'

// Re-export des types du store pour faciliter l'usage
export type {
  MapTile,
  TerrainType,
  ExplorationState,
  ScoutInfo,
  MapStore,
} from '../../stores/mapStore'

// Hook principal pour utiliser les fonctionnalités de carte
export { useMapStore } from '../../stores/mapStore'
