<template>
  <div class="map-layer" :class="{ 'current-layer': layer.row === currentPlayerRow }">
    <!-- Lignes de connexion -->
    <svg class="connections-svg" v-if="layer.row < totalLayers - 1">
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
            'node-in-progress': node.inProgress,
            'node-accessible': node.accessible && !node.completed && !node.inProgress,
            'node-locked': !node.accessible && !node.inProgress,
            'node-selected': node.id === selectedNodeId,
          },
        ]"
        :style="{
          left: `${node.col * 120 + 60}px`,
          backgroundColor: nodeTypeConfig[node.type].color + '40',
          borderColor: nodeTypeConfig[node.type].color,
        }"
        @click="
          node.inProgress || (node.accessible && !node.completed)
            ? emit('selectNode', node)
            : undefined
        "
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
                      : node.reward.type === 'leadership'
                        ? '👑'
                        : '?'
              }}
            </span>
            <span class="reward-text">
              {{ node.reward.name || `+${node.reward.amount}` }}
            </span>
          </div>
        </div>

        <div class="node-status">
          <span v-if="node.completed" class="status-completed">✓</span>
          <span v-else-if="node.accessible" class="status-accessible">→</span>
          <span v-else class="status-locked">🔒</span>
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
  return targetNode ? (targetNode.col + 0.5) * 120 : 60
}
</script>

<style scoped>
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

.node-in-progress {
  animation: progressPulse 1.5s infinite;
  border: 3px solid #ffd700 !important;
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

@keyframes progressPulse {
  0%,
  100% {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.9);
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

@media (max-width: 768px) {
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
}
</style>
