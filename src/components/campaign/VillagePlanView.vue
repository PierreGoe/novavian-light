<template>
  <section class="village-plan-section">
    <div class="plan-title">
      <h3>Plan du Village</h3>
      <span class="hq-badge">QG niv. {{ hqLevel }}</span>
      <!-- Tooltip légende -->
      <div
        class="legend-tooltip-wrap"
        @focusout="onLegendFocusOut"
        @keydown.esc="showLegend = false"
      >
        <button
          class="legend-trigger"
          type="button"
          :aria-expanded="showLegend"
          aria-label="Légende des états de bâtiment"
          @click="showLegend = !showLegend"
        >
          ℹ️
        </button>
        <div class="legend-tooltip" v-show="showLegend">
          <div class="legend-item legend-upgradable">⬆️ Améliorable</div>
          <div class="legend-item legend-available">✨ Disponible</div>
          <div class="legend-item legend-constructing">🏗️ En chantier</div>
          <div class="legend-item legend-waiting">🪙 Ressources insuffisantes</div>
          <div class="legend-item legend-locked">🔒 Verrouillé (QG requis)</div>
          <div class="legend-item legend-maxed">✅ Niveau maximum</div>
        </div>
      </div>
    </div>

    <!-- Carte du village (grille) -->
    <div class="village-map">
      <!-- Routes SVG en fond -->
      <svg class="map-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <!-- Routes rayonnant depuis HQ (50,50) vers chaque bâtiment -->
        <line x1="50" y1="50" x2="20" y2="20" />
        <line x1="50" y1="50" x2="80" y2="20" />
        <line x1="50" y1="50" x2="20" y2="50" />
        <line x1="50" y1="50" x2="20" y2="80" />
        <line x1="50" y1="50" x2="80" y2="80" />
        <!-- Place centrale -->
        <circle cx="50" cy="50" r="3" class="road-center" />
      </svg>

      <!-- Tuiles des bâtiments -->
      <div
        v-for="def in ALL_BUILDINGS"
        :key="def.type"
        class="building-tile"
        :class="[
          `tile-${def.type}`,
          `state-${getBuildingState(def.type)}`,
          { selected: selectedType === def.type },
        ]"
        v-clickable
        @click="toggleSelect(def.type)"
      >
        <div class="tile-inner">
          <!-- Icône + badge niveau + anneau de progression du chantier -->
          <div class="tile-icon-wrap">
            <svg
              v-if="getBuildingState(def.type) === 'constructing'"
              viewBox="0 0 48 48"
              class="tile-progress-svg"
              aria-hidden="true"
            >
              <circle class="tile-progress-track" cx="24" cy="24" r="19" />
              <circle
                class="tile-progress-ring"
                cx="24"
                cy="24"
                r="19"
                :stroke-dasharray="tileRingCircumference"
                :stroke-dashoffset="
                  tileRingCircumference * (1 - getConstructionProgress(def.type) / 100)
                "
              />
            </svg>
            <span
              class="tile-icon"
              :class="{
                'tile-icon--locked': getBuildingState(def.type) === 'locked',
                'tile-icon--constructing': getBuildingState(def.type) === 'constructing',
              }"
            >
              {{ def.icon }}
            </span>
            <span
              v-if="getBuilding(def.type) && getBuilding(def.type)!.level > 0"
              class="level-badge"
              :class="{ 'level-badge--maxed': getBuildingState(def.type) === 'maxed' }"
            >
              {{ getBuilding(def.type)!.level }}
            </span>
          </div>
          <!-- Nom (abrégé en "QG" pour le Bâtiment Principal, trop long pour la tuile) -->
          <div class="tile-name">{{ getTileLabel(def.type) }}</div>
          <!-- Statut -->
          <div class="tile-status">
            <template v-if="getBuildingState(def.type) === 'locked'"
              >QG {{ def.hqLevelRequired }}</template
            >
            <template v-else-if="getBuildingState(def.type) === 'available'">construire</template>
            <template v-else-if="getBuildingState(def.type) === 'constructing'"
              >🏗️ {{ getRemainingConstructionTime(def.type) }}</template
            >
            <template v-else-if="getBuildingState(def.type) === 'upgradable'">▲ améliorer</template>
            <template v-else-if="getBuildingState(def.type) === 'waiting'">⏳ ressources</template>
            <template v-else-if="getBuildingState(def.type) === 'maxed'">max</template>
          </div>
          <!-- Bouton action rapide -->
          <button
            v-if="getBuildingState(def.type) === 'upgradable' || getBuildingState(def.type) === 'available'"
            class="quick-btn"
            :class="{ 'quick-btn--build': getBuildingState(def.type) === 'available' }"
            @click.stop="quickAction(def.type)"
          >
            {{ getBuildingState(def.type) === 'upgradable' ? '▲' : '+' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Panneau de détails du bâtiment sélectionné -->
    <Transition name="slide-up">
      <div v-if="selectedDef" class="detail-panel" :class="`detail-state-${selectedState}`">
        <div class="detail-header">
          <span class="detail-icon">{{
            selectedState === 'locked' ? '🔒' : selectedDef.icon
          }}</span>
          <div>
            <div class="detail-name">{{ selectedDef.name }}</div>
            <div class="detail-desc">{{ selectedDef.description }}</div>
          </div>
          <button class="detail-close" @click="selectedType = null">✕</button>
        </div>

        <!-- Bâtiment verrouillé -->
        <div v-if="selectedState === 'locked'" class="detail-locked-info">
          <div class="locked-message">
            🔒 Ce bâtiment sera disponible quand votre Bâtiment Principal atteindra le
            <strong>niveau {{ selectedDef.hqLevelRequired }}</strong
            >.
          </div>
          <div class="hq-progress">
            <span class="hq-current">QG actuel : niveau {{ hqLevel }}</span>
            <span class="hq-needed">→ Niveau {{ selectedDef.hqLevelRequired }} requis</span>
          </div>
        </div>

        <!-- Bâtiment disponible (pas encore construit) -->
        <div v-else-if="selectedState === 'available'" class="detail-available-info">
          <div class="available-message">
            ✨ Cet emplacement est libre. Construisez ce bâtiment pour en profiter !
          </div>
          <div class="build-costs">
            <span class="costs-label">Coût de construction (niveau 1)</span>
            <div class="costs-row">
              <span
                class="cost-chip"
                :class="{ insufficient: (town?.resources?.wood || 0) < selectedBuildCost.wood }"
              >
                🪵 {{ selectedBuildCost.wood }}
              </span>
              <span
                class="cost-chip"
                :class="{ insufficient: (town?.resources?.clay || 0) < selectedBuildCost.clay }"
              >
                🧱 {{ selectedBuildCost.clay }}
              </span>
              <span
                class="cost-chip"
                :class="{ insufficient: (town?.resources?.iron || 0) < selectedBuildCost.iron }"
              >
                ⚒️ {{ selectedBuildCost.iron }}
              </span>
              <span
                class="cost-chip"
                :class="{ insufficient: (town?.resources?.crop || 0) < selectedBuildCost.crop }"
              >
                🌾 {{ selectedBuildCost.crop }}
              </span>
            </div>
          </div>

          <!-- Bouton construire -->
          <button
            class="upgrade-btn"
            :class="{ 'upgrade-btn-ready': canAffordBuild }"
            :disabled="!canAffordBuild"
            @click="doBuild()"
          >
            {{ canAffordBuild ? 'Construire' : 'Ressources insuffisantes' }}
          </button>
        </div>

        <!-- Bâtiment construit -->
        <template v-else-if="selectedBuilding">
          <!-- Chantier en cours -->
          <div v-if="selectedState === 'constructing'" class="detail-constructing-info">
            <div class="constructing-message">
              🏗️ Chantier en cours — niveau {{ selectedBuilding.level + 1 }}
            </div>
            <div class="construction-progress-bar">
              <div
                class="construction-progress-fill"
                :style="{ width: getConstructionProgress(selectedDef.type) + '%' }"
              ></div>
            </div>
            <div class="construction-eta">
              ⏱️ Terminé dans {{ getRemainingConstructionTime(selectedDef.type) }}
            </div>
            <button class="upgrade-btn" disabled>🏗️ Chantier en cours…</button>
          </div>

          <template v-else>
            <!-- Production actuelle -->
            <div v-if="getProductionGain(selectedDef.type)" class="detail-production">
              <span class="production-label">Production actuelle</span>
              <span class="production-value">
                {{ getProductionIcon(selectedDef.type) }}
                +{{ getProductionGain(selectedDef.type)! * selectedBuilding.level }}/min
              </span>
            </div>

            <!-- Niveau max atteint -->
            <div v-if="selectedState === 'maxed'" class="detail-maxed">
              <span>✅ Niveau maximum ({{ selectedDef.maxLevel }}) atteint</span>
            </div>

            <!-- Section amélioration -->
            <div v-else class="detail-upgrade">
              <div class="upgrade-header">
                <span class="upgrade-label">⬆️ Niveau {{ selectedBuilding.level + 1 }}</span>
                <span v-if="getProductionGain(selectedDef.type)" class="upgrade-gain">
                  {{ getProductionIcon(selectedDef.type) }}
                  {{ getProductionGain(selectedDef.type)! * selectedBuilding.level }}
                  <span class="gain-arrow">→</span>
                  {{ getProductionGain(selectedDef.type)! * (selectedBuilding.level + 1) }}/min
                </span>
              </div>

              <div class="upgrade-costs">
                <span
                  class="cost-chip"
                  :class="{
                    insufficient:
                      (town?.resources?.wood || 0) <
                      getUpgradeCost(selectedDef.type, selectedBuilding.level).wood,
                  }"
                >
                  🪵 {{ getUpgradeCost(selectedDef.type, selectedBuilding.level).wood }}
                </span>
                <span
                  class="cost-chip"
                  :class="{
                    insufficient:
                      (town?.resources?.clay || 0) <
                      getUpgradeCost(selectedDef.type, selectedBuilding.level).clay,
                  }"
                >
                  🧱 {{ getUpgradeCost(selectedDef.type, selectedBuilding.level).clay }}
                </span>
                <span
                  class="cost-chip"
                  :class="{
                    insufficient:
                      (town?.resources?.iron || 0) <
                      getUpgradeCost(selectedDef.type, selectedBuilding.level).iron,
                  }"
                >
                  ⚒️ {{ getUpgradeCost(selectedDef.type, selectedBuilding.level).iron }}
                </span>
                <span
                  class="cost-chip"
                  :class="{
                    insufficient:
                      (town?.resources?.crop || 0) <
                      getUpgradeCost(selectedDef.type, selectedBuilding.level).crop,
                  }"
                >
                  🌾 {{ getUpgradeCost(selectedDef.type, selectedBuilding.level).crop }}
                </span>
              </div>

              <!-- Temps estimé si ressources insuffisantes -->
              <div v-if="selectedState === 'waiting' && getTimeUntilUpgrade()" class="upgrade-eta">
                ⏱️ Disponible dans {{ getTimeUntilUpgrade() }}
              </div>

              <!-- Bouton améliorer -->
              <button
                class="upgrade-btn"
                :class="{ 'upgrade-btn-ready': selectedState === 'upgradable' }"
                :disabled="selectedState !== 'upgradable'"
                @click="doUpgrade()"
              >
                {{
                  selectedState === 'upgradable'
                    ? `Améliorer → Niv. ${selectedBuilding.level + 1}`
                    : 'Ressources insuffisantes'
                }}
              </button>
            </div>
          </template>
        </template>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { useToastStore } from '@/stores/toastStore'
