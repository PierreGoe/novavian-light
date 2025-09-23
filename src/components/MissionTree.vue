<template>
  <div class="mission-map">
    <div class="map-background"></div>

    <!-- En-tête avec progression -->
    <header class="map-header">
      <h1>Carte de Mission</h1>
      <p>Progressez à travers les dangers jusqu'au combat final</p>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <span class="progress-text">{{ Math.round(progressPercentage) }}%</span>
      </div>

      <div class="player-status" v-if="mapGenerated">
        <div class="status-item">
          <span class="status-label">Niveau:</span>
          <span class="status-value">{{ currentPlayerRow + 1 }}/{{ mapLayers.length }}</span>
        </div>
        <div class="status-item" v-if="nextAvailableNodes.length > 0">
          <span class="status-label">Choix:</span>
          <span class="status-value"
            >{{ nextAvailableNodes.length }} option{{
              nextAvailableNodes.length > 1 ? 's' : ''
            }}</span
          >
        </div>
      </div>

      <button class="reset-button" @click="resetMap" title="Nouvelle carte">🔄</button>
    </header>

    <!-- Carte verticale -->
    <main class="map-container">
      <div class="map-layers" v-if="mapGenerated">
        <div
          v-for="layer in mapLayers"
          :key="layer.row"
          class="map-layer"
          :class="{ 'current-layer': layer.row === currentPlayerRow }"
        >
          <!-- Lignes de connexion -->
          <svg class="connections-svg" v-if="layer.row < mapLayers.length - 1">
            <g v-for="node in layer.nodes" :key="node.id">
              <line
                v-for="connectionId in node.connections"
                :key="`${node.id}-${connectionId}`"
                :x1="(node.col + 0.5) * 120"
                :y1="60"
                :x2="getConnectionX(connectionId)"
                :y2="140"
                class="connection-line"
                :class="{
                  'active-connection': node.completed,
                  'accessible-connection': node.accessible,
                }"
              />
            </g>
          </svg>

          <!-- Nodes de cette ligne -->
          <div class="layer-nodes">
            <div
              v-for="node in layer.nodes"
              :key="node.id"
              class="map-node"
              :class="[
                `node-${node.type}`,
                {
                  'node-completed': node.completed,
                  'node-accessible': node.accessible && !node.completed,
                  'node-locked': !node.accessible,
                  'node-selected': node.id === selectedNodeId,
                },
              ]"
              :style="{
                left: `${node.col * 120 + 60}px`,
                backgroundColor: nodeTypeConfig[node.type].color + '40',
                borderColor: nodeTypeConfig[node.type].color,
              }"
              @click="selectNode(node)"
              :title="`${node.title}\n${node.description}`"
            >
              <div class="node-icon">{{ node.icon }}</div>
              <div class="node-info">
                <div class="node-title">{{ node.title }}</div>
                <div class="node-reward" v-if="node.reward">
                  <span class="reward-icon">
                    {{
                      node.reward.type === 'gold'
                        ? '💰'
                        : node.reward.type === 'card'
                          ? '🃏'
                          : node.reward.type === 'relic'
                            ? '💎'
                            : node.reward.type === 'health'
                              ? '❤️'
                              : '?'
                    }}
                  </span>
                  <span class="reward-text">
                    {{ node.reward.name || `+${node.reward.amount}` }}
                  </span>
                </div>
              </div>

              <!-- État du node -->
              <div class="node-status">
                <span v-if="node.completed" class="status-completed">✓</span>
                <span v-else-if="node.accessible" class="status-accessible">→</span>
                <span v-else class="status-locked">🔒</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chargement -->
      <div v-else class="loading-map">
        <div class="loading-spinner">⚔️</div>
        <p>Génération de la carte...</p>
      </div>
    </main>

    <!-- Légende et contrôles -->
    <footer class="map-footer">
      <!-- Légende des 3 voies -->
      <div class="paths-legend">
        <div class="path-indicator">
          <div class="path-line military-path"></div>
          <span>Voie Militaire</span>
        </div>
        <div class="path-indicator">
          <div class="path-line balanced-path"></div>
          <span>Voie Équilibrée</span>
        </div>
        <div class="path-indicator">
          <div class="path-line economic-path"></div>
          <span>Voie Économique</span>
        </div>
      </div>

      <div class="legend">
        <div class="legend-item">
          <span class="legend-icon" style="color: #dc143c">⚔️</span>
          <span>Combat</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #ffd700">👑</span>
          <span>Élite</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #32cd32">🏪</span>
          <span>Magasin</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #9932cc">❓</span>
          <span>Événement</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #4169e1">🏕️</span>
          <span>Repos</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon" style="color: #8b0000">💀</span>
          <span>Boss</span>
        </div>
      </div>

      <button class="home-button" @click="goHome">🏠 Retour à l'accueil</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useToastStore } from '@/stores/toastStore'
