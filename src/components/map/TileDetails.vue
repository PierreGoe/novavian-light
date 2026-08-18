<template>
  <div class="tile-details" v-if="tile">
    <!-- Bannière hero -->
    <div class="tile-hero" :style="heroStyle(tile.type)">
      <div class="hero-art" aria-hidden="true"><span class="hero-glyph">{{ getTileIcon(tile.type) }}</span></div>
      <div class="hero-content">
        <div class="hero-icon">{{ getTileIcon(tile.type) }}</div>
        <div class="hero-info">
          <h2 class="hero-title">{{ getTileName(tile.type) }}</h2>
          <div class="hero-badges">
            <Badge tone="neutral">📍 {{ tile.position.x }}, {{ tile.position.y }}</Badge>
            <Badge v-if="tile.type === 'stronghold' && tile.level" tone="accent">
              Niv. {{ tile.level }}
            </Badge>
            <Badge :tone="statusBadgeTone(tile.type)">{{ statusLabel(tile.type) }}</Badge>
          </div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <p class="tile-description">{{ getTileDescription(tile.type) }}</p>

    <!-- Niveau de destruction (villages ennemis endommagés) -->
    <NoticeBox
      v-if="tile.type === 'village_enemy' && (tile.destructionLevel ?? 0) > 0"
      :variant="destructionSeverity(tile.destructionLevel ?? 0)"
      icon="🔥"
    >
      <div class="notice-stack">
        <div class="destruction-header">
          <span class="destruction-title">Destruction</span>
          <Badge tone="neutral">{{ destructionLabel(tile.destructionLevel ?? 0) }}</Badge>
        </div>
        <ProgressBar
          :value="tile.destructionLevel ?? 0"
          :tone="destructionSeverity(tile.destructionLevel ?? 0)"
        />
        <span class="destruction-value"
          >{{ tile.destructionLevel }}% — Continuez le siège pour raser ce village</span
        >
      </div>
    </NoticeBox>

    <!-- Troupes en route -->
    <NoticeBox
      v-for="movement in mapStore.getMovementsToTile(tile.id)"
      :key="movement.id"
      variant="warning"
      icon="🪖"
    >
      <div class="notice-stack">
        <div class="transit-header">
          <span>Troupes en route</span>
          <span class="transit-eta" v-if="movement.arrivalTime > now">
            {{ formatRemaining(movement.arrivalTime - now) }}
          </span>
          <span class="transit-eta" v-else>imminente...</span>
        </div>
        <ProgressBar :value="transitProgress(movement)" tone="warning" />
      </div>
    </NoticeBox>

    <!-- Bonus -->
    <NoticeBox v-if="tile.bonus" variant="success" icon="💫">{{ tile.bonus }}</NoticeBox>

    <!-- Zone d'influence de forteresse (village ennemi ou forteresse) -->
    <NoticeBox
      v-if="tileZone"
      :variant="zoneVariant(tileZone.hostilityState)"
      :icon="HOSTILITY_ICONS[tileZone.hostilityState]"
    >
      <div class="notice-stack">
        <div class="zone-header">
          <span class="zone-title">
            {{ tile.type === 'stronghold' ? "Zone d'influence" : 'Sous contrôle ennemi' }}
          </span>
          <Badge :tone="zoneVariant(tileZone.hostilityState)">
            {{ HOSTILITY_LABELS[tileZone.hostilityState] }}
          </Badge>
        </div>
        <div class="zone-stats">
          <span class="zone-stat"
            >⚔️ Puissance : <strong>{{ tileZone.power }}</strong> villages</span
          >
          <span class="zone-stat">
            📊 Hostilité :
            <span class="zone-bar-wrap">
              <ProgressBar
                :value="tileZone.hostilityLevel"
                :tone="zoneVariant(tileZone.hostilityState)"
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
          La forteresse surveille vos agissements. Continuez à attaquer et elle deviendra hostile.
        </p>
        <p v-else class="zone-hint zone-hint--danger">
          La forteresse envoie des raids périodiques sur votre ville. Détruisez-la pour l'arrêter.
        </p>
      </div>
    </NoticeBox>

    <!-- Debug : détails de la forteresse (affiché uniquement pour une forteresse) -->
    <MapDebugPanel
      v-if="tile.type === 'stronghold' && tileZone"
      title="🔍 Debug — Données de la zone"
      :rows="fortressDebugRows(tileZone)"
    >
      <template v-if="tileZone.villageIds.length > 0">
        <SectionLabel>Colonies contrôlées :</SectionLabel>
        <Badge v-for="vid in tileZone.villageIds" :key="vid" tone="epic" class="fdbg-village-chip">
          {{ vid }}
        </Badge>
      </template>
    </MapDebugPanel>

    <!-- Ressources -->
    <div v-if="tile.resources" class="tile-resources notice-stack">
      <SectionLabel>Ressources disponibles</SectionLabel>
      <div class="resource-grid">
        <div v-for="(amount, resource) in tile.resources" :key="resource" class="resource-card">
          <div class="resource-icon">{{ getResourceIcon(resource as string) }}</div>
          <div class="resource-name">{{ resource }}</div>
          <div class="resource-amount">{{ amount }}</div>
          <Badge
            v-if="resourceBonusPct(resource as string) > 0"
            tone="success"
            :title="`Bonus reliques : +${resourceBonusPct(resource as string)}%`"
          >
            +{{ resourceBonusPct(resource as string) }}%
          </Badge>
        </div>
      </div>
    </div>

    <!-- Estimation de la garnison ennemie — aide à la décision avant d'attaquer -->
    <NoticeBox v-if="garrisonEstimate" :variant="garrisonVariant(garrisonEstimate.label)" icon="🛡️">
      <div class="notice-stack">
        <SectionLabel>
          Garnison {{ garrisonEstimate.isExact ? 'estimée' : 'estimée (jamais explorée)' }}
        </SectionLabel>
        <div class="garrison-estimate-body">
          <Badge :tone="garrisonVariant(garrisonEstimate.label)">{{
            garrisonEstimate.label
          }}</Badge>
          <span class="garrison-estimate-text">{{ garrisonEstimate.text }}</span>
        </div>
        <p v-if="!garrisonEstimate.isExact" class="garrison-estimate-hint">
          Estimation basée sur le type de territoire — la garnison réelle n'est révélée qu'au
          premier combat.
        </p>
      </div>
    </NoticeBox>

    <!-- Stock pillable (Phase 2) -->
    <div
      v-if="tile.lootStock && (tile.type === 'village_enemy' || tile.type === 'stronghold')"
      class="tile-loot-stock"
    >
      <SectionLabel>🪙 Butin estimé avec votre armée actuelle</SectionLabel>
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
          <Badge
            v-for="u in capacityBreakdown"
            :key="u.type"
            tone="info"
            :title="`${u.count} × ${u.capPerUnit} = ${u.total}`"
          >
            {{ u.count }} {{ u.type }} → {{ u.total }}
          </Badge>
        </div>
        <NoticeBox v-if="estimatedPillage?.wasCapacityLimited" variant="warning">
          Votre armée ne peut pas tout emporter — envoyez plus de troupes
        </NoticeBox>
      </div>

      <NoticeBox v-if="estimatedPillage?.wasRecentlyPillaged" variant="warning">
        Village récemment pillé — butin réduit de 50%
      </NoticeBox>
    </div>

    <!-- État de la garnison ennemie (Phase 2) -->
    <NoticeBox
      v-if="tile.garrison?.regenStartedAt && garrisonRegenPct < 100"
      variant="info"
      icon="🛡️"
    >
      <div class="notice-stack">
        <SectionLabel>Garnison en reconstruction</SectionLabel>
        <ProgressBar :value="garrisonRegenPct" />
        <div class="regen-label">{{ garrisonRegenPct }}% reconstituée</div>
      </div>
    </NoticeBox>

    <!-- Avertissement siège requis -->
    <NoticeBox
      v-if="(tile.type === 'village_enemy' || tile.type === 'stronghold') && !hasSiegeUnits"
      variant="warning"
    >
      Sans <strong>armes de siège</strong>, le village ne sera pas détruit après la victoire
    </NoticeBox>

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
      <IconActionButton
        v-if="canTradeTile(tile)"
        icon="🤝"
        title="Commerce"
        subtitle="Bientôt disponible"
        disabled
        aria-label="Fonctionnalité pas encore disponible"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  useMapStore,
  estimateGarrisonStrength,
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
import { formatDuration } from '../../utils/formatDuration'
import NoticeBox from '@/components/ui/NoticeBox.vue'
import Badge from '@/components/ui/Badge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import IconActionButton from '@/components/ui/IconActionButton.vue'
import MapDebugPanel, { type MapDebugRow } from './MapDebugPanel.vue'

