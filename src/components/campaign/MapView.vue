<template>
  <div class="map-view">
    <header class="map-header">
      <h2>Carte et Exploration</h2>
      <div class="map-controls">
        <button class="btn-explore" :disabled="!canExplore" @click="explore">🧭 Explorer</button>
        <button class="btn-scout" @click="scout">🔎 Reconnaître</button>
      </div>
    </header>

    <!-- Zone de carte simple -->
    <section class="map-area">
      <div class="terrain-grid">
        <!-- Hexagones de terrain simplifiés -->
        <div
          v-for="(tile, index) in mapTiles"
          :key="index"
          class="terrain-tile"
          :class="[
            `terrain-${tile.type}`,
            { 'tile-explored': tile.explored, 'tile-current': tile.current },
          ]"
          @click="selectTile(tile, index)"
        >
          <div class="tile-icon">{{ getTileIcon(tile.type) }}</div>
          <div class="tile-info" v-if="tile.explored">
            <div class="tile-name">{{ getTileName(tile.type) }}</div>
            <div class="tile-bonus" v-if="tile.bonus">{{ tile.bonus }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Informations sur la zone sélectionnée -->
    <section class="selected-area" v-if="selectedTile">
      <h3>{{ getTileName(selectedTile.type) }}</h3>
      <p class="area-description">{{ getTileDescription(selectedTile.type) }}</p>

      <div class="area-actions" v-if="selectedTile.explored">
        <!-- Actions selon le type de terrain -->
        <button
          v-if="selectedTile.type === 'village_player'"
          class="action-btn info-btn"
          @click="manageVillage"
        >
          🏠 Gérer le village
        </button>

        <button
          v-if="selectedTile.type === 'village_enemy'"
          class="action-btn combat-btn"
          @click="attackEnemyVillage"
        >
          ⚔️ Attaquer le village (Niv. {{ selectedTile.enemyLevel }})
        </button>

        <button
          v-if="selectedTile.type === 'empty'"
          class="action-btn explore-btn"
          @click="exploreEmptyTile"
        >
          🔍 Explorer la zone
        </button>
      </div>
    </section>

    <!-- Mini-légende -->
    <footer class="map-legend">
      <div class="legend-item">
        <span class="legend-icon">{{ getTileIcon('village_player') }}</span>
        <span>Votre Village</span>
      </div>
      <div class="legend-item">
        <span class="legend-icon">{{ getTileIcon('village_enemy') }}</span>
        <span>Village Ennemi</span>
      </div>
      <div class="legend-item">
        <span class="legend-icon">{{ getTileIcon('empty') }}</span>
        <span>Terrain Vide</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { useToastStore } from '@/stores/toastStore'

const missionStore = useMissionStore()
const toastStore = useToastStore()

// Types
interface MapTile {
  type: 'village_player' | 'village_enemy' | 'empty'
  explored: boolean
  current: boolean
  coordinates: { x: number; y: number }
  bonus?: string
  enemyLevel?: number
}

// State
const selectedTile = ref<MapTile | null>(null)

// Génération de carte 5x5 centrée sur le village du joueur
const mapTiles = ref<MapTile[]>([])

// Computed
const canExplore = computed(() => {
  return (missionStore.town.value?.units?.length || 0) > 0
})

// Methods
const generateMap = () => {
  const tiles: MapTile[] = []

  // Créer une grille 5x5 centrée sur (0,0)
  // Les coordonnées vont de (-2,-2) à (2,2)
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      const isPlayerVillage = x === 0 && y === 0
      const distanceFromCenter = Math.abs(x) + Math.abs(y) // Distance Manhattan

      let tileType: MapTile['type']
      let enemyLevel: number | undefined

      if (isPlayerVillage) {
        tileType = 'village_player'
      } else {
        // 60% de chance d'avoir un village ennemi, 40% case vide
        const hasEnemyVillage = Math.random() < 0.6

        if (hasEnemyVillage) {
          tileType = 'village_enemy'
          // Niveau d'ennemi basé sur la distance (plus loin = plus fort)
          enemyLevel = Math.min(distanceFromCenter, 3)
        } else {
          tileType = 'empty'
        }
      }

      tiles.push({
        type: tileType,
        explored: isPlayerVillage, // Seul le village du joueur est exploré au début
        current: isPlayerVillage, // On commence sur notre village
        coordinates: { x, y },
        bonus: tileType === 'village_enemy' ? `Niveau ${enemyLevel}` : undefined,
        enemyLevel,
      })
    }
  }

  mapTiles.value = tiles
}

const getTileIcon = (type: string): string => {
  const icons = {
    village_player: '🏠',
    village_enemy: '🏴‍☠️',
    empty: '🟫',
  }
  return icons[type as keyof typeof icons] || '❓'
}

const getTileName = (type: string): string => {
  const names = {
    village_player: 'Votre Village',
    village_enemy: 'Village Ennemi',
    empty: 'Terrain Vide',
  }
  return names[type as keyof typeof names] || 'Inconnu'
}

const getTileDescription = (type: string): string => {
  const descriptions = {
    village_player: 'Votre village prospère. Centre de votre empire en expansion.',
    village_enemy: 'Un village ennemi fortifié. Attaquez-le pour étendre votre territoire.',
    empty: 'Un terrain vide. Peut-être y a-t-il des ressources cachées à découvrir.',
  }
  return descriptions[type as keyof typeof descriptions] || 'Terrain mystérieux.'
}