import {
  BUILDING_DEFINITIONS,
  getBuildingUpgrade,
  getHQLevel,
  canBuildingBeUpgraded,
  isBuildingUnlocked,
} from '@/data/buildings'
import type { BuildingType } from '@/data/buildings'
// Ordre d'affichage des bâtiments sur la carte
const ALL_BUILDINGS = Object.values(BUILDING_DEFINITIONS)

const missionStore = useMissionStore()
const toastStore = useToastStore()
const town = computed(() => missionStore.town.value)

// Horloge locale rafraîchie chaque seconde, pour que les anneaux/temps restants de
// chantier se mettent à jour en direct (même pattern que UnitsTrainingSection).
const now = ref(Date.now())
let tickInterval: number | null = null
onMounted(() => {
  tickInterval = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (tickInterval) clearInterval(tickInterval)
})

// Anneau de progression sur les tuiles (rayon 19 sur un viewBox 48x48)
const TILE_RING_RADIUS = 19
const tileRingCircumference = 2 * Math.PI * TILE_RING_RADIUS

const hqLevel = computed(() => getHQLevel(town.value?.buildings ?? []))

// Légende des états de bâtiment — accessible au clic/clavier, pas seulement au survol
const showLegend = ref(false)
const onLegendFocusOut = (e: FocusEvent) => {
  const nextTarget = e.relatedTarget as Node | null
  if (!nextTarget || !(e.currentTarget as HTMLElement).contains(nextTarget)) {
    showLegend.value = false
  }
}

