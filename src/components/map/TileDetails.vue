<template>
  <div class="tile-details" v-if="tile">
    <!-- Bannière hero -->
    <div class="tile-hero" :style="heroStyle(tile.type)">
      <div class="hero-icon">{{ getTileIcon(tile.type) }}</div>
      <div class="hero-info">
        <h2 class="hero-title">{{ getTileName(tile.type) }}</h2>
        <div class="hero-badges">
          <span class="badge badge-coords">📍 {{ tile.position.x }}, {{ tile.position.y }}</span>
          <span v-if="tile.type === 'stronghold' && tile.level" class="badge badge-level">
            Niv. {{ tile.level }}
          </span>
          <span class="badge" :class="statusBadgeClass(tile.type)">{{
            statusLabel(tile.type)
          }}</span>
        </div>
      </div>
    </div>

    <!-- Description -->
    <p class="tile-description">{{ getTileDescription(tile.type) }}</p>

    <!-- Niveau de destruction (villages ennemis endommagés) -->
    <div
      v-if="tile.type === 'village_enemy' && (tile.destructionLevel ?? 0) > 0"
      class="destruction-panel"
      :class="destructionSeverityClass(tile.destructionLevel ?? 0)"
    >
      <div class="destruction-header">
        <span class="destruction-icon">🔥</span>
        <span class="destruction-title">Destruction</span>
        <span class="destruction-badge">{{ destructionLabel(tile.destructionLevel ?? 0) }}</span>
      </div>
      <div class="destruction-bar-track">
        <div
          class="destruction-bar-fill"
          :style="{ width: (tile.destructionLevel ?? 0) + '%' }"
        />
      </div>
      <span class="destruction-value">{{ tile.destructionLevel }}% — Continuez le siège pour raser ce village</span>
    </div>

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

    <!-- Zone d'influence de forteresse (village ennemi ou forteresse) -->
    <div v-if="tileZone" class="fortress-zone-info" :class="`zone-${tileZone.hostilityState}`">
      <div class="zone-header">
        <span class="zone-icon">{{ HOSTILITY_ICONS[tileZone.hostilityState] }}</span>
        <span class="zone-title">
          {{ tile.type === 'stronghold' ? "Zone d'influence" : 'Sous contrôle ennemi' }}
        </span>
        <span class="zone-hostility-badge" :class="`badge-${tileZone.hostilityState}`">
          {{ HOSTILITY_LABELS[tileZone.hostilityState] }}
        </span>
      </div>
      <div class="zone-stats">
        <span class="zone-stat"
          >⚔️ Puissance : <strong>{{ tileZone.power }}</strong> villages</span
        >
        <span class="zone-stat">
          📊 Hostilité :
          <span class="zone-bar">
            <span
              class="zone-bar-fill"
              :class="`bar-${tileZone.hostilityState}`"
              :style="{ width: tileZone.hostilityLevel + '%' }"
            />
          </span>
          {{ tileZone.hostilityLevel }}%
        </span>
        <span
          v-if="tileZone.hostilityState === 'hostile' && tileZone.nextAttackAt"
          class="zone-stat zone-next-attack"
        >
          ⏰ Prochain raid dans :
          <strong>{{ formatRemaining((tileZone.nextAttackAt ?? 0) - Date.now()) }}</strong>
        </span>
      </div>
      <p v-if="tileZone.hostilityState === 'neutral'" class="zone-hint">
        Attaquer ce territoire augmentera l'hostilité de la forteresse qui le contrôle.
      </p>
      <p v-else-if="tileZone.hostilityState === 'warned'" class="zone-hint zone-hint--warning">
        ⚠️ La forteresse surveille vos agissements. Continuez à attaquer et elle deviendra hostile.
      </p>
      <p v-else class="zone-hint zone-hint--danger">
        🔴 La forteresse envoie des raids périodiques sur votre ville. Détruisez-la pour l'arrêter.
      </p>
    </div>

    <!-- Debug : détails de la forteresse (affiché uniquement pour une forteresse) -->
    <div v-if="tile.type === 'stronghold' && tileZone" class="fortress-debug-panel">
      <div class="fortress-debug-title">🔍 Debug — Données de la zone</div>
      <div class="fortress-debug-grid">
        <div class="fdbg-row">
          <span class="fdbg-label">ID forteresse</span>
          <span class="fdbg-value fdbg-mono">{{ tileZone.fortressTileId }}</span>
        </div>
        <div class="fdbg-row">
          <span class="fdbg-label">Niveau</span>
          <span class="fdbg-value fdbg-level">⭐ {{ tile.level ?? 1 }}</span>
        </div>
        <div class="fdbg-row">
          <span class="fdbg-label">Colonies dans la zone</span>
          <span class="fdbg-value">{{ tileZone.villageIds.length }} village(s)</span>
        </div>
        <div class="fdbg-row">
          <span class="fdbg-label">Puissance brute</span>
          <span class="fdbg-value">{{ tileZone.power }} pts</span>
        </div>
        <div class="fdbg-row">
          <span class="fdbg-label">Puissance relative</span>
          <span class="fdbg-value">{{ fortressDebugInfo.relativePowerPct }}% du total</span>
        </div>
        <div class="fdbg-row">
          <span class="fdbg-label">Rayon d'influence</span>
          <span class="fdbg-value">{{ tileZone.influenceRadius }} cases (Chebyshev)</span>
        </div>
        <div class="fdbg-row">
          <span class="fdbg-label">Butin estimé / raid</span>
          <span class="fdbg-value">{{ fortressDebugInfo.raidEstimate }}</span>
        </div>
        <div class="fdbg-row">
          <span class="fdbg-label">Hostilité</span>
          <span class="fdbg-value"
            >{{ tileZone.hostilityLevel }}% — {{ tileZone.hostilityState }}</span
          >
        </div>
        <div class="fdbg-row" v-if="tileZone.nextAttackAt">
          <span class="fdbg-label">Prochain raid</span>
          <span class="fdbg-value fdbg-danger">{{
            formatRemaining((tileZone.nextAttackAt ?? 0) - now)
          }}</span>
        </div>
      </div>
      <div v-if="tileZone.villageIds.length > 0" class="fdbg-villages">
        <span class="fdbg-label">Colonies contrôlées :</span>
        <span v-for="vid in tileZone.villageIds" :key="vid" class="fdbg-village-chip">{{
          vid
        }}</span>
      </div>
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

    <!-- Stock pillable (Phase 2) -->
    <div
      v-if="tile.lootStock && (tile.type === 'village_enemy' || tile.type === 'stronghold')"
      class="tile-loot-stock"
    >
      <div class="section-label">🪙 Butin estimé avec votre armée actuelle</div>
      <div class="resource-grid">
        <div class="resource-card" v-if="estimatedLoot.gold > 0">
          <div class="resource-icon">🪙</div>
          <div class="resource-name">Or</div>
          <div class="resource-amount">~{{ estimatedLoot.gold }}</div>
        </div>
        <div class="resource-card" v-if="estimatedLoot.wood > 0">
          <div class="resource-icon">🪵</div>
          <div class="resource-name">Bois</div>
          <div class="resource-amount">~{{ estimatedLoot.wood }}</div>
        </div>
        <div class="resource-card" v-if="estimatedLoot.iron > 0">
          <div class="resource-icon">⚒️</div>
          <div class="resource-name">Fer</div>
          <div class="resource-amount">~{{ estimatedLoot.iron }}</div>
        </div>
        <div class="resource-card" v-if="estimatedLoot.crop > 0">
          <div class="resource-icon">🌾</div>
          <div class="resource-name">Céréales</div>
          <div class="resource-amount">~{{ estimatedLoot.crop }}</div>
        </div>
      </div>

      <!-- Capacité de transport par type d'unité -->
      <div class="carry-capacity-info">
        <span class="carry-label"
          >🎒 Capacité de transport : <strong>{{ playerCarryCapacity }}</strong></span
        >
        <div class="carry-breakdown" v-if="capacityBreakdown.length > 0">
          <span
            v-for="u in capacityBreakdown"
            :key="u.type"
            class="carry-unit-badge"
            :title="`${u.count} × ${u.capPerUnit} = ${u.total}`"
          >
            {{ u.count }} {{ u.type }} → {{ u.total }}
          </span>
        </div>
        <div v-if="estimatedPillage?.wasCapacityLimited" class="capacity-limited-warning">
          ⚠️ Votre armée ne peut pas tout emporter — envoyez plus de troupes
        </div>
      </div>

      <div v-if="estimatedPillage?.wasRecentlyPillaged" class="pillage-warning">
        ⚠️ Village récemment pillé — butin réduit de 50%
      </div>
    </div>

    <!-- État de la garnison ennemie (Phase 2) -->
    <div v-if="tile.garrison?.regenStartedAt && garrisonRegenPct < 100" class="garrison-regen">
      <div class="section-label">🛡️ Garnison en reconstruction</div>
      <div class="regen-bar-track">
        <div class="regen-bar-fill" :style="{ width: garrisonRegenPct + '%' }"></div>
      </div>
      <div class="regen-label">{{ garrisonRegenPct }}% reconstituée</div>
    </div>

    <!-- Avertissement siège requis -->
    <div
      v-if="(tile.type === 'village_enemy' || tile.type === 'stronghold') && !hasSiegeUnits"
      class="siege-warning"
    >
      ⚠️ Sans <strong>armes de siège</strong>, le village ne sera pas détruit après la victoire
    </div>

    <!-- Panneau d'attaque inline -->
    <div v-if="canAttackTile(tile)" class="attack-panel-wrapper">
      <AttackPanel
        :available-units="playerAvailableUnits"
        :compute-travel-ms="(units) => mapStore.calculateTravelTimeMs(tile!.id, units)"
        @confirm="onAttackConfirm"
      />
    </div>

    <!-- Actions -->
    <div class="tile-actions">
      <button
        v-if="canTradeTile(tile)"
        class="action-btn trade-btn"
        @click="$emit('tradeTile', tile.id)"
      >
        <span class="action-icon">🤝</span>
        <span class="action-label">Commerce</span>
        <span class="action-sub">Négocier des ressources</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  useMapStore,
  type MapTile,
  type MovementUnit,
  type FortressZone,
} from '../../stores/mapStore'
import { useGameStore } from '../../stores/gameStore'
import { useMissionStore } from '../../stores/missionStore'
import AttackPanel from './AttackPanel.vue'
import type { AvailableUnit } from '../../combat/attackPlanner'
import { GARRISON_REGEN_DURATION_MS } from '../../config'
import { computeLootCapacity, computePillage, UNIT_CARRY_CAPACITY } from '../../combat/loot'

