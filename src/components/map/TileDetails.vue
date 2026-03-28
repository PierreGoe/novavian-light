<template>
  <div class="tile-details" v-if="tile">
    <!-- Bannière hero -->
    <div class="tile-hero" :style="heroStyle(tile.type)">
      <div class="hero-icon">{{ getTileIcon(tile.type) }}</div>
      <div class="hero-info">
        <h2 class="hero-title">{{ getTileName(tile.type) }}</h2>
        <div class="hero-badges">
          <span class="badge badge-coords">📍 {{ tile.position.x }}, {{ tile.position.y }}</span>
          <span class="badge" :class="statusBadgeClass(tile.type)">{{
            statusLabel(tile.type)
          }}</span>
        </div>
      </div>
    </div>

    <!-- Description -->
    <p class="tile-description">{{ getTileDescription(tile.type) }}</p>

    <!-- Troupes en route -->
    <div
      v-for="movement in mapStore.getMovementsToTile(tile.id)"
      :key="movement.id"
      class="troops-in-transit"
    >
      <div class="transit-header">
        <span>🪖 Troupes en route</span>
        <span class="transit-eta" v-if="movement.arrivalTime > now">
          {{ formatRemaining(movement.arrivalTime - now) }}
        </span>
        <span class="transit-eta" v-else>imminente...</span>
      </div>
      <div class="transit-bar-track">
        <div class="transit-bar-fill" :style="{ width: transitProgress(movement) + '%' }"></div>
      </div>
    </div>

    <!-- Bonus -->
    <div v-if="tile.bonus" class="tile-bonus">
      <span class="bonus-icon">💫</span>
      <span>{{ tile.bonus }}</span>
    </div>

    <!-- Ressources -->
    <div v-if="tile.resources" class="tile-resources">
      <div class="section-label">Ressources disponibles</div>
      <div class="resource-grid">
        <div v-for="(amount, resource) in tile.resources" :key="resource" class="resource-card">
          <div class="resource-icon">{{ getResourceIcon(resource as string) }}</div>
          <div class="resource-name">{{ resource }}</div>
          <div class="resource-amount">{{ amount }}</div>
          <div
            v-if="resourceBonusPct(resource as string) > 0"
            class="resource-bonus"
            :title="`Bonus reliques : +${resourceBonusPct(resource as string)}%`"
          >
            +{{ resourceBonusPct(resource as string) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="tile-actions">
      <button
        v-if="canAttackTile(tile)"
        class="action-btn attack-btn"
        @click="$emit('attackTile', tile.id)"
      >
        <span class="action-icon">⚔️</span>
        <span class="action-label">Attaquer</span>
        <span class="action-sub">Envoyer vos troupes</span>
      </button>

      <button
        v-if="canTradeTile(tile)"
        class="action-btn trade-btn"
        @click="$emit('tradeTile', tile.id)"
      >
        <span class="action-icon">🤝</span>
        <span class="action-label">Commerce</span>
        <span class="action-sub">Négocier des ressources</span>
      </button>

      <button
        v-if="canExploreTile(tile)"
        class="action-btn explore-btn"
        @click="$emit('exploreTile', tile.id)"
      >
        <span class="action-icon">🏛️</span>
        <span class="action-label">Explorer</span>
        <span class="action-sub">Fouiller les ruines</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useMapStore, type MapTile } from '../../stores/mapStore'
import { useGameStore } from '../../stores/gameStore'

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

// Stores
const mapStore = useMapStore()
const gameStore = useGameStore()

// Horloge réactive pour mettre à jour les timers affichés chaque seconde
const now = ref(Date.now())
let clockTimer: number | null = null
onMounted(() => {
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

/** Formatte un temps restant en ms en "1m 30s" ou "45s" */
const formatRemaining = (ms: number): string => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

/** Progression du trajet 0→100% */
const transitProgress = (movement: { departureTime: number; arrivalTime: number }): number => {
  const total = movement.arrivalTime - movement.departureTime
  const elapsed = now.value - movement.departureTime
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

/** Gradient de la bannière selon le type de terrain */
const HERO_GRADIENTS: Record<string, string> = {
  plains: 'linear-gradient(135deg, #3a5c20, #4a7c3f)',
  forest: 'linear-gradient(135deg, #1b3a10, #2e7d32)',
  mountain: 'linear-gradient(135deg, #37474f, #546e7a)',
  water: 'linear-gradient(135deg, #0d3c5e, #1565c0)',
  village_player: 'linear-gradient(135deg, #7c4e00, #ef8c00)',
  village_enemy: 'linear-gradient(135deg, #7b1515, #c62828)',
  ruins: 'linear-gradient(135deg, #2c2c2c, #555)',
  stronghold: 'linear-gradient(135deg, #311b6b, #6a1b9a)',
}

const heroStyle = (type: MapTile['type']) => ({
  background: HERO_GRADIENTS[type] ?? HERO_GRADIENTS.plains,
})

const statusLabel = (type: MapTile['type']): string =>
  ({
    plains: 'Terrain neutre',
    forest: 'Terrain neutre',
    mountain: 'Infranchissable',
    water: 'Infranchissable',
    village_player: 'Votre territoire',
    village_enemy: 'Territoire ennemi',
    ruins: 'Zone abandonnée',
    stronghold: 'Forteresse ennemie',
  })[type] ?? 'Inconnu'

const statusBadgeClass = (type: MapTile['type']): string =>
  ({
    plains: 'badge-neutral',
    forest: 'badge-neutral',
    mountain: 'badge-blocked',
    water: 'badge-blocked',
    village_player: 'badge-friendly',
    village_enemy: 'badge-hostile',
    ruins: 'badge-neutral',
    stronghold: 'badge-hostile',
  })[type] ?? 'badge-neutral'

/**
 * Retourne le % de bonus artefact applicable à une ressource donnée.
 */
const resourceBonusPct = (resource: string): number => {
  const effects = gameStore.getTotalArtifactEffects.value
  switch (resource) {
    case 'wood':
      return effects.resourceBonus.wood ?? 0
    case 'iron':
      return effects.resourceBonus.iron ?? 0
    case 'crop':
      return effects.resourceBonus.food ?? 0
    case 'stone':
      return effects.resourceBonus.stone ?? 0
    case 'gold':
      return effects.economy ?? 0
    default:
      return 0
  }
}

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
/* ── Conteneur principal ── */
.tile-details {
  background: transparent;
  padding: 0;
  margin: 0;
  border: none;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Bannière hero ── */
.tile-hero {
  border-radius: 10px;
  padding: 24px 22px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.hero-icon {
  font-size: 52px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-title {
  margin: 0;
  font-size: 1.6em;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  line-height: 1.1;
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badge {
  font-size: 0.78em;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.35);
  color: #eee;
  letter-spacing: 0.02em;
}

.badge-coords {
  color: #ccc;
}

.badge-friendly {
  background: rgba(76, 175, 80, 0.3);
  border-color: #4caf50;
  color: #a5d6a7;
}

.badge-hostile {
  background: rgba(244, 67, 54, 0.3);
  border-color: #f44336;
  color: #ef9a9a;
}

.badge-neutral {
  background: rgba(158, 158, 158, 0.2);
  border-color: #757575;
  color: #bdbdbd;
}

.badge-blocked {
  background: rgba(96, 125, 139, 0.25);
  border-color: #607d8b;
  color: #b0bec5;
}

/* ── Description ── */
.tile-description {
  color: #aaa;
  line-height: 1.6;
  margin: 0;
  font-style: italic;
  font-size: 0.93em;
  padding: 0 2px;
}

/* ── Troupes en transit ── */
.troops-in-transit {
  background: rgba(255, 152, 0, 0.08);
  border: 1px solid rgba(255, 152, 0, 0.4);
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.transit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #ffcc80;
  font-size: 0.9em;
  font-weight: 600;
}

.transit-eta {
  font-variant-numeric: tabular-nums;
  color: #ffa726;
  font-size: 1em;
}

.transit-bar-track {
  height: 5px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.transit-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff9800, #ffeb3b);
  border-radius: 999px;
  transition: width 0.9s linear;
}

/* ── Bonus ── */
.tile-bonus {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(76, 175, 80, 0.1);
  border: 1px solid rgba(76, 175, 80, 0.35);
  border-radius: 10px;
  padding: 12px 16px;
  color: #a5d6a7;
  font-size: 0.92em;
}

.bonus-icon {
  font-size: 1.2em;
  flex-shrink: 0;
}

/* ── Ressources ── */
.section-label {
  font-size: 0.75em;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 10px;
}

.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
}

.resource-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.resource-icon {
  font-size: 1.6em;
}

.resource-name {
  font-size: 0.72em;
  color: #888;
  text-transform: capitalize;
}

.resource-amount {
  font-size: 1.1em;
  font-weight: 700;
  color: #81c784;
}

.resource-bonus {
  font-size: 0.7em;
  font-weight: 700;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 999px;
  padding: 1px 7px;
  cursor: default;
}

/* ── Actions ── */
.tile-actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-top: 4px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px 12px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition:
    transform 0.15s,
    filter 0.15s;
}

.action-btn:hover {
  transform: translateY(-3px);
  filter: brightness(1.15);
}

.action-btn:active {
  transform: translateY(0);
  filter: brightness(0.95);
}

.action-icon {
  font-size: 1.6em;
  line-height: 1;
}

.action-label {
  font-size: 0.9em;
  font-weight: 700;
  color: #fff;
}

.action-sub {
  font-size: 0.72em;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
}

.attack-btn {
  background: linear-gradient(135deg, #c62828, #b71c1c);
}
.trade-btn {
  background: linear-gradient(135deg, #e65100, #ef6c00);
}
.explore-btn {
  background: linear-gradient(135deg, #6a1b9a, #7b1fa2);
}
.scout-btn {
  background: linear-gradient(135deg, #1565c0, #1976d2);
}

@media (max-width: 600px) {
  .tile-hero {
    flex-direction: column;
    text-align: center;
  }

  .hero-badges {
    justify-content: center;
  }

  .tile-actions {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