// Bâtiment sélectionné pour le panneau de détails
const selectedType = ref<BuildingType | null>(null)

const toggleSelect = (type: BuildingType) => {
  selectedType.value = selectedType.value === type ? null : type
}

// Récupère l'instance construite d'un bâtiment (ou null si pas encore construit)
const getBuilding = (type: BuildingType) =>
  town.value?.buildings?.find((b) => b.type === type) ?? null

// Libellé affiché sur la tuile : "Bâtiment Principal" est abrégé en "QG"
// (terminologie déjà utilisée ailleurs dans cette vue) pour éviter la troncature,
// les autres noms de bâtiments tiennent tous dans la largeur de la tuile.
const getTileLabel = (type: BuildingType): string =>
  type === 'headquarters' ? 'QG' : BUILDING_DEFINITIONS[type].name

// État d'un bâtiment : locked | available | constructing | upgradable | waiting | maxed
type BuildingState = 'locked' | 'available' | 'constructing' | 'upgradable' | 'waiting' | 'maxed'

const getBuildingState = (type: BuildingType): BuildingState => {
  const def = BUILDING_DEFINITIONS[type]
  if (!isBuildingUnlocked(type, hqLevel.value)) return 'locked'

  const building = getBuilding(type)
  if (!building) return 'available'

  // Chantier en cours (construction initiale ou amélioration) — un seul à la fois
  if (building.isUnderConstruction) return 'constructing'

  if (building.level >= def.maxLevel) return 'maxed'

  // Le bâtiment est construit et peut encore monter de niveau
  if (!canBuildingBeUpgraded(type, building.level, hqLevel.value)) return 'maxed'

  const cost = getBuildingUpgrade(def.type, building.level)
  const res = town.value?.resources
  if (
    res &&
    res.wood >= cost.wood &&
    res.clay >= cost.clay &&
    res.iron >= cost.iron &&
    res.crop >= cost.crop
  ) {
    return 'upgradable'
  }
  return 'waiting'
}