type Tone = 'success' | 'warning' | 'danger'

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

/** Lignes du panneau de debug forteresse (MapDebugPanel) pour la zone sélectionnée */
const fortressDebugRows = (zone: FortressZone): MapDebugRow[] => {
  const rows: MapDebugRow[] = [
    { label: 'ID forteresse', value: zone.fortressTileId, tone: 'mono' },
    { label: 'Niveau', value: `⭐ ${props.tile?.level ?? 1}`, tone: 'accent' },
    { label: 'Colonies dans la zone', value: `${zone.villageIds.length} village(s)` },
    { label: 'Puissance brute', value: `${zone.power} pts` },
    { label: 'Puissance relative', value: `${fortressDebugInfo.value.relativePowerPct}% du total` },
    { label: "Rayon d'influence", value: `${zone.influenceRadius} cases (Chebyshev)` },
    { label: 'Butin estimé / raid', value: fortressDebugInfo.value.raidEstimate },
    { label: 'Hostilité', value: `${zone.hostilityLevel}% — ${zone.hostilityState}` },
  ]
  if (zone.nextAttackAt) {
    rows.push({
      label: 'Prochain raid',
      value: formatRemaining(zone.nextAttackAt - now.value),
      tone: 'danger',
    })
  }
  return rows
}

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
const formatRemaining = formatDuration

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

