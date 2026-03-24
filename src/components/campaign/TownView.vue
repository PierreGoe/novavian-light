<template>
  <div class="town-view">
    <header class="town-header">
      <h2>{{ town?.name || 'Camp de Base' }}</h2>
      <div class="town-stats">
        <span class="stat">🏘️ Pop: {{ town?.population || 0 }}</span>
        <span class="stat">🏗️ Bâtiments: {{ town?.buildings?.length || 0 }}</span>
        <span class="stat">⚔️ Unités: {{ totalUnits }}</span>
      </div>
    </header>

    <!-- Zone des bâtiments -->
    <section class="buildings-section">
      <h3>Bâtiments</h3>
      <div class="buildings-grid">
        <div
          v-for="building in town?.buildings || []"
          :key="building.id"
          class="building-card"
          :class="[`building-${building.type}`, { 'can-upgrade': canUpgradeBuilding(building) }]"
        >
          <!-- En-tête de la carte -->
          <div class="building-header">
            <div class="building-header-left">
              <span class="building-icon">{{ getBuildingIcon(building.type) }}</span>
              <div>
                <div class="building-name">{{ getBuildingName(building.type) }}</div>
                <div class="building-level-badges">
                  <span
                    v-for="i in 5"
                    :key="i"
                    class="level-pip"
                    :class="{ active: i <= building.level }"
                  ></span>
                  <span class="level-text">Niv. {{ building.level }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Gain de production actuel (si bâtiment de ressources) -->
          <div v-if="getBuildingProductionGain(building.type)" class="building-production">
            <span class="production-label">Production actuelle</span>
            <span class="production-value">
              {{ getBuildingProductionIcon(building.type) }}
              +{{ getBuildingProductionGain(building.type)! * building.level }}/min
            </span>
          </div>

          <!-- Séparateur upgrade -->
          <div class="upgrade-section">
            <div class="upgrade-header">
              <span class="upgrade-label">⬆️ Niveau {{ building.level + 1 }}</span>
              <!-- Gain si bâtiment de ressources -->
              <span v-if="getBuildingProductionGain(building.type)" class="upgrade-gain">
                {{ getBuildingProductionIcon(building.type) }}
                {{ getBuildingProductionGain(building.type)! * building.level }}
                <span class="gain-arrow">→</span>
                {{ getBuildingProductionGain(building.type)! * (building.level + 1) }}/min
              </span>
            </div>

            <!-- Coût de l'upgrade -->
            <div class="upgrade-costs">
              <span
                class="cost-chip"
                :class="{
                  insufficient: (town?.resources?.wood || 0) < getUpgradeCost(building.level).wood,
                }"
                >🪵 {{ getUpgradeCost(building.level).wood }}</span
              >
              <span
                class="cost-chip"
                :class="{
                  insufficient: (town?.resources?.clay || 0) < getUpgradeCost(building.level).clay,
                }"
                >🧱 {{ getUpgradeCost(building.level).clay }}</span
              >
              <span
                class="cost-chip"
                :class="{
                  insufficient: (town?.resources?.iron || 0) < getUpgradeCost(building.level).iron,
                }"
                >⚒️ {{ getUpgradeCost(building.level).iron }}</span
              >
              <span
                class="cost-chip"
                :class="{
                  insufficient: (town?.resources?.crop || 0) < getUpgradeCost(building.level).crop,
                }"
                >🌾 {{ getUpgradeCost(building.level).crop }}</span
              >
            </div>

            <!-- ETA si ressources insuffisantes -->
            <div
              v-if="!canUpgradeBuilding(building) && getTimeUntilUpgrade(building.level)"
              class="upgrade-eta"
            >
              ⏱️ Disponible dans {{ getTimeUntilUpgrade(building.level) }}
            </div>

            <button
              class="upgrade-btn"
              :class="{ 'upgrade-btn-ready': canUpgradeBuilding(building) }"
              @click="upgradeBuilding(building.id)"
              :disabled="!canUpgradeBuilding(building)"
            >
              {{ canUpgradeBuilding(building) ? 'Améliorer' : 'Ressources insuffisantes' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Zone d'entraînement des unités -->
    <section class="units-section">
      <h3>Unités Militaires</h3>

      <!-- Unités existantes -->
      <!-- Unités existantes -->
      <div class="existing-units" v-if="(town?.units?.length || 0) > 0">
        <div v-for="unit in town?.units || []" :key="unit.id" class="unit-card">
          <div class="unit-icon">{{ getUnitIcon(unit.type) }}</div>
          <div class="unit-info">
            <div class="unit-name">{{ getUnitName(unit.type) }}</div>
            <div class="unit-count">{{ unit.count }} unités</div>
            <div class="unit-stats">
              <span>⚔️ {{ unit.attack }}</span>
              <span>🛡️ {{ unit.defense }}</span>
              <span>❤️ {{ unit.health }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Formation de nouvelles unités -->
      <div class="unit-training">
        <h4>Entraîner des unités</h4>
        <div class="training-options">
          <div v-for="unitType in availableUnitTypes" :key="unitType" class="training-option">
            <div class="training-info">
              <span class="training-icon">{{ getUnitIcon(unitType) }}</span>
              <span class="training-name">{{ getUnitName(unitType) }}</span>
            </div>
            <div class="training-cost">
              <span class="cost-item">🪵 {{ getUnitCost(unitType).wood }}</span>
              <span class="cost-item">🧱 {{ getUnitCost(unitType).clay }}</span>
              <span class="cost-item">⚒️ {{ getUnitCost(unitType).iron }}</span>
              <span class="cost-item">🌾 {{ getUnitCost(unitType).crop }}</span>
            </div>
            <div class="training-controls">
              <input
                type="number"
                v-model="trainingQuantity[unitType]"
                min="1"
                max="10"
                class="quantity-input"
              />
              <button
                class="train-btn"
                @click="trainUnits(unitType, trainingQuantity[unitType])"
                :disabled="!canTrainUnit(unitType, trainingQuantity[unitType])"
              >
                Entraîner
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { useToastStore } from '@/stores/toastStore'
import type { MilitaryUnit } from '@/stores/missionStore'

const missionStore = useMissionStore()
const toastStore = useToastStore()

// Computed
const town = computed(() => missionStore.town.value)
const totalUnits = computed(
  () =>
    town.value?.units?.reduce((sum: number, unit: { count: number }) => sum + unit.count, 0) || 0,
)

// State
const trainingQuantity = ref<Record<string, number>>({
  infantry: 1,
  archer: 1,
  cavalry: 1,
  siege: 1,
})

const availableUnitTypes: MilitaryUnit['type'][] = ['infantry', 'archer', 'cavalry', 'siege']

// Methods
const getBuildingIcon = (type: string): string => {
  const icons = {
    barracks: '🏛️',
    stable: '🐎',
    workshop: '🔨',
    farm: '🌾',
    mine: '⛏️',
    quarry: '🗿',
    lumbermill: '🪓',
  }
  return icons[type as keyof typeof icons] || '🏢'
}

const getBuildingName = (type: string): string => {
  const names = {
    barracks: 'Casernes',
    stable: 'Écuries',
    workshop: 'Atelier',
    farm: 'Ferme',
    mine: 'Mine de Fer',
    quarry: 'Carrière',
    lumbermill: 'Scierie',
  }
  return names[type as keyof typeof names] || type
}

const getUnitIcon = (type: string): string => {
  const icons = {
    infantry: '🛡️',
    archer: '🏹',
    cavalry: '🐎',
    siege: '🏰',
  }
  return icons[type as keyof typeof icons] || '⚔️'
}

const getUnitName = (type: string): string => {
  const names = {
    infantry: 'Infanterie',
    archer: 'Archers',
    cavalry: 'Cavalerie',
    siege: 'Machines de Siège',
  }
  return names[type as keyof typeof names] || type
}

const getUnitCost = (type: string) => {
  const costs = {
    infantry: { wood: 20, clay: 10, iron: 30, crop: 15 },
    archer: { wood: 30, clay: 15, iron: 25, crop: 20 },
    cavalry: { wood: 50, clay: 30, iron: 60, crop: 40 },
    siege: { wood: 100, clay: 80, iron: 120, crop: 60 },
  }
  return costs[type as keyof typeof costs] || { wood: 0, clay: 0, iron: 0, crop: 0 }
}

const getUpgradeCost = (level: number) => ({
  wood: level * 100,
  clay: level * 80,
  iron: level * 60,
  crop: level * 40,
})

// Gain de production par niveau selon le type de bâtiment (null = pas de production)
const getBuildingProductionGain = (type: string): number | null => {
  const gains: Record<string, number> = {
    lumbermill: 10,
    quarry: 8,
    mine: 6,
    farm: 12,
  }
  return gains[type] ?? null
}

const getBuildingProductionIcon = (type: string): string => {
  const icons: Record<string, string> = {
    lumbermill: '🪵',
    quarry: '🧱',
    mine: '⛒️',
    farm: '🌾',
  }
  return icons[type] ?? ''
}

const canUpgradeBuilding = (building: { level: number }): boolean => {
  if (!town.value?.resources) return false
  const cost = getUpgradeCost(building.level)
  return (
    town.value.resources.wood >= cost.wood &&
    town.value.resources.clay >= cost.clay &&
    town.value.resources.iron >= cost.iron &&
    town.value.resources.crop >= cost.crop
  )
}

// Calcule le temps d'attente (en chaîne lisible) avant d'avoir les ressources suffisantes
const getTimeUntilUpgrade = (level: number): string | null => {
  const resources = town.value?.resources
  const production = town.value?.production
  if (!resources || !production) return null

  const cost = getUpgradeCost(level)

  // Pour chaque ressource insuffisante, calcule les minutes manquantes
  const minutesNeeded: number[] = []

  const check = (current: number, needed: number, rate: number) => {
    if (current >= needed) return
    if (rate <= 0) {
      minutesNeeded.push(Infinity)
      return
    }
    minutesNeeded.push((needed - current) / rate)
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
  if (s === 0) return `${m}min`
  return `${m}min ${s}s`
}

const upgradeBuilding = (buildingId: string) => {
  if (missionStore.upgradeBuilding(buildingId)) {
    toastStore.showSuccess('Bâtiment amélioré avec succès !', { duration: 2000 })
  } else {
    toastStore.showError("Ressources insuffisantes pour l'amélioration", { duration: 2000 })
  }
}

const canTrainUnit = (unitType: string, quantity: number): boolean => {
  if (!town.value?.resources) return false

  const cost = getUnitCost(unitType)
  const totalCost = {
    wood: cost.wood * quantity,
    clay: cost.clay * quantity,
    iron: cost.iron * quantity,
    crop: cost.crop * quantity,
  }

  return (
    town.value.resources.wood >= totalCost.wood &&
    town.value.resources.clay >= totalCost.clay &&
    town.value.resources.iron >= totalCost.iron &&
    town.value.resources.crop >= totalCost.crop
  )
}

const trainUnits = (unitType: MilitaryUnit['type'], quantity: number) => {
  if (missionStore.trainUnit(unitType, quantity)) {
    toastStore.showSuccess(`${quantity} ${getUnitName(unitType)} entraînées !`, { duration: 2000 })
  } else {
    toastStore.showError("Ressources insuffisantes pour l'entraînement", { duration: 2000 })
  }
}
</script>

<style scoped>
.town-view {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
}

.town-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(218, 165, 32, 0.3);
}

.town-header h2 {
  margin: 0 0 0.5rem 0;
  color: #daa520;
  font-size: 1.5rem;
}

.town-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  padding: 0.25rem 0.5rem;
  background: rgba(139, 69, 19, 0.2);
  border-radius: 4px;
  font-size: 0.8rem;
  border: 1px solid rgba(218, 165, 32, 0.2);
}

.buildings-section,
.units-section {
  margin-bottom: 2rem;
}

.buildings-section h3,
.units-section h3 {
  margin: 0 0 1rem 0;
  color: #daa520;
  font-size: 1.2rem;
}

.buildings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 1rem;
}

.building-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: rgba(20, 12, 5, 0.6);
  border: 1px solid rgba(218, 165, 32, 0.25);
  border-radius: 12px;
  overflow: hidden;
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.building-card.can-upgrade {
  border-color: rgba(34, 197, 94, 0.5);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.08);
}