// --- Données du panneau de détails ---
const selectedDef = computed(() =>
  selectedType.value ? BUILDING_DEFINITIONS[selectedType.value] : null,
)
const selectedBuilding = computed(() =>
  selectedType.value ? getBuilding(selectedType.value) : null,
)
const selectedState = computed(() =>
  selectedType.value ? getBuildingState(selectedType.value) : null,
)

// Coût de construction (niveau 0 → 1)
const selectedBuildCost = computed(() =>
  selectedDef.value
    ? getBuildingUpgrade(selectedDef.value.type, 0)
    : { wood: 0, clay: 0, iron: 0, crop: 0 },
)

// --- Helpers de production ---
const getProductionGain = (type: BuildingType): number | null =>
  BUILDING_DEFINITIONS[type]?.productionPerLevel?.amount ?? null

const getProductionIcon = (type: BuildingType): string => {
  const resource = BUILDING_DEFINITIONS[type]?.productionPerLevel?.resource
  const icons: Record<string, string> = { wood: '🪵', clay: '🧱', iron: '⚒️', crop: '🌾' }
  return resource ? (icons[resource] ?? '') : ''
}

const getUpgradeCost = (type: BuildingType, level: number) => getBuildingUpgrade(type, level)

// Calcule le temps avant d'avoir les ressources pour améliorer le bâtiment sélectionné
const getTimeUntilUpgrade = (): string | null => {
  if (!selectedBuilding.value || !selectedDef.value) return null
  const resources = town.value?.resources
  const production = town.value?.production
  if (!resources || !production) return null
  const cost = getUpgradeCost(selectedDef.value.type, selectedBuilding.value.level)
  const minutesNeeded: number[] = []

  const check = (current: number, needed: number, rate: number) => {
    if (current >= needed) return
    minutesNeeded.push(rate <= 0 ? Infinity : (needed - current) / rate)
  }
  check(resources.wood, cost.wood, production.wood)
  check(resources.clay, cost.clay, production.clay)
  check(resources.iron, cost.iron, production.iron)
  check(resources.crop, cost.crop, production.crop)

  if (minutesNeeded.length === 0) return null
  const maxMin = Math.max(...minutesNeeded)
  if (!isFinite(maxMin)) return 'Production nulle'
  const totalSec = Math.ceil(maxMin * 60)
  if (totalSec < 60) return `${totalSec}s`
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}min`
  return s === 0 ? `${m}min` : `${m}min ${s}s`
}

// --- Progression du chantier (construction / amélioration en cours) ---
// La durée totale du chantier n'est pas stockée : on la retrouve depuis la table de coûts
// (getBuildingUpgrade(type, level).buildTime), le niveau actuel étant celui d'AVANT le
// chantier tant qu'il n'est pas finalisé par processConstructionQueue().
const getConstructionDurationMs = (type: BuildingType, levelBeforeUpgrade: number): number =>
  getBuildingUpgrade(type, levelBeforeUpgrade).buildTime * 1000

const getConstructionProgress = (type: BuildingType): number => {
  const building = getBuilding(type)
  if (!building?.isUnderConstruction || !building.constructionEndTime) return 0
  const duration = getConstructionDurationMs(type, building.level)
  if (duration <= 0) return 100
  const startedAt = building.constructionEndTime - duration
  const elapsed = now.value - startedAt
  return Math.min(100, Math.max(0, Math.round((elapsed / duration) * 100)))
}

const formatConstructionDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}min`
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