/**
 * Estimation de la force de la garnison ennemie — affichée AVANT que le joueur engage ses
 * troupes, pour éviter de miser à l'aveugle. Lecture seule : ne génère jamais la vraie
 * garnison (voir estimateGarrisonStrength dans mapStore.ts pour le détail de la formule).
 */
const garrisonEstimate = computed(() => {
  if (!props.tile) return null
  if (props.tile.type !== 'village_enemy' && props.tile.type !== 'stronghold') return null
  return estimateGarrisonStrength(props.tile)
})

/** Tone NoticeBox/Badge selon le palier de force de la garnison estimée */
const GARRISON_TIER_TONES: Record<string, Tone> = {
  Faible: 'success',
  Modérée: 'warning',
  Forte: 'danger',
}
const garrisonVariant = (label: string): Tone => GARRISON_TIER_TONES[label] ?? 'warning'

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

/** Teinte par type de terrain (mécanisme --tc, cf. BuildingCard.vue) — palette
 * partagée avec LargeMapGrid.vue via les tokens --terrain-* de tokens.css. */
const TERRAIN_TC: Record<string, string> = {
  plains: 'var(--terrain-plains-rgb)',
  forest: 'var(--terrain-forest-rgb)',
  mountain: 'var(--terrain-mountain-rgb)',
  water: 'var(--terrain-water-rgb)',
  village_player: 'var(--terrain-village-player-rgb)',
  village_enemy: 'var(--terrain-village-enemy-rgb)',
  ruins: 'var(--terrain-ruins-rgb)',
  stronghold: 'var(--terrain-stronghold-rgb)',
}

const heroStyle = (type: MapTile['type']) => ({
  '--tc': TERRAIN_TC[type] ?? TERRAIN_TC.plains,
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

const statusBadgeTone = (type: MapTile['type']): 'success' | 'danger' | 'neutral' | 'info' =>
  (
    ({
      plains: 'neutral',
      forest: 'neutral',
      mountain: 'info',
      water: 'info',
      village_player: 'success',
      village_enemy: 'danger',
      ruins: 'neutral',
      stronghold: 'danger',
    }) as const
  )[type] ?? 'neutral'

/** Libellé descriptif du niveau de destruction */
const destructionLabel = (level: number): string => {
  if (level <= 25) return 'Légèrement endommagé'
  if (level <= 50) return 'Endommagé'
  if (level <= 75) return 'Fortement endommagé'
  return 'En ruine partielle'
}

/** Tone NoticeBox/ProgressBar selon la sévérité des dégâts */
const destructionSeverity = (level: number): Tone => {
  if (level <= 50) return 'warning'
  return 'danger'
}

/** Tone NoticeBox/Badge/ProgressBar selon l'état d'hostilité d'une zone */
const zoneVariant = (state: 'neutral' | 'warned' | 'hostile'): Tone =>
  (({ neutral: 'success', warned: 'warning', hostile: 'danger' }) as const)[state]

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

/* ── Bannière hero — carte claire façon BuildingCard.vue : bordure gauche
   colorée par --tc, glyphe décoratif, plus de bandeau sombre plein-largeur ── */
.tile-hero {
  position: relative;
  border-radius: 16px;
  padding: 24px 22px;
  overflow: hidden;
  background: var(--color-bg-surface);
  border: 1.5px solid rgba(var(--overlay-rgb), 0.12);
  box-shadow:
    0 1px 2px rgba(var(--overlay-rgb), 0.05),
    0 4px 12px -6px rgba(var(--overlay-rgb), 0.15);
}

.tile-hero::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: rgba(var(--tc), 0.85);
  z-index: 2;
}

.hero-art {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(130% 100% at 12% -10%, rgba(var(--tc), 0.24), transparent 62%),
    linear-gradient(165deg, rgba(var(--tc), 0.1), transparent 75%);
}

.hero-art::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 35%, var(--color-bg-surface) 94%);
}

