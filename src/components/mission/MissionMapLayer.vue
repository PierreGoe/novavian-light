<template>
  <div class="map-layer" :class="{ 'current-layer': layer.row === currentPlayerRow }">
    <!-- Lignes de connexion -->
    <svg class="connections-svg" v-if="layer.row < totalLayers - 1">
      <g v-for="node in layer.nodes" :key="node.id">
        <line
          v-for="connectionId in node.connections"
          :key="`${node.id}-${connectionId}`"
          :x1="(node.col + 0.5) * 240"
          :y1="100"
          :x2="getConnectionX(connectionId)"
          :y2="260"
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
            'node-in-progress': node.inProgress,
            'node-accessible': node.accessible && !node.completed && !node.inProgress,
            'node-locked': !node.accessible && !node.inProgress,
            'node-selected': node.id === selectedNodeId,
          },
        ]"
        :style="{ left: `${node.col * 240 + 120}px` }"
        @click="
          node.inProgress || (node.accessible && !node.completed)
            ? emit('selectNode', node)
            : undefined
        "
        :title="`${node.title}\n${node.description}`"
      >
        <!-- Badge statut en haut-droite -->
        <div class="node-status">
          <span v-if="node.completed" class="status-completed">✓</span>
          <span v-else-if="node.accessible" class="status-accessible">→</span>
          <span v-else class="status-locked">🔒</span>
        </div>

        <!-- Corps : icône + titre -->
        <div class="node-body">
          <div class="node-icon">{{ node.icon }}</div>
          <div class="node-title">{{ node.title }}</div>
        </div>

        <!-- Pied de carte : sections verticales séparées -->
        <div class="node-footer" v-if="node.reward || getNodeDifficultyLabel(node.type)">
          <div class="footer-section footer-section--reward" v-if="node.reward">
            <span class="section-label">Récompense</span>
            <span class="chip chip--reward">
              {{ getRewardIcon(node.reward.type) }}
              {{ node.reward.name || `+${node.reward.amount}` }}
            </span>
          </div>
          <div
            class="footer-sep"
            v-if="node.reward && getNodeDifficultyLabel(node.type)"
          ></div>
          <div class="footer-section footer-section--vp" v-if="getNodeDifficultyLabel(node.type)">
            <span class="section-label">Difficulté</span>
            <span class="chip chip--vp">⚔️ {{ getNodeDifficultyLabel(node.type) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nodeTypeConfig } from '@/utils'
import type { MapNode, MapLayer } from '@/stores/gameStore'

const props = defineProps<{
  layer: MapLayer
  currentPlayerRow: number
  totalLayers: number
  selectedNodeId: string
  allNodes: MapNode[]
}>()

const emit = defineEmits<{ selectNode: [node: MapNode] }>()

const getConnectionX = (connectionId: string) => {
  const targetNode = props.allNodes.find((n) => n.id === connectionId)
  return targetNode ? (targetNode.col + 0.5) * 240 : 120
}

/**
 * Libellé de difficulté affiché sur le nœud. Ne promet pas de PV garantis : les points de
 * victoire viennent des actions sur la carte d'exploration, pas de la complétion du nœud
 * lui-même (voir gameStore.handleMapNodeAction).
 */
const getNodeDifficultyLabel = (nodeType: MapNode['type']): string => {
  switch (nodeType) {
    case 'combat': return 'Moyenne'
    case 'elite':  return 'Élite'
    default:       return ''
  }
}

/** Icône emoji selon le type de récompense */
const getRewardIcon = (type: string): string => {
  switch (type) {
    case 'gold':       return '💰'
    case 'card':       return '🃏'
    case 'relic':      return '💎'
    case 'leadership': return '👑'
    default:           return '?'
  }
}
</script>

<style scoped>
/* ─── Couche (ligne de la map) ─────────────────────────── */
.map-layer {
  position: relative;
  height: 290px;
  min-width: 640px;
  display: flex;
  flex-direction: column;
}
.current-layer {
  background: rgba(218, 165, 32, 0.05);
  border-radius: 10px;
}

/* ─── Lignes de connexion SVG ───────────────────────────── */
.connections-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 290px;
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

/* ─── Conteneur des nœuds ───────────────────────────────── */
.layer-nodes {
  position: relative;
  height: 220px;
  z-index: 2;
}

/* ─── Carte de nœud ─────────────────────────────────────── */
.map-node {
  position: absolute;
  width: 210px;
  height: 200px;
  border: 2px solid;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
  margin-left: -105px;
  overflow: hidden;
  background: rgba(12, 9, 4, 0.88);
}

/* Corps : icône + titre (prend tout l'espace disponible) */
.node-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 6px 4px;
  gap: 4px;
  min-height: 0;
}
.node-icon {
  font-size: 3rem;
  line-height: 1;
}
.node-title {
  font-size: 0.85rem;
  font-weight: bold;
  text-align: center;
  color: #f0e6d3;
  line-height: 1.3;
}

