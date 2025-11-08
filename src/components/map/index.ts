// Composants de carte et exploration - Module isolé

// Composants pour petite carte (11x11)
export { default as MapExplorationView } from './MapExplorationView.vue'
export { default as MapGrid } from './MapGrid.vue'

// Composants pour grande carte (100x100) - OPTIMISÉS
export { default as LargeMapExplorationView } from './LargeMapExplorationView.vue'
export { default as LargeMapGrid } from './LargeMapGrid.vue'

// Composants communs
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
export { useMapStore, MAP_CONFIG } from '../../stores/mapStore'
