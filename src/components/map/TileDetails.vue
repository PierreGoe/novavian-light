<template>
  <div class="tile-details" v-if="tile">
    <!--
      Grille Bento de la fiche territoire, organisée selon la décision du joueur :
      « est-ce que j'attaque, avec quoi, qu'est-ce que j'y gagne/risque ? »
      1. Hero compact (identité de la tuile)
      2. Rangée KPI — les 3 inputs de décision : garnison / butin / hostilité
      3. Cellule Attaque — l'action primaire, seule carte au ton saturé
      4. Conditionnelles (destruction, troupes en route, bonus)
      5. Tertiaire (ressources du terrain, commerce à venir)
      Vocabulaire visuel partagé avec le plan du village (BuildingCard.vue).
    -->
    <div class="tile-bento">
      <!-- ── 1. Hero compact (pleine largeur, bandeau bas) ── -->
      <div class="tile-hero cell-wide" :style="heroStyle(tile.type)">
        <div class="hero-art" aria-hidden="true">
          <span class="hero-glyph">{{ getTileIcon(tile.type) }}</span>
        </div>
        <div class="hero-content">
          <div class="hero-icon">{{ getTileIcon(tile.type) }}</div>
          <div class="hero-info">
            <div class="hero-title-row">
              <h2 class="hero-title">{{ getTileName(tile.type) }}</h2>
              <Badge tone="neutral">📍 {{ tile.position.x }}, {{ tile.position.y }}</Badge>
              <Badge v-if="tile.type === 'stronghold' && tile.level" tone="accent">
                Niv. {{ tile.level }}
              </Badge>
              <Badge :tone="statusBadgeTone(tile.type)">{{ statusLabel(tile.type) }}</Badge>
            </div>
            <p class="hero-desc" :title="getTileDescription(tile.type)">
              {{ getTileDescription(tile.type) }}
            </p>
          </div>
        </div>
      </div>

      <!-- ── 2. Rangée KPI — inputs de décision. Sous-grille auto-fit : les
           cartes présentes s'étirent pour remplir la rangée, quel que soit le
           nombre de cartes conditionnelles affichées. ── -->
      <div v-if="hasKpiRow" class="kpi-row cell-wide">
        <!-- Garnison estimée (fusionne l'état de reconstruction) -->
        <div
          v-if="garrisonEstimate"
          class="bcard bcard--kpi"
          :style="cardTone(garrisonVariant(garrisonEstimate.label))"
        >
          <div class="bcard-body">
            <div class="bcard-head">
              <span class="bcard-icon">🛡️</span>
              <span class="bcard-title">Garnison estimée</span>
              <InfoPopover
                v-if="!garrisonEstimate.isExact"
                label="Comment est estimée la garnison ?"
              >
                Estimation basée sur le type de territoire — la garnison réelle n'est révélée qu'au
                premier combat.
              </InfoPopover>
              <Badge :tone="garrisonVariant(garrisonEstimate.label)">{{
                garrisonEstimate.label
              }}</Badge>
              <Badge
                v-if="villageExpansionTone"
                :tone="villageExpansionTone"
                title="Ce village se développe avec le temps — attaquez-le avant qu'il ne devienne trop fort."
                >⬆ En expansion</Badge
              >
            </div>
            <div class="kpi-value">{{ garrisonEstimate.text }}</div>
            <template v-if="tile.garrison?.regenStartedAt && garrisonRegenPct < 100">
              <ProgressBar :value="garrisonRegenPct" />
              <p class="bhint">🏗️ {{ garrisonRegenPct }}% reconstituée</p>
            </template>
          </div>
        </div>

        <!-- Butin estimé : LA donnée de décision est le rapport emportable / disponible -->
        <div
          v-if="tile.lootStock && (tile.type === 'village_enemy' || tile.type === 'stronghold')"
          class="bcard bcard--kpi"
          :style="cardTone(estimatedPillage?.wasCapacityLimited ? 'warning' : 'success')"
        >
          <div class="bcard-body">
            <div class="bcard-head">
              <span class="bcard-icon">🪙</span>
              <span class="bcard-title">Butin estimé</span>
              <InfoPopover v-if="capacityBreakdown.length > 0" label="Détail de la capacité">
                <div class="carry-detail">
                  <div class="carry-detail-title">🎒 Capacité de transport</div>
                  <div v-for="u in capacityBreakdown" :key="u.type" class="carry-detail-row">
                    {{ u.count }} × {{ u.type }} ({{ u.capPerUnit }}) =
                    <strong>{{ u.total }}</strong>
                  </div>
                </div>
              </InfoPopover>
              <Badge tone="neutral">🎒 {{ playerCarryCapacity }}</Badge>
            </div>
            <div class="kpi-value">
              ~{{ estimatedLootTotal }} <small class="kpi-unit">ressources</small>
            </div>
            <ProgressBar
              :value="lootRatioPct"
              :tone="estimatedPillage?.wasCapacityLimited ? 'warning' : 'success'"
            />
            <p class="kpi-legend">
              ~{{ estimatedLootTotal }} emportées / {{ lootStockTotal }} disponibles
            </p>
            <div class="loot-badges">
              <Badge v-for="b in lootBadges" :key="b.key" tone="neutral" :title="b.label">
                {{ b.icon }} ~{{ b.amount }}
              </Badge>
            </div>
            <p v-if="estimatedPillage?.wasCapacityLimited" class="bhint bhint--warning">
              Capacité insuffisante — envoyez plus de troupes
            </p>
            <p v-if="estimatedPillage?.wasRecentlyPillaged" class="bhint bhint--warning">
              Récemment pillé — butin réduit de 50%
            </p>
          </div>
        </div>

        <!-- Hostilité de la zone (village ennemi ou forteresse) -->
        <div
          v-if="tileZone"
          class="bcard bcard--kpi"
          :style="cardTone(zoneVariant(tileZone.hostilityState))"
        >
          <div class="bcard-body">
            <div class="bcard-head">
              <span class="bcard-icon">{{ HOSTILITY_ICONS[tileZone.hostilityState] }}</span>
              <span class="bcard-title">
                {{ tile.type === 'stronghold' ? "Zone d'influence" : 'Hostilité' }}
              </span>
              <Badge :tone="zoneVariant(tileZone.hostilityState)">
                {{ HOSTILITY_LABELS[tileZone.hostilityState] }}
              </Badge>
            </div>
            <div class="kpi-value">{{ tileZone.hostilityLevel }}%</div>
            <ProgressBar
              :value="tileZone.hostilityLevel"
              :tone="zoneVariant(tileZone.hostilityState)"
            />
            <p class="kpi-sub">
              ⚔️ Puissance : <strong>{{ tileZone.power }}</strong> villages
            </p>
            <p
              v-if="tileZone.hostilityState === 'hostile' && tileZone.nextAttackAt"
              class="kpi-sub kpi-sub--danger"
            >
              ⏰ Prochain raid :
              <strong>{{ formatRemaining((tileZone.nextAttackAt ?? 0) - now) }}</strong>
            </p>
            <p
              v-if="zoneFatigue > 0"
              class="kpi-sub"
              title="Vos défenses repoussées fatiguent la zone : ses raids faiblissent, et au-delà de 60 % elle est incapable d'attaquer."
            >
              😮‍💨 Fatigue militaire : <strong>{{ zoneFatigue }}%</strong>
              <template v-if="zoneIsExhausted"> — épuisée, incapable d'attaquer</template>
            </p>
            <p class="bhint" :title="zoneHint">{{ zoneHint }}</p>

            <!-- Lien vers la forteresse qui contrôle ce village -->
            <button
              v-if="controllingFortress"
              type="button"
              class="zone-fortress-link"
              @click="emit('selectTile', controllingFortress.id)"
            >
              🏰 Voir la forteresse ({{ controllingFortress.position.x }},
              {{ controllingFortress.position.y }}) →
            </button>

            <!-- Miroir : depuis la forteresse, liens vers ses villages explorés -->
            <div v-if="controlledVillages.length > 0" class="zone-villages">
              <button
                v-for="v in controlledVillages"
                :key="v.id"
                type="button"
                class="zone-village-chip"
                :title="`Voir ${getTileName(v.type)} (${v.position.x}, ${v.position.y})`"
                @click="emit('selectTile', v.id)"
              >
                🏘️ ({{ v.position.x }}, {{ v.position.y }})
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 3. Attaque — la cellule dominante, seule carte au ton saturé ── -->
      <div
        v-if="canAttackTile(tile)"
        class="bcard bcard--attack cell-wide"
        :style="cardTone('danger')"
      >
        <div class="bcard-art" aria-hidden="true"><span class="bcard-glyph">⚔️</span></div>
        <div class="bcard-body">
          <AttackPanel
            :available-units="playerAvailableUnits"
            :target-label="`${getTileName(tile.type)} (${tile.position.x}, ${tile.position.y})`"
            :compute-travel-ms="(units) => mapStore.calculateTravelTimeMs(tile!.id, units)"
            @confirm="onAttackConfirm"
          />
        </div>
      </div>

      <!-- ── 3bis. Trésor des ruines — expédition sans combat, une fouille par partie ── -->
      <div
        v-if="tile.type === 'ruins' && tile.hasTreasure"
        class="bcard bcard--attack cell-wide"
        :style="cardTone('accent')"
      >
        <div class="bcard-art" aria-hidden="true"><span class="bcard-glyph">💎</span></div>
        <div class="bcard-body">
          <div class="bcard-head">
            <span class="bcard-icon">💎</span>
            <span class="bcard-title">Trésor des ruines</span>
            <Badge tone="accent">1 fouille par partie</Badge>
          </div>
          <p class="bcard-text">
            Des richesses dorment sous les décombres. Envoyez des soldats fouiller les ruines —
            le trésor ne peut être récupéré qu'une seule fois.
          </p>
          <div class="loot-badges">
            <Badge v-for="b in treasureRangeBadges" :key="b.key" tone="neutral" :title="b.label">
              {{ b.icon }} {{ b.min }}–{{ b.max }}
            </Badge>
          </div>
          <AttackPanel
            mode="explore"
            :available-units="playerAvailableUnits"
            :target-label="`${getTileName(tile.type)} (${tile.position.x}, ${tile.position.y})`"
            :compute-travel-ms="(units) => mapStore.calculateTravelTimeMs(tile!.id, units)"
            @confirm="onAttackConfirm"
          />
        </div>
      </div>

      <!-- ── 4. Conditionnelles ── -->

      <!-- Niveau de destruction (villages ennemis endommagés) -->
      <div
        v-if="tile.type === 'village_enemy' && (tile.destructionLevel ?? 0) > 0"
        class="bcard bcard--kpi cell-half"
        :style="cardTone(destructionSeverity(tile.destructionLevel ?? 0))"
      >
        <div class="bcard-body">
          <div class="bcard-head">
            <span class="bcard-icon">🔥</span>
            <span class="bcard-title">Destruction</span>
            <Badge tone="neutral">{{ destructionLabel(tile.destructionLevel ?? 0) }}</Badge>
          </div>
          <ProgressBar
            :value="tile.destructionLevel ?? 0"
            :tone="destructionSeverity(tile.destructionLevel ?? 0)"
          />
          <p class="bhint">
            {{ tile.destructionLevel }}% — Continuez le siège pour raser ce village
          </p>
        </div>
      </div>

      <!-- Troupes en route -->
      <div
        v-for="movement in mapStore.getMovementsToTile(tile.id)"
        :key="movement.id"
        class="bcard bcard--kpi cell-half"
        :style="cardTone('warning')"
      >
        <div class="bcard-body">
          <div class="bcard-head">
            <span class="bcard-icon">🪖</span>
            <span class="bcard-title">Troupes en route</span>
            <span class="transit-eta" v-if="movement.arrivalTime > now">
              {{ formatRemaining(movement.arrivalTime - now) }}
            </span>
            <span class="transit-eta" v-else>imminente...</span>
          </div>
          <ProgressBar :value="transitProgress(movement)" tone="warning" />
          <!-- Rappel du contenu du convoi -->
          <div class="loot-badges">
            <Badge v-for="u in movement.units" :key="u.type" tone="neutral">
              {{ u.count }} × {{ u.type }}
            </Badge>
          </div>
        </div>
      </div>

      <!-- Bonus -->
      <div v-if="tile.bonus" class="bcard bcard--kpi cell-half" :style="cardTone('success')">
        <div class="bcard-body">
          <div class="bcard-head">
            <span class="bcard-icon">💫</span>
            <span class="bcard-title">Bonus</span>
          </div>
          <p class="bcard-text">{{ tile.bonus }}</p>
        </div>
      </div>

      <!-- ── 5. Tertiaire ── -->

      <!-- Ressources du terrain : une ligne de badges, pas une grille de tuiles -->
      <div v-if="tile.resources" class="bcard bcard--kpi cell-wide" :style="cardTone('neutral')">
        <div class="bcard-body">
          <div class="bcard-head">
            <span class="bcard-icon">📦</span>
            <span class="bcard-title">Ressources disponibles</span>
          </div>
          <div class="loot-badges">
            <template v-for="(amount, resource) in tile.resources" :key="resource">
              <Badge tone="neutral" :title="resource as string">
                {{ getResourceIcon(resource as string) }} {{ amount }}
              </Badge>
              <Badge
                v-if="resourceBonusPct(resource as string) > 0"
                tone="success"
                :title="`Bonus reliques : +${resourceBonusPct(resource as string)}%`"
              >
                +{{ resourceBonusPct(resource as string) }}%
              </Badge>
            </template>
          </div>
        </div>
      </div>

      <!-- Commerce : zéro carte pour zéro fonctionnalité — une simple ligne -->
      <div v-if="canTradeTile(tile)" class="tile-footer cell-wide">
        <IconRow icon="🤝" label="Commerce" sublabel="Bientôt disponible" tone="muted" />
      </div>

      <!-- Ruines déjà fouillées : simple rappel, plus rien à y gagner -->
      <div v-if="tile.type === 'ruins' && tile.treasureLootedAt" class="tile-footer cell-wide">
        <IconRow
          icon="💎"
          label="Trésor récupéré"
          sublabel="Ces ruines ont déjà été fouillées"
          tone="muted"
        />
      </div>

      <!-- Raccourci vers la gestion du village (tuile du joueur, sinon cul-de-sac) -->
      <div v-if="tile.type === 'village_player'" class="cell-wide">
        <Button variant="secondary" @click="router.push({ name: 'campaign-village' })">
          🏠 Aller au village →
        </Button>
      </div>

      <!-- Debug : détails de la forteresse (affiché uniquement pour une forteresse) -->
      <MapDebugPanel
        v-if="tile.type === 'stronghold' && tileZone"
        class="cell-wide"
        title="🔍 Debug — Données de la zone"
        :rows="fortressDebugRows(tileZone)"
      >
        <template v-if="tileZone.villageIds.length > 0">
          <SectionLabel>Colonies contrôlées :</SectionLabel>
          <Badge
            v-for="vid in tileZone.villageIds"
            :key="vid"
            tone="epic"
            class="fdbg-village-chip"
          >
            {{ villageDebugLabel(vid) }}
          </Badge>
        </template>
      </MapDebugPanel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  useMapStore,
  estimateGarrisonStrength,
  RUIN_TREASURE_RANGE,
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
import { getVillageDev } from '@/game/timePressure'
import { formatDuration } from '../../utils/formatDuration'
import Badge from '@/components/ui/Badge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import InfoPopover from '@/components/ui/InfoPopover.vue'
import IconRow from '@/components/ui/IconRow.vue'
import Button from '@/components/ui/Button.vue'
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
const router = useRouter()

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

/** Vrai si au moins une carte KPI (garnison / butin / hostilité) est affichée */
const hasKpiRow = computed(() => {
  if (!props.tile) return false
  const hasLoot =
    !!props.tile.lootStock &&
    (props.tile.type === 'village_enemy' || props.tile.type === 'stronghold')
  return !!garrisonEstimate.value || !!tileZone.value || hasLoot
})

/** Fatigue militaire effective de la zone (repos gagné en repoussant ses raids) */
const zoneFatigue = computed(() => {
  if (!tileZone.value) return 0
  void now.value // decay continu → refresh périodique
  return Math.round(mapStore.getEffectiveFatigue(tileZone.value.fortressTileId))
})

/** Vrai si la zone est trop épuisée pour attaquer */
const zoneIsExhausted = computed(
  () => !!tileZone.value && mapStore.isZoneExhausted(tileZone.value.fortressTileId),
)

/** Hint narratif d'hostilité — une ligne, tronquée en CSS, texte complet en title */
const zoneHint = computed(() => {
  switch (tileZone.value?.hostilityState) {
    case 'warned':
      return 'La forteresse surveille vos agissements. Continuez à attaquer et elle deviendra hostile.'
    case 'hostile':
      return "La forteresse envoie des raids périodiques sur votre ville. Détruisez-la pour l'arrêter."
    default:
      return "Attaquer ce territoire augmentera l'hostilité de la forteresse qui le contrôle."
  }
})

/**
 * Tuile de la forteresse contrôlant le village affiché — sert de lien de
 * navigation. Null pour une forteresse (la tuile EST la forteresse) ou si
 * la forteresse n'est pas encore explorée (non sélectionnable sur la carte).
 */
const controllingFortress = computed((): MapTile | null => {
  if (!props.tile || props.tile.type !== 'village_enemy' || !tileZone.value) return null
  const fortress = mapStore.getTileById(tileZone.value.fortressTileId)
  return fortress?.explored ? fortress : null
})

/** Villages explorés contrôlés par la forteresse affichée (chips de navigation) */
const controlledVillages = computed((): MapTile[] => {
  if (props.tile?.type !== 'stronghold' || !tileZone.value) return []
  return tileZone.value.villageIds
    .map((id) => mapStore.getTileById(id))
    .filter((t): t is MapTile => !!t && t.explored)
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

/** Libellé lisible d'une colonie pour le debug : id + coordonnées si connues */
const villageDebugLabel = (vid: string): string => {
  const t = mapStore.getTileById(vid)
  return t ? `${vid} (${t.position.x}, ${t.position.y})` : vid
}

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
  selectTile: [tileId: string]
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

/** Métadonnées d'affichage des 4 ressources de butin */
const LOOT_META = [
  { key: 'gold', icon: '🪙', label: 'Or' },
  { key: 'wood', icon: '🪵', label: 'Bois' },
  { key: 'iron', icon: '⚒️', label: 'Fer' },
  { key: 'crop', icon: '🌾', label: 'Céréales' },
] as const

const lootBadges = computed(() =>
  LOOT_META.map((m) => ({ ...m, amount: estimatedLoot.value[m.key] })).filter((b) => b.amount > 0),
)

/** Fourchettes du trésor des ruines, affichées avant l'expédition (LA promesse de la carte) */
const treasureRangeBadges = LOOT_META.map((m) => ({
  ...m,
  min: RUIN_TREASURE_RANGE[m.key].min,
  max: RUIN_TREASURE_RANGE[m.key].max,
}))

/** Total emportable avec l'armée actuelle */
const estimatedLootTotal = computed(() => {
  const l = estimatedLoot.value
  return l.gold + l.wood + l.iron + l.crop
})

/** Stock total pillable du village (avant limite de capacité) */
const lootStockTotal = computed(() => {
  const s = props.tile?.lootStock
  return s ? s.gold + s.wood + s.iron + s.crop : 0
})

/** Part du stock que l'armée actuelle peut emporter (0–100) */
const lootRatioPct = computed(() =>
  lootStockTotal.value > 0 ? (estimatedLootTotal.value / lootStockTotal.value) * 100 : 0,
)

/**
 * Estimation de la force de la garnison ennemie — affichée AVANT que le joueur engage ses
 * troupes, pour éviter de miser à l'aveugle. Lecture seule : ne génère jamais la vraie
 * garnison (voir estimateGarrisonStrength dans mapStore.ts pour le détail de la formule).
 */
const garrisonEstimate = computed(() => {
  if (!props.tile) return null
  if (props.tile.type !== 'village_enemy' && props.tile.type !== 'stronghold') return null
  void now.value // l'estimation grossit avec la pression du temps → refresh périodique
  return estimateGarrisonStrength(props.tile)
})

/** Tone Badge selon le palier de force de la garnison estimée */
const GARRISON_TIER_TONES: Record<string, Tone> = {
  Faible: 'success',
  Modérée: 'warning',
  Forte: 'danger',
}
const garrisonVariant = (label: string): Tone => GARRISON_TIER_TONES[label] ?? 'warning'

/**
 * Pression du temps : badge « En expansion » quand le village s'est notablement
 * développé (dev ≥ 1.3), en tone danger au-delà de 2.0. null = pas de badge.
 */
const villageExpansionTone = computed<Tone | null>(() => {
  if (!props.tile) return null
  void now.value // le développement évolue avec l'horloge de mission
  const dev = getVillageDev(props.tile)
  if (dev >= 2.0) return 'danger'
  if (dev >= 1.3) return 'warning'
  return null
})

/** Progression de la régénération de la garnison (0–100) */
const garrisonRegenPct = computed(() => {
  const regenStartedAt = props.tile?.garrison?.regenStartedAt
  if (!regenStartedAt) return 0
  const elapsed = now.value - regenStartedAt
  return Math.min(100, Math.floor((elapsed / GARRISON_REGEN_DURATION_MS) * 100))
})

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

/** Teinte d'accent d'une cellule bento selon son tone sémantique (mécanisme --tc) */
const TONE_TC: Record<string, string> = {
  success: 'var(--color-success-strong-rgb)',
  warning: 'var(--color-warning-rgb)',
  danger: 'var(--color-danger-rgb)',
  info: 'var(--color-info-rgb)',
  accent: 'var(--color-accent-rgb)',
  neutral: 'var(--overlay-rgb)',
}

const cardTone = (tone: Tone | 'info' | 'accent' | 'neutral') => ({
  '--tc': TONE_TC[tone] ?? TONE_TC.neutral,
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

/** Tone ProgressBar selon la sévérité des dégâts */
const destructionSeverity = (level: number): Tone => {
  if (level <= 50) return 'warning'
  return 'danger'
}

/** Tone Badge/ProgressBar selon l'état d'hostilité d'une zone */
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
}

/* ── Grille Bento : 6 colonnes pour composer tiers (span 2), moitiés (span 3)
   et pleine largeur — même gap que le bento village ── */
.tile-bento {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-auto-flow: dense;
  gap: 12px;
}

.cell-wide {
  grid-column: 1 / -1;
}

.cell-half {
  grid-column: span 3;
}

/* Rangée KPI : auto-fit pour que 1, 2 ou 3 cartes remplissent toujours la
   largeur — pas de piste vide quand une carte conditionnelle est absente. */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

/* ── Cellule bento générique — vocabulaire de BuildingCard.vue ── */
.bcard {
  position: relative;
  border-radius: 16px;
  border: 1.5px solid rgba(var(--overlay-rgb), 0.12);
  background: var(--color-bg-surface);
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(var(--overlay-rgb), 0.05),
    0 4px 12px -6px rgba(var(--overlay-rgb), 0.15);
}

.bcard::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: rgba(var(--tc), 0.85);
  z-index: 2;
}

/* Discipline de ton : les cartes d'information portent une barre fine et AUCUN
   wash — la couleur y est un signal (badge, barre), pas une texture. Seules
   les cellules "chaudes" (hero, attaque) ont droit au wash + glyphe. */
.bcard--kpi::before {
  width: 3px;
  background: rgba(var(--tc), 0.7);
}

.bcard-art {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(130% 100% at 12% -10%, rgba(var(--tc), 0.14), transparent 62%),
    linear-gradient(165deg, rgba(var(--tc), 0.05), transparent 75%);
}

.bcard-art::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 30%, var(--color-bg-surface) 92%);
}

.bcard-glyph {
  position: absolute;
  right: -0.3em;
  bottom: -0.25em;
  font-size: 3.4rem;
  line-height: 1;
  opacity: 0.1;
  transform: rotate(-6deg);
}

.bcard-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  padding: 14px 16px;
  box-sizing: border-box;
}