const selectTile = (tile: MapTile, index: number) => {
  if (!tile.explored) {
    toastStore.showWarning("Zone non explorée. Envoyez d'abord une expédition.", { duration: 2000 })
    return
  }

  selectedTile.value = tile

  // Marquer comme position actuelle
  mapTiles.value.forEach((t) => (t.current = false))
  mapTiles.value[index].current = true
}

const explore = () => {
  if (!canExplore.value) {
    toastStore.showError("Vous avez besoin d'unités pour explorer.", { duration: 2000 })
    return
  }

  // Explorer les cases adjacentes non explorées
  const unexploredCount = mapTiles.value.filter((t) => !t.explored).length
  if (unexploredCount === 0) {
    toastStore.showInfo('Toute la zone a été explorée !', { duration: 2000 })
    return
  }

  // Explorer une case aléatoire
  const unexploredTiles = mapTiles.value
    .map((tile, index) => ({ tile, index }))
    .filter(({ tile }) => !tile.explored)

  if (unexploredTiles.length > 0) {
    const randomTile = unexploredTiles[Math.floor(Math.random() * unexploredTiles.length)]
    randomTile.tile.explored = true

    toastStore.showSuccess(`Nouvelle zone découverte: ${getTileName(randomTile.tile.type)}!`, {
      duration: 3000,
    })
  }
}

const scout = () => {
  toastStore.showInfo('Reconnaissance en cours... Informations tactiques mises à jour.', {
    duration: 2000,
  })
}

// Actions village-based
const manageVillage = () => {
  if (selectedTile.value?.type === 'village_player') {
    toastStore.showInfo('🏠 Vous gérez maintenant votre village !', { duration: 2000 })
    // Ici on pourrait basculer vers une vue de gestion du village
  }
}

const attackEnemyVillage = () => {
  if (selectedTile.value?.type === 'village_enemy') {
    const enemyLevel = selectedTile.value.enemyLevel || 1
    toastStore.showWarning(`⚔️ Attaque lancée contre le village ennemi niveau ${enemyLevel} !`, {
      duration: 2000,
    })
    // Système de combat à implémenter
  }
}

const exploreEmptyTile = () => {
  if (selectedTile.value?.type === 'empty') {
    // Possibilité de trouver des ressources ou de construire
    const foundResources = Math.random() > 0.5
    if (foundResources) {
      const resourceTypes = ['wood', 'clay', 'iron', 'crop'] as const
      const randomResource = resourceTypes[Math.floor(Math.random() * resourceTypes.length)]
      const amount = Math.floor(Math.random() * 20) + 5
      missionStore.addResources({ [randomResource]: amount })
      toastStore.showSuccess(`🎁 Ressources trouvées : +${amount} ${randomResource} !`, {
        duration: 2000,
      })
    } else {
      toastStore.showInfo('🔍 Zone explorée, mais rien de particulier trouvé.', { duration: 2000 })
    }
  }
}

// Lifecycle
onMounted(() => {
  generateMap()
})
</script>

<style scoped>
.map-view {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
}

.map-header h2 {
  margin: 0;
  color: #daa520;
  font-size: 1.5rem;
}

.map-controls {
  display: flex;
  gap: 1rem;
}

.btn-explore,
.btn-scout {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid #22c55e;
  color: #22c55e;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.btn-explore:hover:not(:disabled),
.btn-scout:hover {
  background: rgba(34, 197, 94, 0.3);
}

.btn-explore:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.map-area {
  margin-bottom: 2rem;
}

.terrain-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
  max-width: 400px;
  margin: 0 auto;
  padding: 0 0 2rem;
}

.terrain-tile {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  padding: 0.5rem;
  background: rgba(139, 69, 19, 0.1);
}

.terrain-tile:not(.tile-explored) {
  opacity: 0.3;
  background: rgba(0, 0, 0, 0.2);
}

.terrain-tile.tile-explored {
  border-color: rgba(218, 165, 32, 0.3);
}

.terrain-tile.tile-current {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.terrain-tile:hover.tile-explored {
  border-color: #daa520;
  transform: scale(1.05);
}

.tile-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.tile-info {
  text-align: center;
}

.tile-name {
  font-size: 0.7rem;
  font-weight: bold;
  color: #f4e4bc;
  line-height: 1;
}

.tile-bonus {
  font-size: 0.6rem;
  color: #dc143c;
  margin-top: 0.1rem;
}

.selected-area {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(218, 165, 32, 0.3);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.selected-area h3 {
  margin: 0 0 0.5rem 0;
  color: #daa520;
  font-size: 1.2rem;
}

.area-description {
  margin: 0 0 1rem 0;
  color: #f4e4bc;
  opacity: 0.9;
  line-height: 1.4;
}

.area-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.gather-btn {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid #22c55e;
  color: #22c55e;
}

.gather-btn:hover {
  background: rgba(34, 197, 94, 0.3);
  transform: translateY(-2px);
}

.combat-btn {
  background: rgba(220, 20, 60, 0.2);
  border: 1px solid #dc143c;
  color: #dc143c;
}

.combat-btn:hover {
  background: rgba(220, 20, 60, 0.3);
  transform: translateY(-2px);
}

.map-legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  padding-top: 1rem;
  border-top: 1px solid rgba(218, 165, 32, 0.3);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #f4e4bc;
}

.legend-icon {
  font-size: 1rem;
}

/* Responsive */
@media (max-width: 768px) {
  .terrain-grid {
    max-width: 300px;
  }

  .map-header {
    flex-direction: column;
    gap: 1rem;
  }

  .area-actions {
    flex-direction: column;
  }
}
</style>
