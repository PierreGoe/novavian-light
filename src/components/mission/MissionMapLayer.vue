<template>
  <div class="map-layer" :style="{ zIndex: isLayerActive ? 20 : 1 }">
    <div class="layer-nodes" :style="{ width: `${MAP_WIDTH}px` }">
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
            'node-open': activeNodeId === node.id,
          },
        ]"
        :style="{ left: `${nodeCenterX(node)}px` }"
        tabindex="0"
        @click="emit('toggleNode', node)"
        @keydown.enter="emit('toggleNode', node)"
      >
        <!-- Badge statut en haut-droite -->
        <div class="node-status">
          <span v-if="node.completed" class="status-completed">✓</span>
          <span v-else-if="node.inProgress" class="status-in-progress">⚔️</span>
          <span v-else-if="node.accessible" class="status-accessible">→</span>
          <span v-else class="status-locked">🔒</span>
        </div>

        <!-- Corps : icône seule -->
        <div class="node-icon">{{ node.icon }}</div>

        <!-- Détails : affichés uniquement au clic -->
        <Transition name="popover">
          <div v-if="activeNodeId === node.id" class="node-popover" @click.stop>
            <strong class="popover-title">{{ node.title }}</strong>
            <p class="popover-description">{{ node.description }}</p>

            <div class="popover-badges" v-if="node.reward || getNodeDifficultyLabel(node.type)">
              <Badge tone="accent" v-if="node.reward">
                {{ getRewardIcon(node.reward.type) }}
                {{ node.reward.name || `+${node.reward.amount}` }}
              </Badge>
              <Badge tone="danger" v-if="getNodeDifficultyLabel(node.type)">
                ⚔️ {{ getNodeDifficultyLabel(node.type) }}
              </Badge>
            </div>

            <p
              v-if="!node.accessible && !node.completed && !node.inProgress"
              class="popover-locked"
            >
              🔒 Terminez un nœud connecté pour débloquer
            </p>
            <p v-else-if="node.completed" class="popover-completed">✓ Terminé</p>
            <Button v-else size="sm" variant="primary" @click="commitNode(node)">
              {{ getActionLabel(node) }}
            </Button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { nodeCenterX, ROW_HEIGHT, MAP_WIDTH } from '@/utils'
import type { MapNode, MapLayer } from '@/stores/gameStore'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  layer: MapLayer
  currentPlayerRow: number
  selectedNodeId: string
  activeNodeId: string | null
}>()

const emit = defineEmits<{ selectNode: [node: MapNode]; toggleNode: [node: MapNode] }>()

// La rangée qui contient le popover ouvert doit passer au-dessus des rangées suivantes
// (celles-ci partagent le même z-index et sont plus tard dans le DOM, donc gagnent par défaut).
const isLayerActive = computed(() =>
  props.layer.nodes.some((node) => node.id === props.activeNodeId),
)

const commitNode = (node: MapNode) => {
  emit('selectNode', node)
}

const getActionLabel = (node: MapNode): string => {
  if (node.inProgress) return '▶️ Reprendre'
  switch (node.type) {
    case 'combat':
      return '⚔️ Combattre'
    case 'elite':
      return '⚔️ Défier'
    case 'shop':
      return '🏪 Visiter'
    case 'event':
      return '❓ Explorer'
    case 'rest':
      return '🏕️ Se reposer'
    case 'boss':
      return '💀 Affronter'
    default:
      return 'Choisir'
  }
}

const getNodeDifficultyLabel = (nodeType: MapNode['type']): string => {
  switch (nodeType) {
    case 'combat':
      return 'Moyenne'
    case 'elite':
      return 'Élite'
    case 'boss':
      return 'Boss'
    default:
      return ''
  }
}

const getRewardIcon = (type: string): string => {
  switch (type) {
    case 'gold':
      return '💰'
    case 'card':
      return '🃏'
    case 'relic':
      return '💎'
    case 'leadership':
      return '👑'
    default:
      return '?'
  }
}
</script>

<style scoped>
/* ─── Couche (ligne de la map) ─────────────────────────── */
.map-layer {
  position: relative;
  height: v-bind('ROW_HEIGHT + "px"');
  min-width: v-bind('MAP_WIDTH + "px"');
  display: flex;
  flex-direction: column;
  z-index: 1;
}