/* Pied de carte : sections verticales */
.node-footer {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.footer-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 10px;
}
.section-label {
  font-size: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
  color: #f0e6d3;
}
.footer-sep {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 10px;
}
.chip {
  border-radius: 5px;
  padding: 3px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}
.chip--reward {
  background: rgba(218, 165, 32, 0.15);
  border: 1px solid rgba(218, 165, 32, 0.4);
  color: #c8961a;
}
.chip--vp {
  background: rgba(220, 20, 60, 0.12);
  border: 1px solid rgba(220, 20, 60, 0.45);
  color: #e85570;
}

/* ─── Couleurs par type ─────────────────────────────────── */
.node-combat { border-color: #dc143c; }
.node-elite  { border-color: #ffd700; }
.node-shop   { border-color: #32cd32; }
.node-event  { border-color: #9932cc; }
.node-rest   { border-color: #4169e1; }
.node-boss   { border-color: #8b0000; border-width: 3px; }

/* ─── États ─────────────────────────────────────────────── */
.node-accessible {
  cursor: pointer;
  animation: pulse 2s infinite;
}
.node-accessible:hover {
  transform: scale(1.08);
  box-shadow: 0 5px 20px rgba(218, 165, 32, 0.4);
}
.node-completed {
  opacity: 0.65;
  background: rgba(34, 139, 34, 0.2) !important;
  border-color: #228b22 !important;
}
.node-in-progress {
  animation: progressPulse 1.5s infinite;
  border: 2px solid #ffd700 !important;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
  cursor: default;
}
.node-in-progress::after {
  content: '⚔️ EN COURS';
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  background: #ffd700;
  color: #1a1a1a;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: bold;
  white-space: nowrap;
}
.node-locked {
  opacity: 0.3;
  cursor: not-allowed;
  filter: grayscale(100%);
}
.node-selected {
  animation: selectedPulse 1s infinite;
  border-width: 3px;
}

/* ─── Badge statut (coin haut-droite) ───────────────────── */
.node-status {
  position: absolute;
  top: -11px;
  right: -11px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: bold;
  z-index: 5;
}
.status-completed { background: #228b22; color: white; }
.status-accessible { background: #daa520; color: white; }
.status-locked { background: #444; color: #888; }

/* ─── Animations ─────────────────────────────────────────── */
@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(218, 165, 32, 0.7); }
  70%  { box-shadow: 0 0 0 10px rgba(218, 165, 32, 0); }
  100% { box-shadow: 0 0 0 0 rgba(218, 165, 32, 0); }
}
@keyframes progressPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.6); }
  50%       { box-shadow: 0 0 30px rgba(255, 215, 0, 0.9); }
}
@keyframes selectedPulse {
  0%, 100% { border-color: inherit; }
  50%       { border-color: #ffd700; }
}

/* ─── Responsive ─────────────────────────────────────────── */
@media (max-width: 768px) {
  .map-layer { min-width: 400px; }
  .map-node  { width: 150px; height: 150px; margin-left: -75px; }
  .node-icon { font-size: 2.2rem; }
  .node-title { font-size: 0.7rem; }
  .chip { font-size: 0.6rem; }
}
</style>