.bcard-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bcard-icon {
  font-size: 1.2rem;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 3px rgba(var(--overlay-rgb), 0.25));
}

.bcard-title {
  flex: 1;
  font-size: 0.76em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  min-width: 0;
}

.bcard-text {
  margin: 0;
  font-size: 0.88em;
  color: var(--color-text);
  line-height: 1.5;
}

/* ── Valeurs KPI : label au-dessus (bcard-head), valeur héro en dessous,
   alignée à gauche — jamais de space-between horizontal dans une cellule ── */
.kpi-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.kpi-unit {
  font-size: 0.55em;
  font-weight: 600;
  color: var(--color-text-faint);
}

.kpi-legend {
  margin: 0;
  font-size: 0.72em;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.kpi-sub {
  margin: 0;
  font-size: 0.78em;
  color: var(--color-text-muted);
}

.kpi-sub--danger {
  color: var(--color-danger-light);
  font-variant-numeric: tabular-nums;
}

/* ── Textes d'aide : une ligne, tronquée, texte complet en title ── */
.bhint {
  font-size: 0.75em;
  color: var(--color-text-faint);
  margin: 0;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bhint--warning {
  color: var(--color-warning);
}

/* ── Cellule Attaque : la seule au wash visible ── */
.bcard--attack .bcard-art {
  background:
    radial-gradient(130% 100% at 12% -10%, rgba(var(--tc), 0.12), transparent 62%),
    linear-gradient(165deg, rgba(var(--tc), 0.05), transparent 75%);
}

.bcard--attack .bcard-glyph {
  font-size: 4.5rem;
  opacity: 0.08;
}

/* ── Bannière hero compacte — l'identité de la tuile, pas un poster ── */
.tile-hero {
  position: relative;
  border-radius: 16px;
  padding: 14px 18px;
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
    radial-gradient(130% 100% at 12% -10%, rgba(var(--tc), 0.28), transparent 62%),
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
  bottom: -0.3em;
  font-size: 4rem;
  line-height: 1;
  opacity: 0.16;
  transform: rotate(-6deg);
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}

.hero-icon {
  font-size: 40px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 3px rgba(var(--overlay-rgb), 0.25));
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hero-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.hero-title {
  margin: 0;
  font-size: 1.25em;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.1;
}

.hero-desc {
  margin: 0;
  color: var(--color-text-faint);
  font-style: italic;
  font-size: 0.85em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Troupes en transit ── */
.transit-eta {
  font-variant-numeric: tabular-nums;
  color: var(--color-warning);
  font-size: 0.9em;
  font-weight: 600;
}

.fdbg-village-chip {
  font-family: monospace;
}

/* ── Liens de navigation de zone (forteresse ↔ villages) ── */
.zone-fortress-link {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.82em;
  font-weight: 600;
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.zone-fortress-link:hover {
  filter: brightness(1.15);
}

.zone-villages {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.zone-village-chip {
  cursor: pointer;
  font-size: 0.75em;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(var(--overlay-rgb), 0.18);
  background: rgba(var(--overlay-rgb), 0.05);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.zone-village-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* ── Butin / ressources : ligne de badges compacte ── */
.loot-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Détail de capacité dans le popover 🎒 */
.carry-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.carry-detail-title {
  font-weight: 700;
  font-size: 0.85em;
  color: var(--color-text);
}

.carry-detail-row {
  font-size: 0.82em;
  font-variant-numeric: tabular-nums;
}

/* ── Pied de page tertiaire (commerce à venir) ── */
.tile-footer {
  padding: 4px 8px;
  opacity: 0.75;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .tile-bento {
    grid-template-columns: 1fr;
  }

  .cell-half {
    grid-column: 1 / -1;
  }
}
</style>