const getRemainingConstructionTime = (type: BuildingType): string => {
  const building = getBuilding(type)
  if (!building?.constructionEndTime) return ''
  const remaining = Math.max(0, Math.ceil((building.constructionEndTime - now.value) / 1000))
  return formatConstructionDuration(remaining)
}

// --- Action ---
const doUpgrade = () => {
  if (!selectedBuilding.value || !selectedDef.value) return
  const newLevel = selectedBuilding.value.level + 1
  if (missionStore.upgradeBuilding(selectedBuilding.value.id)) {
    toastStore.showSuccess(`🏗️ Chantier lancé : ${selectedDef.value.name} → niveau ${newLevel}`, {
      duration: 2500,
    })
  } else {
    toastStore.showError("Ressources insuffisantes pour l'amélioration", { duration: 2000 })
  }
}

// --- Construction d'un nouveau bâtiment ---
const canAffordBuild = computed(() => {
  if (!selectedDef.value) return false
  const res = town.value?.resources
  if (!res) return false
  const cost = selectedBuildCost.value
  return (
    res.wood >= cost.wood && res.clay >= cost.clay && res.iron >= cost.iron && res.crop >= cost.crop
  )
})

const doBuild = () => {
  if (!selectedDef.value) return
  if (missionStore.constructBuilding(selectedDef.value.type)) {
    toastStore.showSuccess(`🏗️ Chantier de ${selectedDef.value.name} lancé !`, { duration: 2000 })
  } else {
    toastStore.showError('Construction impossible', { duration: 2000 })
  }
}

// Action rapide directement depuis la tuile (sans ouvrir le panneau)
const quickAction = (type: BuildingType) => {
  const state = getBuildingState(type)
  const def = BUILDING_DEFINITIONS[type]
  if (state === 'upgradable') {
    const building = getBuilding(type)
    const newLevel = building ? building.level + 1 : 0
    if (building && missionStore.upgradeBuilding(building.id)) {
      toastStore.showSuccess(`🏗️ Chantier lancé : ${def.name} → niveau ${newLevel}`, {
        duration: 2500,
      })
    } else {
      toastStore.showError('Ressources insuffisantes', { duration: 2000 })
    }
  } else if (state === 'available') {
    if (missionStore.constructBuilding(type)) {
      toastStore.showSuccess(`🏗️ Chantier de ${def.name} lancé !`, { duration: 2000 })
    } else {
      toastStore.showError('Ressources insuffisantes', { duration: 2000 })
    }
  }
}
</script>

<style scoped>
/* ---- Conteneur principal ---- */
.village-plan-section {
  margin-bottom: 2rem;
}

.plan-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.plan-title h3 {
  margin: 0;
  color: #daa520;
  font-size: 1.2rem;
}

.hq-badge {
  font-size: 0.72rem;
  font-weight: normal;
  padding: 0.15rem 0.55rem;
  background: rgba(218, 165, 32, 0.12);
  border: 1px solid rgba(218, 165, 32, 0.35);
  border-radius: 10px;
  color: #daa520;
}

/* ---- Tooltip légende ---- */
.legend-tooltip-wrap {
  position: relative;
  margin-left: auto;
  display: flex;
  align-items: center;
}

