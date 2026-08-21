<template>
  <section class="village-plan-section">
    <div class="plan-title">
      <h3>Plan du Village</h3>
      <Badge tone="accent">QG niv. {{ hqLevel }}</Badge>
      <!-- Tooltip légende -->
      <InfoPopover label="Légende des états de bâtiment" class="legend-popover">
        <div class="legend-item legend-upgradable">⬆️ Améliorable</div>
        <div class="legend-item legend-available">✨ Disponible</div>
        <div class="legend-item legend-constructing">🏗️ En chantier</div>
        <div class="legend-item legend-waiting">🪙 Ressources insuffisantes</div>
        <div class="legend-item legend-locked">🔒 Verrouillé (QG requis)</div>
        <div class="legend-item legend-maxed">✅ Niveau maximum</div>
      </InfoPopover>
    </div>

    <!-- Village en arbre de compétence : le Bâtiment Principal au centre,
         les 6 autres bâtiments en branches (config déclarative — voir
         src/data/villageLayout.ts). -->
    <VillageSkillTree :tiles="villageTiles" @select="toggleSelect" />

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
              <Badge
                :tone="(town?.resources?.wood || 0) < selectedBuildCost.wood ? 'danger' : 'neutral'"
              >
                🪵 {{ selectedBuildCost.wood }}
              </Badge>
              <Badge
                :tone="(town?.resources?.clay || 0) < selectedBuildCost.clay ? 'danger' : 'neutral'"
              >
                🧱 {{ selectedBuildCost.clay }}
              </Badge>
              <Badge
                :tone="(town?.resources?.iron || 0) < selectedBuildCost.iron ? 'danger' : 'neutral'"
              >
                ⚒️ {{ selectedBuildCost.iron }}
              </Badge>
              <Badge
                :tone="(town?.resources?.crop || 0) < selectedBuildCost.crop ? 'danger' : 'neutral'"
              >
                🌾 {{ selectedBuildCost.crop }}
              </Badge>
            </div>
          </div>

          <!-- Temps estimé si ressources insuffisantes (même affichage que l'amélioration) -->
          <div v-if="!canAffordBuild && timeUntilAffordable(selectedBuildCost)" class="upgrade-eta">
            ⏱️ Disponible dans {{ timeUntilAffordable(selectedBuildCost) }}
          </div>

          <!-- Bouton construire -->
          <Button
            variant="success"
            class="upgrade-btn"
            :disabled="!canAffordBuild"
            :title="!canAffordBuild ? missingResourcesText(selectedDef!.type) : undefined"
            @click="doBuild()"
          >
            {{ canAffordBuild ? 'Construire' : 'Ressources insuffisantes' }}
          </Button>
        </div>

        <!-- Bâtiment construit -->
        <template v-else-if="selectedBuilding">
          <!-- Chantier en cours -->
          <div v-if="selectedState === 'constructing'" class="detail-constructing-info">
            <div class="constructing-message">
              🏗️ Chantier en cours — niveau {{ selectedBuilding.level + 1 }}
            </div>
            <ProgressBar :value="getConstructionProgress(selectedDef.type)" tone="accent" />
            <div class="construction-eta">
              ⏱️ Terminé dans {{ getRemainingConstructionTime(selectedDef.type) }}
            </div>
            <Button
              variant="success"
              class="upgrade-btn"
              disabled
              :title="`Un seul chantier à la fois — libre dans ${getRemainingConstructionTime(selectedDef!.type)}`"
            >
              🏗️ Chantier en cours…
            </Button>
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
                <Badge
                  :tone="
                    (town?.resources?.wood || 0) <
                    getUpgradeCost(selectedDef.type, selectedBuilding.level).wood
                      ? 'danger'
                      : 'neutral'
                  "
                >
                  🪵 {{ getUpgradeCost(selectedDef.type, selectedBuilding.level).wood }}
                </Badge>
                <Badge
                  :tone="
                    (town?.resources?.clay || 0) <
                    getUpgradeCost(selectedDef.type, selectedBuilding.level).clay
                      ? 'danger'
                      : 'neutral'
                  "
                >
                  🧱 {{ getUpgradeCost(selectedDef.type, selectedBuilding.level).clay }}
                </Badge>
                <Badge
                  :tone="
                    (town?.resources?.iron || 0) <
                    getUpgradeCost(selectedDef.type, selectedBuilding.level).iron
                      ? 'danger'
                      : 'neutral'
                  "
                >
                  ⚒️ {{ getUpgradeCost(selectedDef.type, selectedBuilding.level).iron }}
                </Badge>
                <Badge
                  :tone="
                    (town?.resources?.crop || 0) <
                    getUpgradeCost(selectedDef.type, selectedBuilding.level).crop
                      ? 'danger'
                      : 'neutral'
                  "
                >
                  🌾 {{ getUpgradeCost(selectedDef.type, selectedBuilding.level).crop }}
                </Badge>
              </div>

              <!-- Temps estimé si ressources insuffisantes -->
              <div v-if="selectedState === 'waiting' && getTimeUntilUpgrade()" class="upgrade-eta">
                ⏱️ Disponible dans {{ getTimeUntilUpgrade() }}
              </div>

              <!-- Bouton améliorer -->
              <Button
                variant="success"
                class="upgrade-btn"
                :disabled="selectedState !== 'upgradable'"
                :title="
                  selectedState === 'waiting' ? missingResourcesText(selectedDef!.type) : undefined
                "
                @click="doUpgrade()"
              >
                {{
                  selectedState === 'upgradable'
                    ? `Améliorer → Niv. ${selectedBuilding.level + 1}`
                    : 'Ressources insuffisantes'
                }}
              </Button>
            </div>

            <!-- Recrutement (Caserne uniquement) -->
            <BarracksRecruitmentPanel v-if="selectedDef.type === 'barracks'" />
          </template>
        </template>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { useExplorationTicker } from '@/composables/useExplorationTicker'
import { useToastStore } from '@/stores/toastStore'
import {
  BUILDING_DEFINITIONS,
  getBuildingUpgrade,
  getHQLevel,
  canBuildingBeUpgraded,
  isBuildingUnlocked,
} from '@/data/buildings'
import type { BuildingType } from '@/data/buildings'
import { VILLAGE_LAYOUT } from '@/data/villageLayout'
import Badge from '@/components/ui/Badge.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import InfoPopover from '@/components/ui/InfoPopover.vue'
import Button from '@/components/ui/Button.vue'
import VillageSkillTree from '@/components/campaign/village/VillageSkillTree.vue'
import BarracksRecruitmentPanel from '@/components/campaign/village/BarracksRecruitmentPanel.vue'

const missionStore = useMissionStore()
const toastStore = useToastStore()
const town = computed(() => missionStore.town.value)

// Horloge partagée du ticker de campagne (1 Hz) pour les anneaux/temps restants de
// chantier — plus d'intervalle local, tous les timers tickent sur la même vague.
const { now } = useExplorationTicker()

const hqLevel = computed(() => getHQLevel(town.value?.buildings ?? []))

// Bâtiment sélectionné pour le panneau de détails
const selectedType = ref<BuildingType | null>(null)

// Bâtiment à mettre en avant à la demande du parent (clic sur une ligne
// « Bâtiments producteurs » de l'onglet Ressources de TownView).
const props = withDefaults(defineProps<{ focusType?: BuildingType | null }>(), {
  focusType: null,
})

watch(
  () => props.focusType,
  (type) => {
    if (type) selectedType.value = type
  },
  { immediate: true },
)

const toggleSelect = (type: BuildingType) => {
  selectedType.value = selectedType.value === type ? null : type
}

// Récupère l'instance construite d'un bâtiment (ou null si pas encore construit)
const getBuilding = (type: BuildingType) =>
  town.value?.buildings?.find((b) => b.type === type) ?? null

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

// Libellé de statut affiché sur la carte
const getStatusText = (type: BuildingType): string => {
  const state = getBuildingState(type)
  switch (state) {
    case 'locked':
      return `QG ${BUILDING_DEFINITIONS[type].hqLevelRequired}`
    case 'available':
      return 'construire'
    case 'constructing':
      return `🏗️ ${getRemainingConstructionTime(type)}`
    case 'upgradable':
      return '▲ améliorer'
    case 'waiting':
      return '⏳ ressources'
    case 'maxed':
      return 'max'
  }
}

// Détaille les ressources manquantes pour le prochain palier d'un bâtiment
// (construction niveau 1 si pas construit, sinon amélioration) — alimente les
// tooltips des boutons désactivés et du statut « ⏳ ressources ».
const missingResourcesText = (type: BuildingType): string => {
  const res = town.value?.resources
  if (!res) return ''
  const cost = getBuildingUpgrade(type, getBuilding(type)?.level ?? 0)
  const parts: string[] = []
  const check = (icon: string, current: number, needed: number) => {
    if (current < needed) parts.push(`${Math.ceil(needed - current)} ${icon}`)
  }
  check('🪵', res.wood, cost.wood)
  check('🧱', res.clay, cost.clay)
  check('⚒️', res.iron, cost.iron)
  check('🌾', res.crop, cost.crop)
  return parts.length > 0 ? `il manque ${parts.join(', ')}` : ''
}

// Phrase complète expliquant le statut condensé affiché sur la carte (« QG 5 »,
// « ⏳ ressources », « max »…) — exposée en title au survol.
const getStatusDetail = (type: BuildingType): string => {
  const def = BUILDING_DEFINITIONS[type]
  switch (getBuildingState(type)) {
    case 'locked':
      return `Débloqué au niveau ${def.hqLevelRequired} du Bâtiment Principal (QG actuel : niveau ${hqLevel.value})`
    case 'available':
      return 'Emplacement libre — construisez ce bâtiment pour en profiter'
    case 'constructing':
      return `Chantier en cours — terminé dans ${getRemainingConstructionTime(type)}`
    case 'upgradable':
      return `Amélioration possible vers le niveau ${(getBuilding(type)?.level ?? 0) + 1}`
    case 'waiting':
      return `Ressources insuffisantes — ${missingResourcesText(type)}`
    case 'maxed':
      return `Niveau maximum atteint (${def.maxLevel})`
  }
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

// Calcule le temps avant d'avoir les ressources pour un coût donné — utilisé
// pour l'ETA d'amélioration ET de construction initiale.
const timeUntilAffordable = (cost: {
  wood: number
  clay: number
  iron: number
  crop: number
}): string | null => {
  const resources = town.value?.resources
  const production = town.value?.production
  if (!resources || !production) return null
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

// Temps avant de pouvoir améliorer le bâtiment sélectionné
const getTimeUntilUpgrade = (): string | null => {
  if (!selectedBuilding.value || !selectedDef.value) return null
  return timeUntilAffordable(getUpgradeCost(selectedDef.value.type, selectedBuilding.value.level))
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

// Données prêtes à l'emploi pour chaque nœud de l'arbre.
const villageTiles = computed(() =>
  VILLAGE_LAYOUT.map((layout) => ({
    type: layout.type,
    angle: layout.angle,
    isCenter: layout.isCenter,
    icon: BUILDING_DEFINITIONS[layout.type].icon,
    name: BUILDING_DEFINITIONS[layout.type].name,
    description: BUILDING_DEFINITIONS[layout.type].description,
    level: getBuilding(layout.type)?.level ?? 0,
    maxLevel: BUILDING_DEFINITIONS[layout.type].maxLevel,
    state: getBuildingState(layout.type),
    selected: selectedType.value === layout.type,
    statusText: getStatusText(layout.type),
    statusDetail: getStatusDetail(layout.type),
    constructionProgress: getConstructionProgress(layout.type),
  })),
)

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
  color: var(--color-accent-ink);
  font-size: 1.2rem;
}

/* ---- Tooltip légende (InfoPopover) ---- */
.legend-popover {
  margin-left: auto;
}

.legend-popover :deep(.info-popover-content) {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 200px;
}

.legend-item {
  font-size: 0.72rem;
  padding: 0.2rem 0.55rem;
  border-radius: 7px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.legend-upgradable {
  background: rgba(var(--color-success-strong-rgb), 0.12);
  border-color: rgba(var(--color-success-strong-rgb), 0.4);
  color: var(--color-success-strong);
}
.legend-available {
  background: rgba(var(--color-info-rgb), 0.12);
  border-color: rgba(var(--color-info-rgb), 0.4);
  color: var(--color-info);
}
.legend-constructing {
  background: rgba(var(--color-accent-rgb), 0.12);
  border-color: rgba(var(--color-accent-rgb), 0.4);
  color: var(--color-accent-ink);
}
.legend-waiting {
  background: rgba(var(--color-warning-rgb), 0.12);
  border-color: rgba(var(--color-warning-rgb), 0.4);
  color: var(--color-warning);
}
.legend-locked {
  background: rgba(var(--rarity-common-rgb), 0.15);
  border-color: rgba(var(--rarity-common-rgb), 0.35);
  color: var(--rarity-common);
}
.legend-maxed {
  background: rgba(var(--rarity-epic-rgb), 0.12);
  border-color: rgba(var(--rarity-epic-rgb), 0.35);
  color: var(--rarity-epic);
}

/* ====== Panneau de détails ====== */
.detail-panel {
  margin-top: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--color-bg-surface);
  border: 1px solid rgba(var(--color-accent-rgb), 0.2);
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
  color: var(--color-text);
  font-size: 1rem;
  margin-bottom: 0.2rem;
}

.detail-desc {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.detail-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--color-text-faint);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.25rem;
  flex-shrink: 0;
  transition: color 0.2s;
}
.detail-close:hover {
  color: var(--color-text);
}

/* Bâtiment verrouillé */
.locked-message {
  font-size: 0.82rem;
  color: var(--color-text-muted);
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
  background: rgba(var(--rarity-common-rgb), 0.15);
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  color: var(--color-text-muted);
}

.hq-needed {
  font-size: 0.78rem;
  background: rgba(var(--color-warning-rgb), 0.1);
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  color: var(--color-warning);
  border: 1px solid rgba(var(--color-warning-rgb), 0.3);
}

/* Bâtiment disponible */
.available-message {
  font-size: 0.82rem;
  color: var(--color-info);
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
  color: var(--color-text-faint);
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
  color: var(--color-accent-ink);
  line-height: 1.5;
}

.construction-eta {
  font-size: 0.78rem;
  color: var(--color-accent-ink);
  background: rgba(var(--color-accent-rgb), 0.08);
  border: 1px solid rgba(var(--color-accent-rgb), 0.25);
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
  background: rgba(var(--color-success-strong-rgb), 0.06);
  border: 1px solid rgba(var(--color-success-strong-rgb), 0.12);
  border-radius: 7px;
}

.production-label {
  font-size: 0.72rem;
  color: var(--color-text-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.production-value {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-success-strong);
}

/* Niveau max */
.detail-maxed {
  font-size: 0.82rem;
  color: var(--rarity-epic);
  text-align: center;
  padding: 0.5rem;
  background: rgba(var(--rarity-epic-rgb), 0.08);
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
  color: var(--color-accent-ink);
}

.upgrade-gain {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.gain-arrow {
  color: var(--color-success-strong);
  font-weight: bold;
}

.upgrade-eta {
  font-size: 0.73rem;
  color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), 0.08);
  border: 1px solid rgba(var(--color-warning-rgb), 0.25);
  border-radius: 5px;
  padding: 0.3rem 0.5rem;
  text-align: center;
}

.upgrade-btn {
  width: 100%;
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