// Props
interface Props {
  tile: MapTile | null
}

const props = defineProps<Props>()

// Stores
const mapStore = useMapStore()
const gameStore = useGameStore()
const missionStore = useMissionStore()

/** Zone d’influence liée à la tuile actuelle (si village ou forteresse ennemie) */
const tileZone = computed((): FortressZone | null => {
  if (!props.tile) return null
  const { type, id } = props.tile
  if (type === 'stronghold') return mapStore.getFortressZone(id) ?? null
  if (type === 'village_enemy') {
    const fortressId = mapStore.getControllingFortress(id)
    return fortressId ? (mapStore.getFortressZone(fortressId) ?? null) : null
  }
  return null
})

/** Infos de debug calculées pour la forteresse sélectionnée */
const fortressDebugInfo = computed(() => {
  if (!tileZone.value) return { relativePowerPct: 0, raidEstimate: '—' }
  const allZones = Object.values(mapStore.mapState.fortressZones)
  const totalPower = allZones.reduce((sum, z) => sum + z.power, 0)
  const relativePowerPct =
    totalPower > 0 ? Math.round((tileZone.value.power / totalPower) * 100) : 0
  // Estimation du raid = power * HOSTILE_LOOT_PER_POWER (constante = 4)
  const lootPerRes = tileZone.value.power * 4
  const raidEstimate = `🪵${lootPerRes} 🧱${lootPerRes} ⚒️${lootPerRes} 🌾${lootPerRes}`
  return { relativePowerPct, raidEstimate }
})