import { generateMap, nodeTypeConfig, type MapNode, type MapLayer } from '@/utils'

const router = useRouter()
const gameStore = useGameStore()
const toastStore = useToastStore()

// État de la map
const mapLayers = ref<MapLayer[]>([])
const currentPlayerRow = ref<number>(0)
const selectedNodeId = ref<string>('')
const mapGenerated = ref<boolean>(false)

// Computed
const progressPercentage = computed(() => {
  const totalNodes = mapLayers.value.reduce((sum, layer) => sum + layer.nodes.length, 0)
  const completedNodes = mapLayers.value.reduce(
    (sum, layer) => sum + layer.nodes.filter((node) => node.completed).length,
    0,
  )
  return totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0
})

const allNodes = computed(() => {
  const nodes: MapNode[] = []
  mapLayers.value.forEach((layer) => {
    nodes.push(...layer.nodes)
  })
  return nodes
})

// Méthodes de génération et initialisation
const initializeMap = () => {
  if (!mapGenerated.value) {
    mapLayers.value = generateMap()
    // Rendre accessible le node unique de la première ligne
    if (mapLayers.value.length > 0 && mapLayers.value[0].nodes.length > 0) {
      const firstLayer = mapLayers.value[0]
      // Il n'y a qu'un seul node dans la première ligne (index 0)
      firstLayer.nodes[0].accessible = true
      currentPlayerRow.value = 0
    }
    mapGenerated.value = true
    saveMapState()
  }
}

// Navigation et sélection des nodes
const selectNode = (node: MapNode) => {
  if (!node.accessible || node.completed) return

  // Marquer le node comme complété et sélectionné
  selectedNodeId.value = node.id
  node.completed = true
  currentPlayerRow.value = node.row

  // IMPORTANT: Rendre inaccessibles tous les autres nodes de la même ligne
  // pour empêcher le joueur de revenir en arrière
  const currentLayer = mapLayers.value.find((layer) => layer.row === node.row)
  if (currentLayer) {
    currentLayer.nodes.forEach((layerNode) => {
      if (layerNode.id !== node.id && !layerNode.completed) {
        layerNode.accessible = false
      }
    })
  }

  // Rendre accessibles UNIQUEMENT les nodes directement connectés à ce node
  node.connections.forEach((connectionId) => {
    const nextNode = allNodes.value.find((n) => n.id === connectionId)
    if (nextNode && !nextNode.completed) {
      nextNode.accessible = true
    }
  })

  saveMapState()

  // Simuler le combat/événement
  handleNodeAction(node)
}

const handleNodeAction = (node: MapNode) => {
  switch (node.type) {
    case 'combat':
    case 'elite':
      // Simulation d'un combat
      setTimeout(() => {
        toastStore.showSuccess(
          `Victoire contre ${node.title}! Récompense: ${node.reward?.type} ${node.reward?.amount || node.reward?.name || ''}`,
          { duration: 5000 },
        )
        if (node.reward?.type === 'gold') {
          // Ajouter la récompense d'or à l'inventaire du joueur
          gameStore.addGold(node.reward.amount || 0)
        } else if (node.reward?.type === 'relic' && node.type === 'elite') {
          // Donner un artefact aléatoire pour les combats élites
          giveRandomArtifact()
        }
      }, 500)
      break

    case 'shop':
      toastStore.showInfo(
        `${node.title} - Magasin ouvert! Vous pouvez acheter des améliorations.`,
        { duration: 4000 },
      )
      break

    case 'event':
      toastStore.showInfo(
        `${node.title} - ${node.description} Récompense: ${node.reward?.type} ${node.reward?.name || node.reward?.amount || ''}`,
        { duration: 6000 },
      )
      break

    case 'rest':
      toastStore.showSuccess(
        `${node.title} - Vous récupérez ${node.reward?.amount || 0} points de vie.`,
        { duration: 4000 },
      )
      break

    case 'boss':
      toastStore.showSuccess(`${node.title} - Bravo! Vous avez terminé cette carte!`, {
        duration: 7000,
      })
      // Naviguer vers le jeu principal
      gameStore.gameState.currentGameSection = 'completed-map'
      gameStore.saveGame()
      setTimeout(() => {
        router.push('/game/victory')
      }, 1000) // Petit délai pour laisser le temps de voir le toast
      break
  }
}