.legend-trigger {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.9rem;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s;
  user-select: none;
}
.legend-trigger:hover,
.legend-trigger[aria-expanded='true'] {
  opacity: 1;
}
.legend-trigger:focus-visible {
  outline: 2px solid #daa520;
  outline-offset: 2px;
}

.legend-tooltip {
  display: flex;
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 100;
  background: rgba(10, 20, 10, 0.97);
  border: 1px solid rgba(218, 165, 32, 0.3);
  border-radius: 10px;
  padding: 0.6rem 0.75rem;
  min-width: 200px;
  flex-direction: column;
  gap: 0.35rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.legend-item {
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  border-radius: 7px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.legend-upgradable {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.4);
  color: #4ade80;
}
.legend-available {
  background: rgba(96, 165, 250, 0.12);
  border-color: rgba(96, 165, 250, 0.4);
  color: #93c5fd;
}
.legend-constructing {
  background: rgba(218, 165, 32, 0.12);
  border-color: rgba(218, 165, 32, 0.4);
  color: #daa520;
}
.legend-waiting {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
}
.legend-locked {
  background: rgba(107, 114, 128, 0.15);
  border-color: rgba(107, 114, 128, 0.35);
  color: #9ca3af;
}
.legend-maxed {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.35);
  color: #c4b5fd;
}

/* ---- Carte du village ---- */
.village-map {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr;
  grid-template-rows: 1fr 1fr 1fr;
  grid-template-areas:
    'lumb  .    farm'
    'bar   hq   .   '
    'quar  .    mine';
  gap: 0.65rem;
  padding: 1.4rem 1.2rem;
  background:
    radial-gradient(ellipse at 55% 45%, rgba(40, 80, 25, 0.5) 0%, transparent 55%),
    radial-gradient(ellipse at 20% 80%, rgba(60, 40, 15, 0.3) 0%, transparent 40%),
    radial-gradient(ellipse at 80% 15%, rgba(20, 40, 60, 0.2) 0%, transparent 35%),
    linear-gradient(160deg, rgba(14, 26, 10, 0.97) 0%, rgba(8, 14, 6, 0.99) 100%);
  border: 1px solid rgba(80, 120, 55, 0.2);
  border-radius: 14px;
  overflow: hidden;
  min-height: 260px;
}

/* SVG des routes */
.map-roads {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

.map-roads line {
  stroke: rgba(155, 115, 55, 0.18);
  stroke-width: 3;
  stroke-linecap: round;
}

.road-center {
  fill: rgba(155, 115, 55, 0.15);
}

/* Placement des tuiles dans la grille */
.tile-lumbermill {
  grid-area: lumb;
}
.tile-farm {
  grid-area: farm;
}
.tile-barracks {
  grid-area: bar;
}
.tile-headquarters {
  grid-area: hq;
}
.tile-quarry {
  grid-area: quar;
}
.tile-mine {
  grid-area: mine;
}

/* Couleur thématique par type */
.tile-headquarters {
  --tc: 218, 165, 32;
} /* or */
.tile-barracks {
  --tc: 220, 70, 70;
} /* rouge */
.tile-lumbermill {
  --tc: 74, 197, 100;
} /* vert forêt */
.tile-farm {
  --tc: 234, 189, 30;
} /* blé */
.tile-quarry {
  --tc: 148, 163, 184;
} /* pierre */
.tile-mine {
  --tc: 96, 165, 220;
} /* acier */

/* ---- Tuile de bâtiment ---- */
.building-tile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  border: 1.5px solid rgba(var(--tc), 0.28);
  background: rgba(var(--tc), 0.07);
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
  min-height: 88px;
}

.tile-headquarters {
  min-height: 108px;
  border-width: 2px;
}

.building-tile:hover {
  transform: translateY(-2px) scale(1.03);
}

.building-tile.selected {
  outline: 2px solid rgba(var(--tc), 0.85);
  outline-offset: 2px;
}

/* États (override couleur type) */
.state-upgradable {
  border-color: rgba(34, 197, 94, 0.65);
  background: rgba(18, 48, 18, 0.75);
  box-shadow:
    0 0 14px rgba(34, 197, 94, 0.18),
    inset 0 0 10px rgba(34, 197, 94, 0.04);
}
.state-upgradable:hover {
  box-shadow: 0 0 22px rgba(34, 197, 94, 0.32);
}

.state-available {
  border-color: rgba(96, 165, 250, 0.45);
  border-style: dashed;
  background: rgba(12, 25, 50, 0.55);
}
.state-available:hover {
  background: rgba(18, 36, 70, 0.68);
}