const HOSTILITY_LABELS: Record<string, string> = {
  neutral: 'Neutre',
  warned: 'Avertie',
  hostile: 'Hostile',
}
const HOSTILITY_ICONS: Record<string, string> = {
  neutral: '🟢',
  warned: '🟠',
  hostile: '🔴',
}

// ------------------------------------
// Panneau d'attaque
// ------------------------------------

/** Contrôle l'affichage inline du panneau d'attaque */
const emit = defineEmits<{
  attackTile: [tileId: string, units: MovementUnit[]]
  tradeTile: [tileId: string]
}>()

/** Unités disponibles dans la garnison du joueur, compatibles avec AttackPanel */
const playerAvailableUnits = computed<AvailableUnit[]>(() =>
  (missionStore.town.value?.units ?? [])
    .filter((u) => u.count > 0)
    .map((u) => ({
      type: u.type,
      count: u.count,
      attack: u.attack,
      defense: u.defense,
      health: u.health,
    })),
)

/** Appelé quand le joueur confirme son choix dans AttackPanel */
const onAttackConfirm = (units: MovementUnit[]) => {
  if (!props.tile) return
  emit('attackTile', props.tile.id, units)
}

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

// ------------------------------------
// Phase 2 — Pillage & garnison
// ------------------------------------

