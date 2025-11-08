<template>
  <div class="tile-details" v-if="tile">
    <div class="tile-header">
      <h3>{{ getTileName(tile.type) }}</h3>
      <span class="tile-coordinates">({{ tile.position.x }}, {{ tile.position.y }})</span>
    </div>

    <div class="tile-icon-large">{{ getTileIcon(tile.type) }}</div>

    <p class="tile-description">{{ getTileDescription(tile.type) }}</p>

    <div v-if="tile.bonus" class="tile-bonus"><strong>💫 Bonus :</strong> {{ tile.bonus }}</div>

    <div v-if="tile.resources" class="tile-resources">
      <h4>📦 Ressources disponibles :</h4>
      <div class="resource-list">
        <div v-for="(amount, resource) in tile.resources" :key="resource" class="resource-item">
          <span class="resource-name">{{ getResourceIcon(resource) }} {{ resource }}:</span>
          <span class="resource-amount">{{ amount }}</span>
        </div>
      </div>
    </div>

    <div class="tile-actions">
      <button
        v-if="canAttackTile(tile)"
        class="action-btn attack-btn"
        @click="$emit('attackTile', tile.id)"
      >
        ⚔️ Attaquer
      </button>

      <button
        v-if="canTradeTile(tile)"
        class="action-btn trade-btn"
        @click="$emit('tradeTile', tile.id)"
      >
        🤝 Commerce
      </button>

      <button
        v-if="canExploreTile(tile)"
        class="action-btn explore-btn"
        @click="$emit('exploreTile', tile.id)"
      >
        🏛️ Explorer les ruines
      </button>

      <button class="action-btn scout-btn" @click="$emit('scoutTile', tile.id)">
        🔍 Reconnaître
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMapStore, type MapTile } from '../../stores/mapStore'

// Props
interface Props {
  tile: MapTile | null
}

defineProps<Props>()

// Emits
defineEmits<{
  attackTile: [tileId: string]
  tradeTile: [tileId: string]
  exploreTile: [tileId: string]
  scoutTile: [tileId: string]
}>()

// Store
const mapStore = useMapStore()

// Computed
const canAttackTile = (tile: MapTile) => {
  return ['village_enemy', 'stronghold'].includes(tile.type) && tile.explored
}

const canTradeTile = (tile: MapTile) => {
  return tile.type === 'village_enemy' && tile.explored
}

const canExploreTile = (tile: MapTile) => {
  return tile.type === 'ruins' && tile.explored
}

// Methods
const getTileName = (type: MapTile['type']) => {
  return mapStore.getTileName(type)
}

const getTileIcon = (type: MapTile['type']) => {
  return mapStore.getTileIcon(type)
}

const getTileDescription = (type: MapTile['type']) => {
  return mapStore.getTileDescription(type)
}

const getResourceIcon = (resource: string) => {
  const icons: Record<string, string> = {
    wood: '🪵',
    clay: '🧱',
    iron: '⚙️',
    crop: '🌾',
    gold: '💰',
  }
  return icons[resource] || '📦'
}
</script>

<style scoped>
.tile-details {
  background: #2a2a2a;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  border: 1px solid #444;
}

.tile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.tile-header h3 {
  color: #81c784;
  margin: 0;
  font-size: 1.3em;
}

.tile-coordinates {
  color: #999;
  font-size: 0.9em;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.tile-icon-large {
  text-align: center;
  font-size: 48px;
  margin: 20px 0;
}

.tile-description {
  color: #ccc;
  line-height: 1.5;
  margin: 15px 0;
  font-style: italic;
}

.tile-bonus {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.2), rgba(56, 142, 60, 0.2));
  border: 1px solid #4caf50;
  border-radius: 8px;
  padding: 12px;
  margin: 15px 0;
  color: #a5d6a7;
}

.tile-resources {
  margin: 20px 0;
}

.tile-resources h4 {
  color: #ffb74d;
  margin: 0 0 10px 0;
  font-size: 1em;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resource-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  padding: 8px 12px;
  border-radius: 6px;
}

.resource-name {
  color: #ccc;
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-amount {
  color: #81c784;
  font-weight: 600;
}

.tile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.action-btn {
  flex: 1;
  min-width: 120px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.attack-btn {
  background: linear-gradient(135deg, #f44336, #c62828);
  color: white;
}

.attack-btn:hover {
  background: linear-gradient(135deg, #c62828, #b71c1c);
  transform: translateY(-2px);
}

.trade-btn {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: white;
}

.trade-btn:hover {
  background: linear-gradient(135deg, #f57c00, #ef6c00);
  transform: translateY(-2px);
}

.explore-btn {
  background: linear-gradient(135deg, #9c27b0, #7b1fa2);
  color: white;
}

.explore-btn:hover {
  background: linear-gradient(135deg, #7b1fa2, #6a1b9a);
  transform: translateY(-2px);
}

.scout-btn {
  background: linear-gradient(135deg, #2196f3, #1976d2);
  color: white;
}

.scout-btn:hover {
  background: linear-gradient(135deg, #1976d2, #1565c0);
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .tile-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .tile-actions {
    flex-direction: column;
  }

  .action-btn {
    min-width: auto;
  }
}
</style>