.hero-glyph {
  position: absolute;
  right: -0.1em;
  bottom: -0.35em;
  font-size: 5.5rem;
  line-height: 1;
  opacity: 0.12;
  transform: rotate(-6deg);
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 20px;
}

.hero-icon {
  font-size: 52px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 3px rgba(var(--overlay-rgb), 0.25));
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
  color: var(--color-text);
  line-height: 1.1;
}

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ── Description ── */
.tile-description {
  color: var(--color-text-faint);
  line-height: 1.6;
  margin: 0;
  font-style: italic;
  font-size: 0.93em;
  padding: 0 2px;
}

/* ── Panneau de destruction ── */
.destruction-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.destruction-title {
  font-size: 0.82em;
  font-weight: 700;
  color: var(--color-warning);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}
.destruction-value {
  font-size: 0.75em;
  color: var(--color-text-muted);
  font-style: italic;
}

/* ── Troupes en transit ── */
.transit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--color-text);
  font-size: 0.9em;
  font-weight: 600;
}

.transit-eta {
  font-variant-numeric: tabular-nums;
  color: var(--color-warning);
  font-size: 1em;
}

/* ── Zone d'influence & Hostilité ── */
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
  color: var(--color-text-muted);
  flex: 1;
}

.zone-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.zone-stat {
  font-size: 0.83em;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.zone-next-attack {
  color: var(--color-danger-light);
}

.zone-bar-wrap {
  display: inline-block;
  width: 80px;
  vertical-align: middle;
}

.zone-hint {
  font-size: 0.78em;
  color: var(--color-text-faint);
  margin: 0;
  font-style: italic;
}
.zone-hint--warning {
  color: var(--color-warning);
}
.zone-hint--danger {
  color: var(--color-danger-light);
}

.fdbg-village-chip {
  font-family: monospace;
}

/* ── Ressources ── */
.resource-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
}

/* Grille de tuiles de stat verticale (icône/nom/montant) — aucun composant `ui/`
   ne couvre cette forme (IconRow est une ligne horizontale, pas une tuile
   verticale) ; markup custom volontaire, mais tokenisé pour la base claire. */
.resource-card {
  background: rgba(var(--overlay-rgb), 0.04);
  border: 1px solid rgba(var(--overlay-rgb), 0.12);
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
  color: var(--color-text-faint);
  text-transform: capitalize;
}

.resource-amount {
  font-size: 1.1em;
  font-weight: 700;
  color: var(--color-success);
}

/* ── Regroupe verticalement le contenu multi-blocs d'un NoticeBox (ou d'une
   section sans layout flex propre), en restaurant l'espacement d'origine ── */
.notice-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.garrison-estimate-body {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.garrison-estimate-text {
  font-size: 0.92em;
  font-weight: 600;
  color: var(--color-text);
}

.garrison-estimate-hint {
  font-size: 0.78em;
  color: var(--color-text-faint);
  margin: 0;
  font-style: italic;
}

/* ── Phase 2 — Pillage & garnison ── */
.tile-loot-stock {
  background: rgba(var(--color-warning-rgb), 0.06);
  border: 1px solid rgba(var(--color-warning-rgb), 0.2);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.carry-capacity-info {
  border-top: 1px solid rgba(var(--color-white-rgb), 0.08);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.carry-label {
  font-size: 0.8em;
  color: var(--color-info);
}

.carry-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.regen-label {
  font-size: 0.75em;
  color: var(--color-text-muted);
  text-align: right;
}

/* ── Panneau d'attaque inline ── */
.attack-panel-wrapper {
  border: 1px solid rgba(var(--color-danger-rgb), 0.3);
  border-radius: 10px;
  background: rgba(var(--color-danger-rgb), 0.05);
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
