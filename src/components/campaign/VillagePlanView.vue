<template>
  <section class="village-plan-section">
    <div class="plan-title">
      <h3>Plan du Village</h3>
      <span class="hq-badge">QG niv. {{ hqLevel }}</span>
      <!-- Tooltip légende -->
      <div class="legend-tooltip-wrap">
        <span class="legend-trigger">ℹ️</span>
        <div class="legend-tooltip">
          <div class="legend-item legend-upgradable">⬆️ Améliorable</div>
          <div class="legend-item legend-available">✨ Disponible</div>
          <div class="legend-item legend-waiting">🪙 Ressources insuffisantes</div>
          <div class="legend-item legend-locked">🔒 Verrouillé (QG requis)</div>
          <div class="legend-item legend-maxed">✅ Niveau maximum</div>
        </div>
      </div>
    </div>

    <!-- Carte du village -->
    <div class="village-map">
      <!-- Chemins visuels entre les bâtiments -->
      <div class="path path-vertical"></div>
      <div class="path path-horizontal-top"></div>
      <div class="path path-horizontal-bottom"></div>

      <!-- Tuiles des bâtiments -->
      <div
        v-for="def in ALL_BUILDINGS"
        :key="def.type"
        class="building-slot"
        :class="[
          `slot-${def.type}`,
          `state-${getBuildingState(def.type)}`,
          { selected: selectedType === def.type },
        ]"
        @click="toggleSelect(def.type)"
      >
        <!-- Icône principale -->
        <div class="slot-icon">
          <span v-if="getBuildingState(def.type) === 'locked'" class="icon-locked">🔒</span>
          <span v-else>{{ def.icon }}</span>
        </div>

        <!-- Nom du bâtiment -->
        <div class="slot-name">{{ def.name }}</div>

        <!-- Niveau (si construit) -->
        <div v-if="getBuilding(def.type)" class="slot-level">
          <span
            v-for="i in Math.min(def.maxLevel, 10)"
            :key="i"
            class="level-pip"
            :class="{ active: i <= getBuilding(def.type)!.level }"
          ></span>
          <span class="level-num">{{ getBuilding(def.type)!.level }}</span>
        </div>

        <!-- Badge d'état -->
        <div class="slot-badge">
          <template v-if="getBuildingState(def.type) === 'locked'">
            QG {{ def.hqLevelRequired }} requis
          </template>
          <template v-else-if="getBuildingState(def.type) === 'available'"> Construire </template>
          <template v-else-if="getBuildingState(def.type) === 'upgradable'">
            ⬆️ Améliorer
          </template>
          <template v-else-if="getBuildingState(def.type) === 'waiting'"> 🪙 Attendre </template>
          <template v-else-if="getBuildingState(def.type) === 'maxed'"> ✅ Max </template>
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
        </div>

        <!-- Bâtiment construit -->
        <template v-else-if="selectedBuilding">
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
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { useToastStore } from '@/stores/toastStore'
import {
  BUILDING_DEFINITIONS,
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

const hqLevel = computed(() => getHQLevel(town.value?.buildings ?? []))

// Bâtiment sélectionné pour le panneau de détails
const selectedType = ref<BuildingType | null>(null)

const toggleSelect = (type: BuildingType) => {
  selectedType.value = selectedType.value === type ? null : type
}

// Récupère l'instance construite d'un bâtiment (ou null si pas encore construit)
const getBuilding = (type: BuildingType) =>
  town.value?.buildings?.find((b) => b.type === type) ?? null

// État d'un bâtiment : locked | available | upgradable | waiting | maxed
type BuildingState = 'locked' | 'available' | 'upgradable' | 'waiting' | 'maxed'

const getBuildingState = (type: BuildingType): BuildingState => {
  const def = BUILDING_DEFINITIONS[type]
  if (!isBuildingUnlocked(type, hqLevel.value)) return 'locked'

  const building = getBuilding(type)
  if (!building) return 'available'

  if (building.level >= def.maxLevel) return 'maxed'

  // Le bâtiment est construit et peut encore monter de niveau
  if (!canBuildingBeUpgraded(type, building.level, hqLevel.value)) return 'maxed'

  const cost = def.upgradeCost(building.level)
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
  selectedDef.value ? selectedDef.value.upgradeCost(0) : { wood: 0, clay: 0, iron: 0, crop: 0 },
)

// --- Helpers de production ---
const getProductionGain = (type: BuildingType): number | null =>
  BUILDING_DEFINITIONS[type]?.productionPerLevel?.amount ?? null

const getProductionIcon = (type: BuildingType): string => {
  const resource = BUILDING_DEFINITIONS[type]?.productionPerLevel?.resource
  const icons: Record<string, string> = { wood: '🪵', clay: '🧱', iron: '⚒️', crop: '🌾' }
  return resource ? (icons[resource] ?? '') : ''
}

const getUpgradeCost = (type: BuildingType, level: number) =>
  BUILDING_DEFINITIONS[type]?.upgradeCost(level) ?? { wood: 0, clay: 0, iron: 0, crop: 0 }

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

// --- Action ---
const doUpgrade = () => {
  if (!selectedBuilding.value) return
  if (missionStore.upgradeBuilding(selectedBuilding.value.id)) {
    toastStore.showSuccess('Bâtiment amélioré !', { duration: 2000 })
  } else {
    toastStore.showError("Ressources insuffisantes pour l'amélioration", { duration: 2000 })
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
  font-size: 0.9rem;
  cursor: help;
  opacity: 0.6;
  transition: opacity 0.15s;
  user-select: none;
}
.legend-trigger:hover {
  opacity: 1;
}

.legend-tooltip {
  display: none;
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

.legend-tooltip-wrap:hover .legend-tooltip {
  display: flex;
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
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto auto auto;
  grid-template-areas:
    '. hq .'
    'barracks lumbermill farm'
    '. quarry mine';
  gap: 0.6rem;
  padding: 1.25rem 1rem;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(74, 222, 128, 0.04) 0%, transparent 70%),
    linear-gradient(160deg, rgba(22, 40, 18, 0.85) 0%, rgba(10, 25, 10, 0.9) 100%);
  border: 1px solid rgba(74, 222, 128, 0.15);
  border-radius: 14px;
  overflow: hidden;
}

/* Chemins visuels entre les bâtiments */
.path {
  position: absolute;
  background: rgba(180, 140, 80, 0.12);
  pointer-events: none;
  z-index: 0;
}

.path-vertical {
  width: 2px;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.path-horizontal-top {
  height: 2px;
  left: 5%;
  right: 5%;
  /* Milieu de la ligne 2 (barracks-lumbermill-farm) : approximatif */
  top: calc(50% - 10px);
}

.path-horizontal-bottom {
  height: 2px;
  left: 30%;
  right: 5%;
  top: calc(75% - 5px);
}

/* ---- Positionnement des tuiles ---- */
.slot-headquarters {
  grid-area: hq;
}
.slot-barracks {
  grid-area: barracks;
}
.slot-lumbermill {
  grid-area: lumbermill;
}
.slot-farm {
  grid-area: farm;
}
.slot-quarry {
  grid-area: quarry;
}
.slot-mine {
  grid-area: mine;
}

/* ---- Tuile de bâtiment ---- */
.building-slot {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.65rem 0.5rem 0.55rem;
  border-radius: 10px;
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.15s ease;
  background: rgba(10, 20, 10, 0.7);
  text-align: center;
  min-height: 110px;
  justify-content: center;
}

.building-slot:hover {
  transform: translateY(-2px);
}

.building-slot.selected {
  outline: 2px solid #f4e4bc;
  outline-offset: 2px;
}

/* --- États visuels --- */
/* Améliorable : vert lumineux */
.state-upgradable {
  border-color: rgba(34, 197, 94, 0.6);
  background: rgba(20, 50, 20, 0.75);
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.15);
}
.state-upgradable:hover {
  box-shadow: 0 0 18px rgba(34, 197, 94, 0.3);
}

/* Disponible : bleu */
.state-available {
  border-color: rgba(96, 165, 250, 0.5);
  border-style: dashed;
  background: rgba(15, 30, 55, 0.6);
}
.state-available:hover {
  background: rgba(20, 40, 70, 0.75);
}

/* En attente de ressources : doré */
.state-waiting {
  border-color: rgba(245, 158, 11, 0.45);
  background: rgba(40, 30, 10, 0.7);
}

/* Verrouillé : gris */
.state-locked {
  border-color: rgba(107, 114, 128, 0.25);
  background: rgba(15, 15, 15, 0.65);
  opacity: 0.65;
  cursor: default;
}
.state-locked:hover {
  transform: none;
}

/* Niveau max : violet doux */
.state-maxed {
  border-color: rgba(139, 92, 246, 0.4);
  background: rgba(25, 15, 45, 0.7);
}

/* ---- Contenu de la tuile ---- */
.slot-icon {
  font-size: 1.9rem;
  line-height: 1;
}

.icon-locked {
  font-size: 1.4rem;
  opacity: 0.5;
}

.slot-name {
  font-size: 0.7rem;
  font-weight: 600;
  color: #f4e4bc;
  line-height: 1.2;
}

/* Jauge de niveau (pips) */
.slot-level {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 90px;
}

.level-pip {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(218, 165, 32, 0.2);
  border: 1px solid rgba(218, 165, 32, 0.3);
  flex-shrink: 0;
}

.level-pip.active {
  background: #daa520;
  border-color: #daa520;
}

.level-num {
  font-size: 0.65rem;
  color: #daa520;
  margin-left: 3px;
}

/* Badge d'état sous la tuile */
.slot-badge {
  font-size: 0.62rem;
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.state-upgradable .slot-badge {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}
.state-available .slot-badge {
  background: rgba(96, 165, 250, 0.15);
  color: #93c5fd;
}
.state-waiting .slot-badge {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
}
.state-locked .slot-badge {
  background: rgba(107, 114, 128, 0.15);
  color: #6b7280;
  font-weight: normal;
}
.state-maxed .slot-badge {
  background: rgba(139, 92, 246, 0.12);
  color: #c4b5fd;
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
</style>
