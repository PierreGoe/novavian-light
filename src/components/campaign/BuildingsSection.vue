<template>
  <section class="buildings-section">
    <h3>Bâtiments</h3>
    <div class="buildings-grid">
      <div
        v-for="building in town?.buildings || []"
        :key="building.id"
        class="building-card"
        :class="[`building-${building.type}`, { 'can-upgrade': canUpgradeBuilding(building) }]"
      >
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

        <div v-if="getBuildingProductionGain(building.type)" class="building-production">
          <span class="production-label">Production actuelle</span>
          <span class="production-value">
            {{ getBuildingProductionIcon(building.type) }}
            +{{ getBuildingProductionGain(building.type)! * building.level }}/min
          </span>
        </div>

        <div class="upgrade-section">
          <div class="upgrade-header">
            <span class="upgrade-label">⬆️ Niveau {{ building.level + 1 }}</span>
            <span v-if="getBuildingProductionGain(building.type)" class="upgrade-gain">
              {{ getBuildingProductionIcon(building.type) }}
              {{ getBuildingProductionGain(building.type)! * building.level }}
              <span class="gain-arrow">→</span>
              {{ getBuildingProductionGain(building.type)! * (building.level + 1) }}/min
            </span>
          </div>

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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMissionStore } from '@/stores/missionStore'
import { useToastStore } from '@/stores/toastStore'

const missionStore = useMissionStore()
const toastStore = useToastStore()
const town = computed(() => missionStore.town.value)

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

const getUpgradeCost = (level: number) => ({
  wood: level * 100,
  clay: level * 80,
  iron: level * 60,
  crop: level * 40,
})

const getBuildingProductionGain = (type: string): number | null => {
  const gains: Record<string, number> = { lumbermill: 10, quarry: 8, mine: 6, farm: 12 }
  return gains[type] ?? null
}

const getBuildingProductionIcon = (type: string): string => {
  const icons: Record<string, string> = { lumbermill: '🪵', quarry: '🧱', mine: '⛒️', farm: '🌾' }
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

const getTimeUntilUpgrade = (level: number): string | null => {
  const resources = town.value?.resources
  const production = town.value?.production
  if (!resources || !production) return null
  const cost = getUpgradeCost(level)
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

const upgradeBuilding = (buildingId: string) => {
  if (missionStore.upgradeBuilding(buildingId)) {
    toastStore.showSuccess('Bâtiment amélioré avec succès !', { duration: 2000 })
  } else {
    toastStore.showError("Ressources insuffisantes pour l'amélioration", { duration: 2000 })
  }
}
</script>

<style scoped>
.buildings-section {
  margin-bottom: 2rem;
}

.buildings-section h3 {
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
</style>