/* ─── Conteneur des nœuds ───────────────────────────────── */
.layer-nodes {
  position: relative;
  height: 100%;
  z-index: 2;
}

/* ─── Nœud compact (cercle + icône) ─────────────────────── */
.map-node {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: 56px;
  margin-left: -28px;
  border: 2px solid rgba(var(--map-line-rgb), 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  background: rgba(var(--map-night-deep-rgb), 0.85);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.node-icon {
  font-size: 1.5rem;
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
}

/* ─── Type "boss" : cercle légèrement plus marqué ───────── */
.node-boss {
  border-width: 3px;
}

/* ─── États ─────────────────────────────────────────────── */
.node-accessible {
  cursor: pointer;
  /* Bordure opaque : en semi-transparent, le liseré se fond dans le halo du pulse
     et paraît flou, surtout sur écran DPR 1. */
  border-color: var(--color-accent);
  animation: pulse 2s infinite;
}
.node-accessible:hover {
  transform: translateY(-50%) scale(1.15);
  box-shadow: 0 5px 20px rgba(var(--color-accent-rgb), 0.4);
}
.node-completed {
  opacity: 0.6;
  background: rgba(var(--color-success-strong-rgb), 0.25) !important;
  border-color: var(--color-success-strong) !important;
}
.node-in-progress {
  animation: progressPulse 1.5s infinite;
  border: 2px solid var(--node-elite) !important;
  box-shadow: 0 0 20px rgba(var(--node-elite-rgb), 0.6);
}
.node-locked {
  cursor: not-allowed;
  background: var(--map-night-deep);
  border-color: rgba(var(--map-line-rgb), 0.25);
  filter: grayscale(0.6) brightness(0.65);
}
.node-selected,
.node-open {
  border-width: 3px;
  z-index: 10;
}

/* ─── Badge statut (coin haut-droite) ───────────────────── */
.node-status {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: bold;
  z-index: 5;
}

/* ─── Popover de détails (affichée au clic) ─────────────── */
.node-popover {
  position: absolute;
  top: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%) translateY(0) scale(1);
  transform-origin: top center;
  width: 220px;
  background: var(--color-bg-surface);
  border: 1px solid rgba(var(--color-accent-rgb), 0.4);
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 4px 16px rgba(var(--color-black-rgb), 0.16);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--color-text-muted);
  z-index: 30;
  cursor: default;
  text-align: center;
}

/* ─── Animation d'ouverture / fermeture de la popover ───── */
.popover-enter-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.popover-leave-active {
  transition:
    opacity 0.12s ease-in,
    transform 0.12s ease-in;
}
.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px) scale(0.9);
}

.popover-title {
  color: var(--color-accent-ink);
  font-size: 0.8rem;
}

.popover-description {
  margin: 0;
}

.popover-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.popover-locked {
  color: var(--color-warning);
  margin: 0;
}

.popover-completed {
  color: var(--color-success-strong);
  font-weight: bold;
  margin: 0;
}

.status-completed {
  background: var(--color-success-strong);
  color: #fff;
}
.status-accessible {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}
.status-in-progress {
  background: var(--node-elite);
  color: var(--color-accent-contrast);
}
.status-locked {
  background: rgba(var(--overlay-rgb), 0.15);
  color: var(--color-text-faint);
}

/* ─── Animations ─────────────────────────────────────────── */
@keyframes pulse {
  /* Halo atténué au départ : à 0.7 il colle à la bordure et la fait paraître baveuse. */
  0% {
    box-shadow: 0 0 0 0 rgba(var(--color-accent-rgb), 0.45);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(var(--color-accent-rgb), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--color-accent-rgb), 0);
  }
}
@keyframes progressPulse {
  0%,
  100% {
    box-shadow: 0 0 20px rgba(var(--node-elite-rgb), 0.6);
  }
  50% {
    box-shadow: 0 0 30px rgba(var(--node-elite-rgb), 0.9);
  }
}

/* ─── Responsive ─────────────────────────────────────────── */
@media (max-width: 768px) {
  .map-node {
    width: 42px;
    height: 42px;
    margin-left: -21px;
  }
  .node-icon {
    font-size: 1.1rem;
  }
  .node-popover {
    width: 180px;
  }
}
</style>