// Sauvegarde et chargement
const saveMapState = () => {
  const mapData = {
    layers: mapLayers.value,
    currentRow: currentPlayerRow.value,
    selectedNode: selectedNodeId.value,
    generated: mapGenerated.value,
  }
  localStorage.setItem('minitravian-map-state', JSON.stringify(mapData))
}

const loadMapState = () => {
  const saved = localStorage.getItem('minitravian-map-state')
  if (saved) {
    const mapData = JSON.parse(saved)
    mapLayers.value = mapData.layers || []
    currentPlayerRow.value = mapData.currentRow || 0
    selectedNodeId.value = mapData.selectedNode || ''
    mapGenerated.value = mapData.generated || false
  }
}

const resetMap = () => {
  mapLayers.value = []
  currentPlayerRow.value = 0
  selectedNodeId.value = ''
  mapGenerated.value = false
  localStorage.removeItem('minitravian-map-state')
  initializeMap()
}

// Chemin parcouru par le joueur
// Prochains nodes accessibles
const nextAvailableNodes = computed(() => {
  const accessible: MapNode[] = []
  mapLayers.value.forEach((layer) => {
    layer.nodes.forEach((node) => {
      if (node.accessible && !node.completed) {
        accessible.push(node)
      }
    })
  })
  return accessible
})

// Calcul de position pour les connexions visuelles
const getConnectionX = (connectionId: string) => {
  const targetNode = allNodes.value.find((n) => n.id === connectionId)
  if (targetNode) {
    return (targetNode.col + 0.5) * 120
  }
  return 60
}

const goHome = () => {
  router.push('/')
}

// Fonction pour donner un artefact aléatoire
const giveRandomArtifact = () => {
  const randomArtifacts = [
    {
      id: `artifact-${Date.now()}`,
      name: 'Amulette de Fortune',
      type: 'accessory' as const,
      icon: '🧿',
      description: 'Une amulette qui améliore les gains économiques.',
      effects: {
        economy: 5,
      },
      rarity: 'rare' as const,
      obtainedFrom: 'Victoire contre un champion élite',
    },
    {
      id: `artifact-${Date.now()}-2`,
      name: 'Anneau de Commandement',
      type: 'accessory' as const,
      icon: '💍',
      description: 'Un anneau qui renforce le leadership militaire.',
      effects: {
        military: 4,
        defense: 2,
      },
      rarity: 'rare' as const,
      obtainedFrom: 'Victoire contre un champion élite',
    },
    {
      id: `artifact-${Date.now()}-3`,
      name: 'Relique Ancienne',
      type: 'relic' as const,
      icon: '🏺',
      description: 'Un artefact mystérieux aux pouvoirs inconnus.',
      effects: {
        economy: 2,
        military: 2,
        defense: 2,
      },
      rarity: 'epic' as const,
      obtainedFrom: 'Victoire contre un champion élite',
    },
  ]

  const randomArtifact = randomArtifacts[Math.floor(Math.random() * randomArtifacts.length)]
  gameStore.addArtifact(randomArtifact)

  toastStore.showSuccess(
    `Nouvel artefact obtenu: ${randomArtifact.name}! Consultez votre inventaire pour l'équiper.`,
    { duration: 6000 },
  )
}

onMounted(() => {
  loadMapState()
  initializeMap()
})
</script>

<style scoped>
.mission-map {
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  color: #f4e4bc;
  position: relative;
  overflow-x: auto;
}

.map-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(218, 165, 32, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(139, 69, 19, 0.03) 0%, transparent 50%);
  pointer-events: none;
}

.map-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.map-header h1 {
  font-size: 1.8rem;
  margin: 0;
  color: #daa520;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
}

.map-header p {
  font-size: 0.9rem;
  margin: 0.25rem 0 0;
  opacity: 0.8;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  max-width: 300px;
  margin: 0 2rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(139, 69, 19, 0.5);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #daa520, #ffd700);
  transition: width 0.5s ease;
}

.progress-text {
  font-size: 0.9rem;
  font-weight: bold;
  color: #daa520;
  min-width: 40px;
}