.state-waiting {
  border-color: rgba(245, 158, 11, 0.42);
  background: rgba(38, 26, 8, 0.68);
}

.state-constructing {
  border-color: rgba(218, 165, 32, 0.5);
  background: rgba(40, 30, 8, 0.72);
}
.state-constructing .tile-status {
  color: #daa520;
}

.state-locked {
  border-color: rgba(60, 60, 60, 0.25);
  background: rgba(10, 10, 10, 0.6);
  opacity: 0.45;
  cursor: default;
}
.state-locked:hover {
  transform: none;
}

.state-maxed {
  border-color: rgba(139, 92, 246, 0.42);
  background: rgba(18, 10, 36, 0.68);
}

/* ---- Contenu de la tuile ---- */
.tile-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.22rem;
  padding: 0.55rem 0.4rem 0.45rem;
  width: 100%;
}

.tile-icon-wrap {
  position: relative;
  display: inline-flex;
}

.tile-icon {
  font-size: 2rem;
  line-height: 1;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.6));
  transition: filter 0.2s;
}

.tile-icon--locked {
  filter: grayscale(1) opacity(0.45);
}

.tile-icon--constructing {
  filter: grayscale(0.35) opacity(0.8);
}

/* Anneau de progression du chantier, superposé derrière l'icône */
.tile-progress-svg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 48px;
  height: 48px;
  pointer-events: none;
}

.tile-progress-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 3;
}

.tile-progress-ring {
  fill: none;
  stroke: #daa520;
  stroke-width: 3;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 1s linear;
}

.tile-headquarters .tile-icon {
  font-size: 2.4rem;
}

/* Badge niveau (coin haut-droite) */
.level-badge {
  position: absolute;
  top: -5px;
  right: -9px;
  min-width: 17px;
  height: 17px;
  padding: 0 3px;
  background: #b8860b;
  color: #fff8e0;
  font-size: 0.6rem;
  font-weight: 800;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  line-height: 1;
}

.level-badge--maxed {
  background: rgba(139, 92, 246, 0.9);
  color: #f0ebff;
}

.tile-name {
  font-size: 0.63rem;
  font-weight: 700;
  color: rgba(var(--tc), 0.85);
  text-align: center;
  line-height: 1.2;
  max-width: 82px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-locked .tile-name {
  color: #374151;
}

/* Libellé de statut */
.tile-status {
  font-size: 0.56rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #374151;
  line-height: 1;
}

.state-upgradable .tile-status {
  color: #4ade80;
}
.state-available .tile-status {
  color: #60a5fa;
}
.state-waiting .tile-status {
  color: #f59e0b;
}
.state-locked .tile-status {
  color: #374151;
}
.state-maxed .tile-status {
  color: #a78bfa;
}

/* ---- Bouton action rapide sur la tuile ---- */
.quick-btn {
  margin-top: 0.2rem;
  padding: 0.15rem 0.55rem;
  font-size: 0.65rem;
  font-weight: 800;
  border-radius: 6px;
  border: 1px solid rgba(34, 197, 94, 0.6);
  background: rgba(18, 80, 30, 0.75);
  color: #4ade80;
  cursor: pointer;
  line-height: 1.4;
  transition:
    background 0.15s,
    transform 0.1s,
    box-shadow 0.15s;
}

.quick-btn:hover {
  background: rgba(34, 197, 94, 0.22);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.35);
  transform: translateY(-1px);
}

.quick-btn:active {
  transform: scale(0.95);
}

.quick-btn--build {
  border-color: rgba(96, 165, 250, 0.6);
  background: rgba(12, 30, 70, 0.75);
  color: #93c5fd;
}

.quick-btn--build:hover {
  background: rgba(96, 165, 250, 0.22);
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.35);
}