/**
 * Capacité de transport de l'armée actuelle du joueur.
 * Utilisée comme estimation du butin réellement emportable.
 */
const playerCarryCapacity = computed(() => {
  const units = missionStore.town.value?.units ?? []
  return computeLootCapacity(units)
})

/** Détail de la capacité par type d'unité possédée */
const capacityBreakdown = computed(() => {
  const units = missionStore.town.value?.units ?? []
  return units
    .filter((u) => u.count > 0)
    .map((u) => ({
      type: u.type,
      count: u.count,
      capPerUnit: UNIT_CARRY_CAPACITY[u.type] ?? 10,
      total: u.count * (UNIT_CARRY_CAPACITY[u.type] ?? 10),
    }))
})

/**
 * Simulation du pillage avec l'armée actuelle du joueur (avant combat).
 * C'est l'estimation affichée — le résultat réel dépendra des survivants.
 */
const estimatedPillage = computed(() => {
  const stock = props.tile?.lootStock
  if (!stock) return null
  const units = missionStore.town.value?.units ?? []
  return computePillage(stock, units, props.tile?.lastPillagedAt)
})

/** Butin estimé avec l'armée actuelle et la fraction en cours */
const estimatedLoot = computed(
  () => estimatedPillage.value?.loot ?? { gold: 0, wood: 0, iron: 0, crop: 0 },
)

/** Progression de la régénération de la garnison (0–100) */
const garrisonRegenPct = computed(() => {
  const regenStartedAt = props.tile?.garrison?.regenStartedAt
  if (!regenStartedAt) return 0
  const elapsed = now.value - regenStartedAt
  return Math.min(100, Math.floor((elapsed / GARRISON_REGEN_DURATION_MS) * 100))
})

/** Vrai si le joueur possède au moins une unité de siège */
const hasSiegeUnits = computed(() =>
  (missionStore.town.value?.units ?? []).some((u) => u.type === 'siege' && u.count > 0),
)

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

/** Libellé descriptif du niveau de destruction */
const destructionLabel = (level: number): string => {
  if (level <= 25) return 'Légèrement endommagé'
  if (level <= 50) return 'Endommagé'
  if (level <= 75) return 'Fortement endommagé'
  return 'En ruine partielle'
}

/** Classe CSS selon la sévérité des dégâts */
const destructionSeverityClass = (level: number): string => {
  if (level <= 25) return 'destruction--light'
  if (level <= 50) return 'destruction--medium'
  if (level <= 75) return 'destruction--heavy'
  return 'destruction--critical'
}

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
      return effects.resourceBonus.crop ?? 0
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
    iron: '⚒️',
    crop: '🌾',
    gold: '🪙',
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