.player-status {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(139, 69, 19, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(218, 165, 32, 0.3);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.status-label {
  color: #daa520;
  font-weight: bold;
}

.status-value {
  color: #f4e4bc;
}

.reset-button {
  background: rgba(139, 69, 19, 0.4);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.reset-button:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
}

.map-container {
  padding: 2rem;
  position: relative;
  z-index: 1;
}

.map-layers {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: fit-content;
  margin: 0 auto;
}

.map-layer {
  position: relative;
  height: 160px;
  min-width: 600px;
  display: flex;
  flex-direction: column;
}

.current-layer {
  background: rgba(218, 165, 32, 0.05);
  border-radius: 10px;
}

.connections-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 160px;
  pointer-events: none;
  z-index: 1;
}

.connection-line {
  stroke: rgba(139, 69, 19, 0.4);
  stroke-width: 2;
  transition: all 0.3s ease;
}

.active-connection {
  stroke: #daa520;
  stroke-width: 3;
}

.accessible-connection {
  stroke: rgba(218, 165, 32, 0.6);
  stroke-width: 2;
  stroke-dasharray: 5, 5;
}

.layer-nodes {
  position: relative;
  height: 120px;
  z-index: 2;
}

.map-node {
  position: absolute;
  width: 100px;
  height: 100px;
  border: 3px solid;
  border-radius: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
  margin-left: -50px;
}

.node-combat {
  border-color: #dc143c;
}
.node-elite {
  border-color: #ffd700;
}
.node-shop {
  border-color: #32cd32;
}
.node-event {
  border-color: #9932cc;
}
.node-rest {
  border-color: #4169e1;
}
.node-boss {
  border-color: #8b0000;
  width: 120px;
  height: 120px;
  border-width: 4px;
}

.node-accessible {
  cursor: pointer;
  animation: pulse 2s infinite;
}

.node-accessible:hover {
  transform: scale(1.1);
  box-shadow: 0 5px 20px rgba(218, 165, 32, 0.4);
}

.node-completed {
  opacity: 0.7;
  background: rgba(34, 139, 34, 0.2) !important;
  border-color: #228b22 !important;
}

.node-locked {
  opacity: 0.3;
  cursor: not-allowed;
  filter: grayscale(100%);
}

.node-selected {
  animation: selectedPulse 1s infinite;
  border-width: 4px;
}

.node-icon {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

.node-info {
  text-align: center;
  font-size: 0.7rem;
}

.node-title {
  font-weight: bold;
  margin-bottom: 0.25rem;
  line-height: 1;
}

.node-reward {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6rem;
  opacity: 0.8;
}

.reward-icon {
  font-size: 0.8rem;
}

.node-status {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: bold;
}

.status-completed {
  background: #228b22;
  color: white;
}

.status-accessible {
  background: #daa520;
  color: white;
}

.status-locked {
  background: #666;
  color: #999;
}

.loading-map {
  text-align: center;
  padding: 4rem 2rem;
}

.loading-spinner {
  font-size: 4rem;
  animation: spin 2s linear infinite;
  margin-bottom: 1rem;
}

.map-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  background: rgba(0, 0, 0, 0.4);
  border-top: 1px solid rgba(218, 165, 32, 0.3);
  position: sticky;
  bottom: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.paths-legend {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
}

.path-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.path-line {
  width: 40px;
  height: 4px;
  border-radius: 2px;
}

.military-path {
  background: linear-gradient(90deg, #dc143c, #ff6b6b);
}

.balanced-path {
  background: linear-gradient(90deg, #daa520, #ffd700);
}

.economic-path {
  background: linear-gradient(90deg, #32cd32, #98fb98);
}

.legend {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
}

.legend-icon {
  font-size: 1.2rem;
}

.home-button {
  background: rgba(139, 69, 19, 0.4);
  border: 1px solid #8b4513;
  color: #f4e4bc;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.home-button:hover {
  background: rgba(218, 165, 32, 0.3);
  border-color: #daa520;
}

/* Animations */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(218, 165, 32, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(218, 165, 32, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(218, 165, 32, 0);
  }
}

@keyframes selectedPulse {
  0%,
  100% {
    border-color: inherit;
  }
  50% {
    border-color: #ffd700;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .map-header {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .progress-container {
    margin: 0;
    max-width: none;
  }

  .player-status {
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-item {
    justify-content: space-between;
    width: 100%;
  }

  .map-container {
    padding: 1rem;
    overflow-x: auto;
  }

  .map-layer {
    min-width: 400px;
  }

  .map-node {
    width: 80px;
    height: 80px;
  }

  .node-boss {
    width: 90px;
    height: 90px;
  }

  .node-icon {
    font-size: 1.5rem;
  }

  .legend {
    gap: 1rem;
  }

  .paths-legend {
    flex-direction: column;
    gap: 1rem;
  }

  .path-indicator {
    justify-content: space-between;
  }

  .map-footer {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