/* En-tête */
.building-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1rem 0.75rem;
  background: rgba(139, 69, 19, 0.15);
  border-bottom: 1px solid rgba(218, 165, 32, 0.15);
}

.building-header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.building-icon {
  font-size: 1.8rem;
  line-height: 1;
}

.building-name {
  font-weight: 600;
  color: #f4e4bc;
  font-size: 0.95rem;
  margin-bottom: 0.35rem;
}

.building-level-badges {
  display: flex;
  align-items: center;
  gap: 3px;
}

.level-pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(218, 165, 32, 0.2);
  border: 1px solid rgba(218, 165, 32, 0.3);
  transition: background 0.2s;
}

.level-pip.active {
  background: #daa520;
  border-color: #daa520;
}

.level-text {
  font-size: 0.7rem;
  color: #daa520;
  margin-left: 4px;
}

/* Production actuelle */
.building-production {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(34, 197, 94, 0.05);
  border-bottom: 1px solid rgba(34, 197, 94, 0.1);
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

/* Zone upgrade */
.upgrade-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem 1rem 0.9rem;
}

.upgrade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.upgrade-label {
  font-size: 0.78rem;
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

.upgrade-costs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
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

.upgrade-btn {
  width: 100%;
  padding: 0.5rem;
  border-radius: 7px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  background: rgba(139, 69, 19, 0.2);
  color: #94a3b8;
  font-size: 0.8rem;
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

.upgrade-btn:disabled {
  opacity: 0.6;
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

.existing-units {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.unit-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: rgba(220, 20, 60, 0.1);
  border: 1px solid rgba(220, 20, 60, 0.3);
  border-radius: 8px;
}

.unit-icon {
  font-size: 1.5rem;
  margin-right: 1rem;
}

.unit-info {
  flex: 1;
}

.unit-name {
  font-weight: bold;
  color: #f4e4bc;
  margin-bottom: 0.25rem;
}

.unit-count {
  font-size: 0.9rem;
  color: #daa520;
  margin-bottom: 0.25rem;
}

.unit-stats {
  display: flex;
  gap: 0.5rem;
  font-size: 0.7rem;
}

.unit-training h4 {
  margin: 0 0 1rem 0;
  color: #daa520;
}

.training-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.training-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: rgba(139, 69, 19, 0.1);
  border: 1px solid rgba(218, 165, 32, 0.3);
  border-radius: 8px;
  gap: 1rem;
}

.training-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
}

.training-icon {
  font-size: 1.2rem;
}

.training-name {
  font-weight: bold;
  color: #f4e4bc;
}

.training-cost {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cost-item {
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
  background: rgba(139, 69, 19, 0.2);
  border-radius: 4px;
}

.training-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quantity-input {
  width: 60px;
  padding: 0.5rem;
  border: 1px solid rgba(218, 165, 32, 0.3);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  color: #f4e4bc;
  text-align: center;
}

.train-btn {
  background: rgba(220, 20, 60, 0.2);
  border: 1px solid #dc143c;
  color: #dc143c;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.8rem;
}

.train-btn:hover:not(:disabled) {
  background: rgba(220, 20, 60, 0.3);
}

.train-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