/* ── Panneau de destruction ── */
.destruction-panel {
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid rgba(255, 87, 34, 0.4);
  background: rgba(255, 87, 34, 0.07);
}
.destruction-panel.destruction--medium {
  border-color: rgba(255, 152, 0, 0.5);
  background: rgba(255, 152, 0, 0.08);
}
.destruction-panel.destruction--heavy {
  border-color: rgba(244, 67, 54, 0.5);
  background: rgba(244, 67, 54, 0.1);
}
.destruction-panel.destruction--critical {
  border-color: rgba(183, 28, 28, 0.7);
  background: rgba(183, 28, 28, 0.14);
}
.destruction-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.destruction-icon {
  font-size: 1em;
}
.destruction-title {
  font-size: 0.82em;
  font-weight: 700;
  color: #ff8a65;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}
.destruction-badge {
  font-size: 0.75em;
  color: #ffccbc;
  font-style: italic;
}
.destruction-bar-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  overflow: hidden;
}
.destruction-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
  background: linear-gradient(90deg, #ff9800, #f44336);
}
.destruction--heavy .destruction-bar-fill,
.destruction--critical .destruction-bar-fill {
  background: linear-gradient(90deg, #f44336, #b71c1c);
}
.destruction-value {
  font-size: 0.75em;
  color: rgba(255, 200, 180, 0.75);
  font-style: italic;
}

/* ── Troupes en transit ── */
.troops-in-transit {
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

/* ── Zone d'influence & Hostilité ── */
.fortress-zone-info {
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid rgba(150, 150, 150, 0.3);
  background: rgba(30, 30, 50, 0.5);
}

.zone-neutral {
  border-color: rgba(100, 200, 100, 0.3);
}
.zone-warned {
  border-color: rgba(251, 146, 60, 0.5);
  background: rgba(120, 60, 10, 0.25);
}
.zone-hostile {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(120, 10, 10, 0.3);
}

.zone-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zone-title {
  font-weight: 700;
  font-size: 0.88em;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #ccc;
  flex: 1;
}

.zone-hostility-badge {
  font-size: 0.75em;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.05em;
}

.badge-neutral {
  background: rgba(100, 200, 100, 0.2);
  color: #86efac;
}
.badge-warned {
  background: rgba(251, 146, 60, 0.2);
  color: #fdba74;
}
.badge-hostile {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}
.badge-level {
  background: rgba(250, 204, 21, 0.2);
  color: #fde047;
  border-color: rgba(250, 204, 21, 0.4);
}

.zone-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.zone-stat {
  font-size: 0.83em;
  color: #aaa;
  display: flex;
  align-items: center;
  gap: 6px;
}

.zone-next-attack {
  color: #fca5a5;
}

.zone-bar {
  display: inline-block;
  width: 80px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  vertical-align: middle;
}

.zone-bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.bar-neutral {
  background: #4ade80;
}
.bar-warned {
  background: #fb923c;
}
.bar-hostile {
  background: #ef4444;
}

.zone-hint {
  font-size: 0.78em;
  color: #888;
  margin: 0;
  font-style: italic;
}
.zone-hint--warning {
  color: #fdba74;
}
.zone-hint--danger {
  color: #fca5a5;
}

/* ── Debug forteresse ── */
.fortress-debug-panel {
  margin: 10px 0;
  background: rgba(5, 5, 20, 0.85);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: monospace;
  font-size: 11px;
  color: #94a3b8;
}

.fortress-debug-title {
  font-size: 11px;
  font-weight: 700;
  color: #a78bfa;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  padding-bottom: 4px;
}

.fortress-debug-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fdbg-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.fdbg-label {
  color: #64748b;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.fdbg-value {
  color: #e2e8f0;
  font-weight: 600;
  text-align: right;
}

.fdbg-mono {
  font-family: monospace;
  color: #7dd3fc;
}
.fdbg-danger {
  color: #f87171;
}
.fdbg-level {
  color: #fde047;
}

.fdbg-villages {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.fdbg-village-chip {
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
  color: #c4b5fd;
  font-family: monospace;
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

/* ── Phase 2 — Pillage & garnison ── */
.tile-loot-stock {
  background: rgba(255, 193, 7, 0.06);
  border: 1px solid rgba(255, 193, 7, 0.2);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pillage-warning {
  font-size: 0.78em;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  padding: 6px 10px;
}

.carry-capacity-info {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.carry-label {
  font-size: 0.8em;
  color: #90caf9;
}

.carry-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.carry-unit-badge {
  font-size: 0.72em;
  background: rgba(100, 181, 246, 0.1);
  border: 1px solid rgba(100, 181, 246, 0.25);
  border-radius: 999px;
  padding: 2px 8px;
  color: #90caf9;
  cursor: default;
}

.capacity-limited-warning {
  font-size: 0.78em;
  color: #fb923c;
  background: rgba(251, 146, 60, 0.1);
  border: 1px solid rgba(251, 146, 60, 0.25);
  border-radius: 6px;
  padding: 5px 9px;
}

.garrison-regen {
  background: rgba(100, 181, 246, 0.06);
  border: 1px solid rgba(100, 181, 246, 0.2);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.regen-bar-track {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.regen-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #42a5f5, #81d4fa);
  border-radius: 999px;
  transition: width 0.5s ease;
}

.regen-label {
  font-size: 0.75em;
  color: #90caf9;
  text-align: right;
}

.siege-warning {
  font-size: 0.82em;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 8px;
  padding: 8px 12px;
}

/* ── Panneau d'attaque inline ── */
.attack-panel-wrapper {
  border: 1px solid rgba(198, 40, 40, 0.3);
  border-radius: 10px;
  background: rgba(198, 40, 40, 0.05);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.trade-btn {
  background: linear-gradient(135deg, #e65100, #ef6c00);
}
.explore-btn {
  background: linear-gradient(135deg, #6a1b9a, #7b1fa2);
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
