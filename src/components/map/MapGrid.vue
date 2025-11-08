<template>
  <div class="map-grid">
    <div
      v-for="tile in tiles"
      :key="tile.id"
      class="map-tile"
      :class="getTileClasses(tile)"
      @click="selectTile(tile.id)"
    >
      <div class="tile-icon">{{ getTileIcon(tile.type) }}</div>
      <div class="tile-overlay" v-if="!tile.explored">?</div>
      <div class="tile-info" v-if="tile.explored && tile.bonus">
        <span class="tile-bonus">{{ tile.bonus }}</span>
      </div>
      <div class="current-marker" v-if="tile.current">📍</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMapStore, type MapTile } from '../../stores/mapStore'

// Props
interface Props {
  tiles: MapTile[]
  selectedTileId?: string | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  selectTile: [tileId: string]
}>()

// Store
const mapStore = useMapStore()

// Computed
const getTileClasses = (tile: MapTile) => {
  return [
    `terrain-${tile.type}`,
    {
      'tile-explored': tile.explored,
      'tile-current': tile.current,
      'tile-selected': props.selectedTileId === tile.id,
      'tile-unexplored': !tile.explored,
    },
  ]
}

// Methods
const selectTile = (tileId: string) => {
  emit('selectTile', tileId)
}

const getTileIcon = (type: MapTile['type']) => {
  return mapStore.getTileIcon(type)
}
</script>

<style scoped>
.map-grid {
  display: grid;
  grid-template-columns: repeat(11, 1fr);
  gap: 4px;
  padding: 20px;
  background: #2a2a2a;
  border-radius: 12px;
  max-width: 600px;
  margin: 0 auto;
}

.map-tile {
  position: relative;
  width: 50px;
  height: 50px;
  border: 2px solid #555;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #333;
}

.map-tile:hover {
  border-color: #888;
  transform: scale(1.05);
}

.tile-explored {
  border-color: #4a9eff;
}

.tile-current {
  border-color: #ffeb3b;
  box-shadow: 0 0 10px rgba(255, 235, 59, 0.5);
}

.tile-selected {
  border-color: #ff6b35;
  box-shadow: 0 0 15px rgba(255, 107, 53, 0.7);
}

.tile-unexplored {
  background: #1a1a1a;
  opacity: 0.6;
}

/* Terrains spécifiques */
.terrain-plains {
  background: linear-gradient(135deg, #8bc34a, #689f38);
}
.terrain-forest {
  background: linear-gradient(135deg, #4caf50, #2e7d32);
}
.terrain-mountain {
  background: linear-gradient(135deg, #78909c, #455a64);
}
.terrain-water {
  background: linear-gradient(135deg, #2196f3, #1565c0);
}
.terrain-village_player {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}
.terrain-village_enemy {
  background: linear-gradient(135deg, #f44336, #c62828);
}
.terrain-ruins {
  background: linear-gradient(135deg, #9e9e9e, #424242);
}
.terrain-stronghold {
  background: linear-gradient(135deg, #673ab7, #4527a0);
}

.tile-icon {
  font-size: 20px;
  z-index: 2;
}

.tile-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  border-radius: 6px;
  z-index: 3;
}

.tile-info {
  position: absolute;
  bottom: 2px;
  right: 2px;
  z-index: 2;
}

.tile-bonus {
  font-size: 8px;
  background: rgba(76, 175, 80, 0.9);
  color: white;
  padding: 1px 3px;
  border-radius: 3px;
}

.current-marker {
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 12px;
  z-index: 4;
}
</style>
