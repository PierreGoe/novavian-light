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
          :class="`building-${building.type}`"
          @click="selectBuilding(building)"
        >
          <div class="building-icon">{{ getBuildingIcon(building.type) }}</div>
          <div class="building-info">
            <div class="building-name">{{ getBuildingName(building.type) }}</div>
            <div class="building-level">Niveau {{ building.level }}</div>
          </div>
          <button
            class="upgrade-btn"
            @click.stop="upgradeBuilding(building.id)"
            :disabled="!canUpgradeBuilding(building)"
          >
            ⬆️
          </button>
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

const selectBuilding = (building: { type: string; level: number }) => {
  toastStore.showInfo(`${getBuildingName(building.type)} niveau ${building.level} sélectionné`, {
    duration: 2000,
  })
}

const canUpgradeBuilding = (building: { level: number }): boolean => {
  if (!town.value?.resources) return false

  const cost = {
    wood: building.level * 100,
    clay: building.level * 80,
    iron: building.level * 60,
    crop: building.level * 40,
  }

  return (
    town.value.resources.wood >= cost.wood &&
    town.value.resources.clay >= cost.clay &&
    town.value.resources.iron >= cost.iron &&
    town.value.resources.crop >= cost.crop
  )
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
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.building-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: rgba(139, 69, 19, 0.1);
  border: 1px solid rgba(218, 165, 32, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.building-card:hover {
  background: rgba(139, 69, 19, 0.2);
  border-color: #daa520;
}

.building-icon {
  font-size: 2rem;
  margin-right: 1rem;
}

.building-info {
  flex: 1;
}

.building-name {
  font-weight: bold;
  color: #f4e4bc;
  margin-bottom: 0.25rem;
}

.building-level {
  font-size: 0.8rem;
  color: #daa520;
}

.upgrade-btn {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid #22c55e;
  color: #22c55e;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upgrade-btn:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.3);
}

.upgrade-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