/* ====== Panneau de détails ====== */
.detail-panel {
  margin-top: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  background: rgba(10, 20, 10, 0.8);
  border: 1px solid rgba(218, 165, 32, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Couleur de bordure selon l'état */
.detail-state-upgradable {
  border-color: rgba(34, 197, 94, 0.4);
}
.detail-state-available {
  border-color: rgba(96, 165, 250, 0.4);
}
.detail-state-constructing {
  border-color: rgba(218, 165, 32, 0.45);
}
.detail-state-waiting {
  border-color: rgba(245, 158, 11, 0.4);
}
.detail-state-locked {
  border-color: rgba(107, 114, 128, 0.3);
}
.detail-state-maxed {
  border-color: rgba(139, 92, 246, 0.35);
}

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.detail-icon {
  font-size: 2rem;
  line-height: 1;
  flex-shrink: 0;
}

.detail-name {
  font-weight: 700;
  color: #f4e4bc;
  font-size: 1rem;
  margin-bottom: 0.2rem;
}

.detail-desc {
  font-size: 0.78rem;
  color: #94a3b8;
  line-height: 1.4;
}

.detail-close {
  margin-left: auto;
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.25rem;
  flex-shrink: 0;
  transition: color 0.2s;
}
.detail-close:hover {
  color: #f4e4bc;
}

/* Bâtiment verrouillé */
.locked-message {
  font-size: 0.82rem;
  color: #9ca3af;
  line-height: 1.5;
}

.hq-progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.4rem;
}

.hq-current {
  font-size: 0.78rem;
  background: rgba(107, 114, 128, 0.15);
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  color: #9ca3af;
}

.hq-needed {
  font-size: 0.78rem;
  background: rgba(245, 158, 11, 0.1);
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

/* Bâtiment disponible */
.available-message {
  font-size: 0.82rem;
  color: #93c5fd;
  line-height: 1.5;
}

.build-costs,
.upgrade-costs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.costs-label {
  font-size: 0.72rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 100%;
  margin-bottom: 0.1rem;
}

.costs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

/* Chantier en cours */
.detail-constructing-info {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.constructing-message {
  font-size: 0.82rem;
  color: #daa520;
  line-height: 1.5;
}

.construction-progress-bar {
  width: 100%;
  height: 8px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.construction-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #b8860b, #daa520);
  transition: width 1s linear;
}

.construction-eta {
  font-size: 0.78rem;
  color: #daa520;
  background: rgba(218, 165, 32, 0.08);
  border: 1px solid rgba(218, 165, 32, 0.25);
  border-radius: 5px;
  padding: 0.3rem 0.5rem;
  text-align: center;
}

/* Production */
.detail-production {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0.6rem;
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.12);
  border-radius: 7px;
}

.production-label {
  font-size: 0.72rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.production-value {
  font-size: 0.82rem;
  font-weight: 600;
  color: #4ade80;
}

/* Niveau max */
.detail-maxed {
  font-size: 0.82rem;
  color: #c4b5fd;
  text-align: center;
  padding: 0.5rem;
  background: rgba(139, 92, 246, 0.08);
  border-radius: 7px;
}

/* Section amélioration */
.detail-upgrade {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.upgrade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.upgrade-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #daa520;
}

.upgrade-gain {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: #94a3b8;
}

.gain-arrow {
  color: #4ade80;
  font-weight: bold;
}

.cost-chip {
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f4e4bc;
  transition: all 0.2s;
}

.cost-chip.insufficient {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
}

.upgrade-eta {
  font-size: 0.73rem;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 5px;
  padding: 0.3rem 0.5rem;
  text-align: center;
}

.upgrade-btn {
  width: 100%;
  padding: 0.55rem;
  border-radius: 7px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  background: rgba(139, 69, 19, 0.2);
  color: #94a3b8;
  font-size: 0.82rem;
  cursor: not-allowed;
  transition: all 0.25s ease;
}

.upgrade-btn.upgrade-btn-ready {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.5);
  color: #4ade80;
  cursor: pointer;
  font-weight: 600;
}

.upgrade-btn.upgrade-btn-ready:hover {
  background: rgba(34, 197, 94, 0.25);
  border-color: #4ade80;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);
}

/* ====== Animations ====== */
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* ====== Responsive ======
   La carte garde ses 3x3 zones nommées (les routes SVG sont alignées dessus) —
   on réduit juste densité et tailles pour les petits écrans plutôt que de
   changer la structure de la grille. */
@media (max-width: 480px) {
  .village-map {
    gap: 0.4rem;
    padding: 0.9rem 0.6rem;
    min-height: 200px;
  }

  .building-tile {
    min-height: 64px;
  }

  .tile-icon {
    font-size: 1.4rem;
  }

  .tile-headquarters .tile-icon {
    font-size: 1.7rem;
  }

  .tile-name {
    font-size: 0.55rem;
    max-width: 60px;
  }

  .tile-status {
    font-size: 0.48rem;
  }
}
</style>
